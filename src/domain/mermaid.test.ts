import { describe, expect, it } from "vitest";
import { exportMermaidDiagram, parseMermaidDiagram } from "./mermaid";
import type { JoineryProject, Relationship } from "./model";
import { createSampleProject } from "./project";

function diagramId(project: JoineryProject): string {
  return Object.keys(project.diagrams)[0];
}

function relationships(project: JoineryProject): Relationship[] {
  return Object.values(project.model.relationships);
}

describe("exportMermaidDiagram", () => {
  it("emits entity blocks with attributes, keys, and cardinality", () => {
    const project = createSampleProject();
    const output = exportMermaidDiagram(project, diagramId(project));

    expect(output.startsWith("erDiagram\n")).toBe(true);
    expect(output).toContain("Customer {");
    expect(output).toContain("\tIdentifier customer_id PK");
    // Non-identifying relationships use a dashed connector.
    expect(output).toContain("Customer ||..o{ Order : places");
    expect(output).toContain("Product ||..o{ Order_item : appears in");
  });

  it("emits metadata comments that survive the round trip", () => {
    const project = createSampleProject();
    const output = exportMermaidDiagram(project, diagramId(project));

    expect(output).toContain("%% name: Customer");
    expect(output).toContain("%% color: #356e9f");
    expect(output).toContain("%% description: A customer may place multiple orders.");
    expect(output).toContain("%% roles: customer / orders");
  });

  it("marks identifying relationships with a solid connector", () => {
    const project = createSampleProject();
    const output = exportMermaidDiagram(project, diagramId(project));
    // "contains" is identifying in the sample model.
    expect(output).toContain("Order ||--|{ Order_item : contains");
  });

  it("round-trips the model through parse and export", () => {
    const project = createSampleProject();
    const output = exportMermaidDiagram(project, diagramId(project));
    const { project: restored, warnings } = parseMermaidDiagram(output);

    expect(warnings).toHaveLength(0);
    const names = Object.values(restored.model.entities)
      .map((entity) => entity.name)
      .sort();
    expect(names).toEqual(["Customer", "Order", "Order item", "Product"]);

    const customer = Object.values(restored.model.entities).find(
      (entity) => entity.name === "Customer",
    )!;
    expect(customer.color).toBe("#6d4bb9");
    expect(customer.description).toBe("A person or organisation that places orders.");
    const customerId = customer.attributes.find(
      (attribute) => attribute.name === "customer id",
    )!;
    expect(customerId.logicalType).toBe("Identifier");
    expect(customerId.isIdentifier).toBe(true);
    expect(customer.identifiers[0].attributeIds).toEqual([customerId.id]);

    const places = relationships(restored).find(
      (relationship) => relationship.name === "places",
    )!;
    expect(places.sourceCardinality).toBe("exactly-one");
    expect(places.targetCardinality).toBe("zero-or-many");
    expect(places.isIdentifying).toBe(false);
    expect(places.sourceRole).toBe("customer");
    expect(places.targetRole).toBe("orders");
    expect(places.description).toBe("A customer may place multiple orders.");

    const contains = relationships(restored).find(
      (relationship) => relationship.name === "contains",
    )!;
    expect(contains.isIdentifying).toBe(true);
    expect(contains.targetCardinality).toBe("one-or-many");
  });
  it("round-trips n-ary relationships through metadata comments", () => {
    const project = structuredClone(createSampleProject());
    const entities = Object.values(project.model.entities);
    const [customer, order, product] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
      entities.find((entity) => entity.name === "Product")!,
    ];
    project.model.relationships.relationship_nary = {
      id: "relationship_nary",
      name: "fulfills",
      description: "",
      kind: "association",
      sourceRole: "",
      targetRole: "",
      sourceEntityId: customer.id,
      targetEntityId: order.id,
      sourceAttributeId: null,
      targetAttributeId: null,
      sourceCardinality: "exactly-one",
      targetCardinality: "zero-or-many",
      isIdentifying: false,
      participants: [
        {
          id: "p1",
          entityId: customer.id,
          attributeId: customer.attributes[0].id,
          role: "buyer",
          cardinality: "exactly-one",
        },
        {
          id: "p2",
          entityId: order.id,
          attributeId: null,
          role: "",
          cardinality: "exactly-2",
        },
        {
          id: "p3",
          entityId: product.id,
          attributeId: null,
          role: "",
          cardinality: "one-or-many",
        },
      ],
    };

    const output = exportMermaidDiagram(project, diagramId(project));
    expect(output).toContain("%% nary: fulfills | non-identifying");
    expect(output).toContain("%% participant: Customer | exactly-one | buyer |");
    expect(output).toContain('NARY_1["fulfills (n-ary)"]');

    const { project: restored } = parseMermaidDiagram(output);
    // The reified hub entity must not leak into the model.
    expect(
      Object.values(restored.model.entities).some((entity) =>
        entity.name.includes("(n-ary)"),
      ),
    ).toBe(false);
    const nary = relationships(restored).find(
      (relationship) => relationship.name === "fulfills",
    );
    expect(nary?.participants).toHaveLength(3);
    expect(nary?.participants?.[0].role).toBe("buyer");
    expect(nary?.participants?.[1].cardinality).toBe("exactly-2");
    expect(nary?.participants?.[0].attributeId).toBe(
      Object.values(restored.model.entities).find(
        (entity) => entity.name === "Customer",
      )?.attributes[0].id,
    );
    // The binary projection stays consistent for name-based lookups.
    expect(restored.model.entities[nary!.sourceEntityId]?.name).toBe("Customer");
    expect(restored.model.entities[nary!.targetEntityId]?.name).toBe("Order");
  });

  it("exports exact-N cardinality as bar markers plus a metadata comment", () => {
    const project = createSampleProject();
    const places = relationships(project).find(
      (relationship) => relationship.name === "places",
    )!;
    places.targetCardinality = "exactly-3";

    const output = exportMermaidDiagram(project, diagramId(project));
    expect(output).toContain("%% cardinality: exactly-one / exactly-3");
    // Mermaid has no exact-N symbol, so the visible connector degrades to ||.
    expect(output).toContain("Customer ||..|| Order : places");

    const { project: restored } = parseMermaidDiagram(output);
    const imported = relationships(restored).find(
      (relationship) => relationship.name === "places",
    )!;
    expect(imported.targetCardinality).toBe("exactly-3");
  });
});

describe("parseMermaidDiagram", () => {
  it("parses a plain foreign erDiagram", () => {
    const { project, warnings } = parseMermaidDiagram(
      [
        "erDiagram",
        "  CUSTOMER ||--o{ ORDER : places",
        "  CUSTOMER {",
        "    int id PK",
        '    string name UK "display name"',
        "    string email FK",
        "  }",
        "  ORDER {",
        "    int id PK",
        "    date ordered_on",
        "  }",
      ].join("\n"),
    );

    const entities = Object.values(project.model.entities);
    expect(entities.map((entity) => entity.name).sort()).toEqual(["CUSTOMER", "ORDER"]);
    const customer = entities.find((entity) => entity.name === "CUSTOMER")!;
    expect(customer.attributes).toHaveLength(3);
    expect(customer.identifiers[0].kind).toBe("primary");
    expect(customer.identifiers[1].kind).toBe("alternate");
    const email = customer.attributes.find((attribute) => attribute.name === "email")!;
    expect(email.isIdentifier).toBe(false);
    expect(warnings.some((warning) => warning.includes("Foreign key"))).toBe(true);

    const places = relationships(project)[0];
    expect(places.sourceCardinality).toBe("exactly-one");
    expect(places.targetCardinality).toBe("zero-or-many");
    expect(places.isIdentifying).toBe(true);
  });

  it("parses dashed relationships as non-identifying and decodes all cardinalities", () => {
    const { project } = parseMermaidDiagram(
      ["erDiagram", "  A |o..o| B : maybe", "  A }o--|{ C : many"].join("\n"),
    );
    const [maybe, many] = relationships(project);
    expect(maybe.isIdentifying).toBe(false);
    expect(maybe.sourceCardinality).toBe("zero-or-one");
    expect(maybe.targetCardinality).toBe("zero-or-one");
    expect(many.isIdentifying).toBe(true);
    expect(many.sourceCardinality).toBe("zero-or-many");
    expect(many.targetCardinality).toBe("one-or-many");
  });

  it("reads entity aliases and keeps [required] markers", () => {
    const { project } = parseMermaidDiagram(
      [
        "erDiagram",
        '  CUST["Customer table"] {',
        '    int id PK "[required] the key"',
        "  }",
      ].join("\n"),
    );
    const entity = Object.values(project.model.entities)[0];
    expect(entity.name).toBe("Customer table");
    expect(entity.attributes[0].isRequired).toBe(true);
    expect(entity.attributes[0].description).toBe("the key");
  });

  it("rejects input that is not a Mermaid erDiagram", () => {
    expect(() => parseMermaidDiagram("flowchart LR\n  A --> B")).toThrow(/erDiagram/);
    expect(() => parseMermaidDiagram("erDiagram")).toThrow(/No entities/);
  });
});

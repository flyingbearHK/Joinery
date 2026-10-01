// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { exportDrawioFile, importDrawioFile } from "./drawio";
import { createSampleProject } from "./project";

async function compress(text: string): Promise<string> {
  const body = new Response(text).body!;
  const compressed = await new Response(
    body.pipeThrough(new CompressionStream("deflate-raw")),
  ).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(compressed)));
}

describe("exportDrawioFile", () => {
  it("emits an uncompressed mxfile with one page per diagram", () => {
    const project = createSampleProject();
    const output = exportDrawioFile(project);

    expect(output).toContain("<mxfile");
    expect(output).toContain('<diagram id="diagram_overview" name="Overview">');
    expect(output).toContain("shape=table");
    expect(output).toContain("edgeStyle=entityRelationEdgeStyle");
    expect(output).toContain("startArrow=ERone");
    expect(output).toContain("endArrow=ERzeroToMany");
    expect(output).toContain("dashed=1"); // non-identifying relationship
  });
});

describe("importDrawioFile", () => {
  it("round-trips a Joinery export", async () => {
    const project = createSampleProject();
    const xml = exportDrawioFile(project);
    const { project: restored, warnings } = await importDrawioFile(xml);

    expect(warnings).toHaveLength(0);
    const entities = Object.values(restored.model.entities);
    expect(entities.map((entity) => entity.name).sort()).toEqual([
      "Customer",
      "Order",
      "Order item",
      "Product",
    ]);

    const customer = entities.find((entity) => entity.name === "Customer")!;
    expect(customer.description).toBe("A person or organisation that places orders.");
    const customerId = customer.attributes.find(
      (attribute) => attribute.name === "customer id",
    )!;
    expect(customerId.logicalType).toBe("Identifier");
    expect(customerId.isIdentifier).toBe(true);
    expect(customer.identifiers[0].attributeIds).toEqual([customerId.id]);

    const places = Object.values(restored.model.relationships).find(
      (relationship) => relationship.name === "places",
    )!;
    expect(places.sourceCardinality).toBe("exactly-one");
    expect(places.targetCardinality).toBe("zero-or-many");
    expect(places.isIdentifying).toBe(false);
    expect(places.sourceRole).toBe("customer");
    expect(places.targetRole).toBe("orders");

    const contains = Object.values(restored.model.relationships).find(
      (relationship) => relationship.name === "contains",
    )!;
    expect(contains.isIdentifying).toBe(true);

    // Positions survive.
    const diagram = Object.values(restored.diagrams)[0];
    expect(diagram.name).toBe("Overview");
    const view = diagram.entityViews[customer.id];
    expect(view).toMatchObject({ x: 80, y: 120 });
  });

  it("round-trips exact-N cardinality through the joineryCard style key", async () => {
    const project = createSampleProject();
    const places = Object.values(project.model.relationships).find(
      (relationship) => relationship.name === "places",
    )!;
    places.targetCardinality = "exactly-4";

    const xml = exportDrawioFile(project);
    expect(xml).toContain("joineryCard=exactly-one%7Cexactly-4");

    const { project: restored } = await importDrawioFile(xml);
    const imported = Object.values(restored.model.relationships).find(
      (relationship) => relationship.name === "places",
    )!;
    expect(imported.targetCardinality).toBe("exactly-4");
  });

  it("round-trips n-ary relationships through hub and leg cells", async () => {
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
      description: "A ternary fact.",
      kind: "association",
      sourceRole: "",
      targetRole: "",
      sourceEntityId: customer.id,
      targetEntityId: order.id,
      sourceAttributeId: null,
      targetAttributeId: null,
      sourceCardinality: "exactly-one",
      targetCardinality: "zero-or-many",
      isIdentifying: true,
      participants: [
        {
          id: "p1",
          entityId: customer.id,
          attributeId: customer.attributes[0].id,
          role: "buyer",
          cardinality: "exactly-3",
        },
        {
          id: "p2",
          entityId: order.id,
          attributeId: null,
          role: "",
          cardinality: "zero-or-many",
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

    const xml = exportDrawioFile(project);
    expect(xml).toContain("joineryKind=naryHub");
    expect(xml).toContain("joineryKind=naryLeg");
    expect(xml).toContain("joineryCard=exactly-3");

    const { project: restored } = await importDrawioFile(xml);
    const nary = Object.values(restored.model.relationships).find(
      (relationship) => relationship.name === "fulfills",
    )!;
    expect(nary.participants).toHaveLength(3);
    expect(nary.isIdentifying).toBe(true);
    expect(nary.description).toBe("A ternary fact.");
    const buyerParticipant = nary.participants!.find(
      (participant) => participant.role === "buyer",
    )!;
    const restoredCustomer = Object.values(restored.model.entities).find(
      (entity) => entity.name === "Customer",
    )!;
    expect(buyerParticipant.entityId).toBe(restoredCustomer.id);
    expect(buyerParticipant.cardinality).toBe("exactly-3");
    expect(buyerParticipant.attributeId).toBe(restoredCustomer.attributes[0].id);
  });

  it("round-trips a comment attached to an entity", async () => {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const entity = Object.values(project.model.entities).find(
      (candidate) => candidate.name === "Customer",
    )!;
    diagram.notes["note-c1"] = {
      id: "note-c1",
      text: "Confirm ownership rules",
      x: 30,
      y: 30,
      width: 200,
      height: 90,
      color: "#fff4c2",
      entityId: entity.id,
    };

    const xml = exportDrawioFile(project);
    const { project: restored } = await importDrawioFile(xml);
    const restoredEntity = Object.values(restored.model.entities).find(
      (candidate) => candidate.name === "Customer",
    )!;
    const restoredNote = Object.values(Object.values(restored.diagrams)[0].notes).find(
      (note) => note.text === "Confirm ownership rules",
    );
    expect(restoredNote?.entityId).toBe(restoredEntity.id);
  });

  it("imports foreign table/partialRectangle ER cells", async () => {
    const xml = `<mxfile host="app.diagrams.net"><diagram name="Page-1"><mxGraphModel>
      <root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>
        <mxCell id="t1" value="people" style="shape=table;startSize=30;container=1;collapsible=0;childLayout=tableLayout;" vertex="1" parent="1">
          <mxGeometry x="40" y="50" width="200" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="r1" value="PK, id int" style="shape=partialRectangle;connectable=0;" vertex="1" parent="t1">
          <mxGeometry width="200" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="r2" value="name varchar(50)" style="shape=partialRectangle;connectable=0;" vertex="1" parent="t1">
          <mxGeometry width="200" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="t2" value="pets" style="shape=table;startSize=30;container=1;collapsible=0;childLayout=tableLayout;" vertex="1" parent="1">
          <mxGeometry x="400" y="50" width="200" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="e1" value="owns" style="edgeStyle=entityRelationEdgeStyle;startArrow=ERmandOne;endArrow=ERzeroToMany;" edge="1" parent="1" source="t1" target="t2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root></mxGraphModel></diagram></mxfile>`;

    const { project } = await importDrawioFile(xml);
    const people = Object.values(project.model.entities).find(
      (entity) => entity.name === "people",
    )!;
    expect(people.attributes).toHaveLength(2);
    expect(people.attributes[0].name).toBe("id int");
    expect(people.attributes[0].isIdentifier).toBe(true);

    const owns = Object.values(project.model.relationships)[0];
    expect(owns.name).toBe("owns");
    expect(owns.sourceCardinality).toBe("exactly-one");
    expect(owns.targetCardinality).toBe("zero-or-many");
  });

  it("decodes compressed diagram pages", async () => {
    const inner = `<mxGraphModel><root>
      <mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="t1" value="widget" style="shape=table;startSize=30;container=1;childLayout=tableLayout;" vertex="1" parent="1">
        <mxGeometry x="10" y="10" width="180" height="90" as="geometry"/>
      </mxCell>
    </root></mxGraphModel>`;
    const compressed = await compress(encodeURIComponent(inner));
    const xml = `<mxfile host="app.diagrams.net"><diagram name="Page-1">${compressed}</diagram></mxfile>`;

    const { project } = await importDrawioFile(xml);
    const entity = Object.values(project.model.entities)[0];
    expect(entity.name).toBe("widget");
    const diagram = Object.values(project.diagrams)[0];
    expect(diagram.name).toBe("Page-1");
  });

  it("rejects files without entity shapes", async () => {
    const xml = `<mxfile><diagram name="p"><mxGraphModel><root>
      <mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="a" value="box" style="rounded=1;" vertex="1" parent="1">
        <mxGeometry x="0" y="0" width="80" height="40" as="geometry"/>
      </mxCell>
    </root></mxGraphModel></diagram></mxfile>`;
    await expect(importDrawioFile(xml)).rejects.toThrow(/entity shapes/);
  });
});

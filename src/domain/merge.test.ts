import { describe, expect, it } from "vitest";
import { compareProjects } from "./compare";
import { mergeDifferences } from "./merge";
import { createSampleProject } from "./project";
import type { JoineryProject } from "./model";

function editedSample(edit: (project: JoineryProject) => void): JoineryProject {
  const project = createSampleProject();
  edit(project);
  return project;
}

function entityByName(project: JoineryProject, name: string) {
  return Object.values(project.model.entities).find((entity) => entity.name === name);
}

describe("mergeDifferences", () => {
  it("applies an attribute change without touching other objects", () => {
    const current = createSampleProject();
    const comparison = editedSample((project) => {
      const order = entityByName(project, "Order")!;
      order.attributes.find((attribute) => attribute.name === "status")!.description =
        "Lifecycle stage.";
    });
    const differences = compareProjects(current, comparison).filter(
      (difference) => difference.category === "attribute",
    );
    const result = mergeDifferences(current, comparison, differences);

    expect(result.applied).toBe(1);
    const merged = entityByName(result.project, "Order")!;
    expect(
      merged.attributes.find((attribute) => attribute.name === "status")!.description,
    ).toBe("Lifecycle stage.");
    // The current project is untouched.
    expect(
      entityByName(current, "Order")!.attributes.find(
        (attribute) => attribute.name === "status",
      )!.description,
    ).toBe("Current stage of the order.");
  });

  it("adds a new entity with attributes and identifiers, placed on the diagram", () => {
    const current = createSampleProject();
    const comparison = editedSample((project) => {
      const warehouse = structuredClone(entityByName(project, "Product")!);
      warehouse.id = "entity_warehouse";
      warehouse.name = "Warehouse";
      project.model.entities[warehouse.id] = warehouse;
    });
    const added = compareProjects(current, comparison).filter((difference) =>
      difference.id.startsWith("entity-added"),
    );
    const result = mergeDifferences(current, comparison, added);
    const diagram = Object.values(result.project.diagrams)[0];

    expect(result.applied).toBe(1);
    const warehouse = entityByName(result.project, "Warehouse")!;
    expect(warehouse.attributes.length).toBeGreaterThan(0);
    expect(warehouse.identifiers).toHaveLength(1);
    expect(diagram.entityViews[warehouse.id]).toBeDefined();
  });

  it("removes an entity and cascades its relationships and diagram views", () => {
    const current = createSampleProject();
    const comparison = editedSample((project) => {
      const product = entityByName(project, "Product")!;
      delete project.model.entities[product.id];
      Object.values(project.model.relationships)
        .filter(
          (relationship) =>
            relationship.sourceEntityId === product.id ||
            relationship.targetEntityId === product.id,
        )
        .forEach((relationship) => delete project.model.relationships[relationship.id]);
    });
    const removed = compareProjects(current, comparison).filter(
      (difference) =>
        difference.id === "entity-removed-" + entityByName(current, "Product")!.id,
    );
    const result = mergeDifferences(current, comparison, removed);

    expect(result.applied).toBe(1);
    expect(entityByName(result.project, "Product")).toBeUndefined();
    expect(
      Object.values(result.project.model.relationships).some(
        (relationship) => relationship.name === "appears in",
      ),
    ).toBe(false);
  });

  it("skips relationship additions whose entities were not merged", () => {
    const current = createSampleProject();
    const comparison = editedSample((project) => {
      const warehouse = structuredClone(entityByName(project, "Product")!);
      warehouse.id = "entity_warehouse";
      warehouse.name = "Warehouse";
      project.model.entities[warehouse.id] = warehouse;
      const order = entityByName(project, "Order")!;
      project.model.relationships["relationship_stored_in"] = {
        id: "relationship_stored_in",
        name: "stored in",
        description: "",
        kind: "association",
        sourceRole: "",
        targetRole: "",
        sourceEntityId: order.id,
        targetEntityId: warehouse.id,
        sourceAttributeId: null,
        targetAttributeId: null,
        sourceCardinality: "exactly-one",
        targetCardinality: "zero-or-many",
        isIdentifying: false,
      };
    });
    const differences = compareProjects(current, comparison).filter(
      (difference) => difference.category === "relationship",
    );
    // Merge only the relationship — the Warehouse entity diff is not selected.
    const result = mergeDifferences(current, comparison, differences);
    expect(result.applied).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/endpoint/);
  });

  it("applies a relationship addition once its entities exist", () => {
    const current = createSampleProject();
    const comparison = editedSample((project) => {
      const warehouse = structuredClone(entityByName(project, "Product")!);
      warehouse.id = "entity_warehouse";
      warehouse.name = "Warehouse";
      project.model.entities[warehouse.id] = warehouse;
      const order = entityByName(project, "Order")!;
      project.model.relationships["relationship_stored_in"] = {
        id: "relationship_stored_in",
        name: "stored in",
        description: "",
        kind: "association",
        sourceRole: "shipment",
        targetRole: "stock",
        sourceEntityId: order.id,
        targetEntityId: warehouse.id,
        sourceAttributeId: null,
        targetAttributeId: null,
        sourceCardinality: "exactly-one",
        targetCardinality: "exactly-2",
        isIdentifying: false,
      };
    });
    const differences = compareProjects(current, comparison);
    const result = mergeDifferences(current, comparison, differences);
    const merged = Object.values(result.project.model.relationships).find(
      (relationship) => relationship.name === "stored in",
    )!;

    expect(merged.targetCardinality).toBe("exactly-2");
    expect(entityByName(result.project, "Warehouse")).toBeDefined();
  });

  it("applies entity changes including inversion entries by attribute name", () => {
    const current = createSampleProject();
    const comparison = editedSample((project) => {
      const customer = entityByName(project, "Customer")!;
      customer.inversionEntries = [
        {
          id: "ie_status",
          name: "By region",
          description: "Reach customers by region.",
          attributeIds: [customer.attributes[0].id],
        },
      ];
    });
    const differences = compareProjects(current, comparison).filter(
      (difference) => difference.category === "entity",
    );
    const result = mergeDifferences(current, comparison, differences);

    const customer = entityByName(result.project, "Customer")!;
    expect(customer.inversionEntries).toHaveLength(1);
    expect(customer.inversionEntries[0].name).toBe("By region");
    const memberName = customer.attributes.find(
      (attribute) => attribute.id === customer.inversionEntries[0].attributeIds[0],
    )!.name;
    expect(memberName).toBe("customer id");
  });

  it("merges a new n-ary relationship, remapping participant entities by name", () => {
    const current = createSampleProject();
    const comparison = editedSample((project) => {
      const [customer, order, product] = [
        entityByName(project, "Customer")!,
        entityByName(project, "Order")!,
        entityByName(project, "Product")!,
      ];
      project.model.relationships["relationship_fulfills"] = {
        id: "relationship_fulfills",
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
    });
    const differences = compareProjects(current, comparison).filter(
      (difference) => difference.category === "relationship",
    );
    expect(differences).toHaveLength(1);

    const result = mergeDifferences(current, comparison, differences);
    expect(result.applied).toBe(1);
    const merged = Object.values(result.project.model.relationships).find(
      (relationship) => relationship.name === "fulfills",
    )!;
    expect(merged.participants).toHaveLength(3);

    // Participants point at current-model entities and attributes by name.
    const customer = entityByName(result.project, "Customer")!;
    const buyer = merged.participants!.find(
      (participant) => participant.role === "buyer",
    )!;
    expect(buyer.entityId).toBe(customer.id);
    expect(buyer.attributeId).toBe(customer.attributes[0].id);
    expect(result.project.model.entities[merged.targetEntityId]?.name).toBe("Order");
  });

  it("detects and merges n-ary participant changes", () => {
    const withNary = (cardinality: string) =>
      editedSample((project) => {
        const [customer, order, product] = [
          entityByName(project, "Customer")!,
          entityByName(project, "Order")!,
          entityByName(project, "Product")!,
        ];
        project.model.relationships["relationship_fulfills"] = {
          id: "relationship_fulfills",
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
              attributeId: null,
              role: "",
              cardinality: "exactly-one",
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
              cardinality: cardinality as never,
            },
          ],
        };
      });
    const current = withNary("one-or-many");
    const comparison = withNary("exactly-7");

    const differences = compareProjects(current, comparison).filter(
      (difference) => difference.category === "relationship",
    );
    expect(differences).toHaveLength(1);
    expect(differences[0].kind).toBe("changed");

    const result = mergeDifferences(current, comparison, differences);
    expect(result.applied).toBe(1);
    const merged = Object.values(result.project.model.relationships).find(
      (relationship) => relationship.name === "fulfills",
    )!;
    expect(merged.participants![2].cardinality).toBe("exactly-7");
  });
});

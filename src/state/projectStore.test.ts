import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "./projectStore";

describe("project model commands", () => {
  beforeEach(() => {
    useProjectStore.getState().resetSampleProject();
  });

  it("undoes and redoes canonical entity edits", () => {
    const state = useProjectStore.getState();
    const entity = Object.values(state.project.model.entities)[0];
    const originalName = entity.name;

    state.updateEntity(entity.id, { name: "Renamed entity" });
    expect(useProjectStore.getState().project.model.entities[entity.id].name).toBe(
      "Renamed entity",
    );

    expect(useProjectStore.getState().undo()).toBe(true);
    expect(useProjectStore.getState().project.model.entities[entity.id].name).toBe(
      originalName,
    );

    expect(useProjectStore.getState().redo()).toBe(true);
    expect(useProjectStore.getState().project.model.entities[entity.id].name).toBe(
      "Renamed entity",
    );
  });

  it("returns to a clean save point when an edit is undone", () => {
    const entity = Object.values(useProjectStore.getState().project.model.entities)[0];
    useProjectStore.getState().markSaved();
    useProjectStore.getState().updateEntity(entity.id, { name: "Changed" });
    expect(useProjectStore.getState().isDirty).toBe(true);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it("groups consecutive changes to the same text field", () => {
    const entity = Object.values(useProjectStore.getState().project.model.entities)[0];
    useProjectStore.getState().updateEntity(entity.id, { name: "A" });
    useProjectStore.getState().updateEntity(entity.id, { name: "AB" });
    useProjectStore.getState().updateEntity(entity.id, { name: "ABC" });

    expect(useProjectStore.getState().history.past).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.model.entities[entity.id].name).toBe(
      entity.name,
    );
  });

  it("duplicates an entity with independent attribute and identifier IDs", () => {
    const source = Object.values(useProjectStore.getState().project.model.entities)[0];
    const duplicateId = useProjectStore.getState().duplicateEntity(source.id)!;
    const duplicate = useProjectStore.getState().project.model.entities[duplicateId];

    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.attributes.map((item) => item.id)).not.toEqual(
      source.attributes.map((item) => item.id),
    );
    expect(duplicate.identifiers[0].id).not.toBe(source.identifiers[0].id);
    expect(duplicate.identifiers[0].attributeIds[0]).toBe(duplicate.attributes[0].id);
  });

  it("maintains composite and alternate identifier membership", () => {
    const entity = Object.values(useProjectStore.getState().project.model.entities)[0];
    const identifierId = useProjectStore
      .getState()
      .addIdentifier(entity.id, "alternate")!;
    const attributeIds = entity.attributes.slice(0, 2).map((item) => item.id);
    useProjectStore.getState().updateIdentifier(entity.id, identifierId, {
      name: "Business key",
      attributeIds,
    });

    const updated = useProjectStore
      .getState()
      .project.model.entities[entity.id].identifiers.find(
        (identifier) => identifier.id === identifierId,
      )!;
    expect(updated.kind).toBe("alternate");
    expect(updated.attributeIds).toEqual(attributeIds);
  });

  it("duplicates and deletes diagrams without changing model objects", () => {
    const state = useProjectStore.getState();
    const originalDiagramId = state.activeDiagramId;
    const entityCount = Object.keys(state.project.model.entities).length;
    const duplicateId = state.duplicateDiagram(originalDiagramId)!;

    expect(Object.keys(useProjectStore.getState().project.diagrams)).toHaveLength(2);
    expect(useProjectStore.getState().deleteDiagram(duplicateId)).toBe(true);
    expect(Object.keys(useProjectStore.getState().project.diagrams)).toHaveLength(1);
    expect(Object.keys(useProjectStore.getState().project.model.entities)).toHaveLength(
      entityCount,
    );
    expect(useProjectStore.getState().deleteDiagram(originalDiagramId)).toBe(false);
  });

  it("stores diagram notes, subject areas, pinning, and manual edge routing", () => {
    const state = useProjectStore.getState();
    const diagramId = state.activeDiagramId;
    const entity = Object.values(state.project.model.entities)[0];
    const relationship = Object.values(state.project.model.relationships)[0];
    const noteId = state.addDiagramNote(diagramId, { x: 10, y: 20 });
    const subjectId = state.addSubjectArea(diagramId, { x: 5, y: 6 });
    state.toggleEntityPinned(diagramId, entity.id);
    state.updateRelationshipVertices(diagramId, relationship.id, [{ x: 100, y: 120 }]);

    const diagram = useProjectStore.getState().project.diagrams[diagramId];
    expect(diagram.notes[noteId].x).toBe(10);
    expect(diagram.subjectAreas[subjectId].y).toBe(6);
    expect(diagram.entityViews[entity.id].pinned).toBe(true);
    expect(diagram.relationshipViews[relationship.id].vertices).toEqual([
      { x: 100, y: 120 },
    ]);
  });

  it("maps an existing entity relationship instead of adding an overlapping edge", () => {
    const state = useProjectStore.getState();
    const relationship = Object.values(state.project.model.relationships)[0];
    const source = state.project.model.entities[relationship.sourceEntityId];
    const target = state.project.model.entities[relationship.targetEntityId];
    const relationshipCount = Object.keys(state.project.model.relationships).length;

    const result = state.addRelationship(
      source.id,
      target.id,
      "temporary-edge-id",
      source.attributes[0].id,
      target.attributes[0].id,
    );

    const updated =
      useProjectStore.getState().project.model.relationships[relationship.id];
    expect(result).toBe(relationship.id);
    expect(
      Object.keys(useProjectStore.getState().project.model.relationships),
    ).toHaveLength(relationshipCount);
    expect(updated.sourceAttributeId).toBe(source.attributes[0].id);
    expect(updated.targetAttributeId).toBe(target.attributes[0].id);
  });

  it("supports recursive relationships", () => {
    const entity = Object.values(useProjectStore.getState().project.model.entities)[0];
    const relationshipId = useProjectStore
      .getState()
      .addRelationship(entity.id, entity.id, "relationship_recursive");

    expect(relationshipId).toBe("relationship_recursive");
    expect(
      useProjectStore.getState().project.model.relationships["relationship_recursive"]
        .sourceEntityId,
    ).toBe(entity.id);
  });

  it("creates new relationships without a placeholder label", () => {
    const state = useProjectStore.getState();
    const entities = Object.values(state.project.model.entities);
    const customer = entities.find((entity) => entity.name === "Customer")!;
    const product = entities.find((entity) => entity.name === "Product")!;

    const relationshipId = state.addRelationship(
      customer.id,
      product.id,
      "relationship_new",
    );

    expect(relationshipId).toBe("relationship_new");
    expect(
      useProjectStore.getState().project.model.relationships.relationship_new.name,
    ).toBe("");
  });

  it("rejects reconnection onto a duplicate relationship", () => {
    const state = useProjectStore.getState();
    const relationships = Object.values(state.project.model.relationships);
    const first = relationships[0];
    const second = relationships[1];

    const updated = state.updateRelationship(second.id, {
      sourceEntityId: first.sourceEntityId,
      targetEntityId: first.targetEntityId,
      sourceAttributeId: first.sourceAttributeId,
      targetAttributeId: first.targetAttributeId,
    });
    expect(updated).toBe(false);
  });

  it("creates n-ary relationships with a consistent binary projection", () => {
    const state = useProjectStore.getState();
    const entities = Object.values(state.project.model.entities);
    const [customer, order, product] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
      entities.find((entity) => entity.name === "Product")!,
    ];

    const relationshipId = state.addRelationship(
      customer.id,
      order.id,
      "relationship_nary",
      null,
      null,
      {
        name: "purchases",
        participants: [
          { entityId: customer.id, cardinality: "exactly-one" },
          {
            entityId: order.id,
            cardinality: "zero-or-many",
            role: "ordered in",
          },
          { entityId: product.id, cardinality: "one-or-many" },
        ],
      },
    );

    expect(relationshipId).toBe("relationship_nary");
    const relationship =
      useProjectStore.getState().project.model.relationships.relationship_nary;
    expect(relationship.participants).toHaveLength(3);
    expect(relationship.sourceEntityId).toBe(customer.id);
    expect(relationship.targetEntityId).toBe(order.id);
    expect(relationship.targetRole).toBe("ordered in");
  });

  it("rejects participants that reference missing entities or attributes", () => {
    const state = useProjectStore.getState();
    const entities = Object.values(state.project.model.entities);
    const [customer, order] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
    ];

    expect(
      state.addRelationship(customer.id, order.id, "rel_bad_1", null, null, {
        participants: [
          { entityId: customer.id },
          { entityId: order.id },
          { entityId: "entity_missing" },
        ],
      }),
    ).toBeNull();
    expect(
      state.addRelationship(customer.id, order.id, "rel_bad_2", null, null, {
        participants: [
          { entityId: customer.id },
          { entityId: order.id },
          { entityId: order.id, attributeId: "attribute_missing" },
        ],
      }),
    ).toBeNull();
  });

  it("collapses an n-ary relationship to binary at two participants", () => {
    const state = useProjectStore.getState();
    const entities = Object.values(state.project.model.entities);
    const [customer, order, product] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
      entities.find((entity) => entity.name === "Product")!,
    ];
    const relationshipId = state.addRelationship(
      customer.id,
      order.id,
      "relationship_collapse",
      null,
      null,
      {
        participants: [
          { entityId: customer.id, cardinality: "exactly-one" },
          { entityId: order.id, cardinality: "zero-or-many" },
          { entityId: product.id, cardinality: "one-or-many" },
        ],
      },
    )!;

    const third =
      useProjectStore.getState().project.model.relationships[relationshipId]
        .participants![2];
    const applied = useProjectStore.getState().setRelationshipParticipants(
      relationshipId,
      useProjectStore
        .getState()
        .project.model.relationships[relationshipId].participants!.filter(
          (participant) => participant.id !== third.id,
        ),
    );

    expect(applied).toBe(true);
    const collapsed =
      useProjectStore.getState().project.model.relationships[relationshipId];
    expect(collapsed.participants).toBeUndefined();
    expect(collapsed.sourceEntityId).toBe(customer.id);
    expect(collapsed.targetEntityId).toBe(order.id);
    expect(collapsed.targetCardinality).toBe("zero-or-many");
  });

  it("removes deleted entities from participants and deletes degenerate relationships", () => {
    const state = useProjectStore.getState();
    const entities = Object.values(state.project.model.entities);
    const [customer, order, product] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
      entities.find((entity) => entity.name === "Product")!,
    ];
    const naryId = state.addRelationship(
      customer.id,
      order.id,
      "relationship_survives",
      null,
      null,
      {
        participants: [
          { entityId: customer.id },
          { entityId: order.id },
          { entityId: product.id },
          { entityId: customer.id, role: "repeat" },
        ],
      },
    )!;

    useProjectStore.getState().deleteEntity(product.id);
    const afterDelete = useProjectStore.getState().project.model.relationships[naryId];
    expect(afterDelete.participants).toHaveLength(3);
    expect(
      afterDelete.participants!.every(
        (participant) => participant.entityId !== product.id,
      ),
    ).toBe(true);
    // Binary projection re-synced to the new first two participants.
    expect(afterDelete.sourceEntityId).toBe(customer.id);
    expect(afterDelete.targetEntityId).toBe(order.id);

    useProjectStore.getState().deleteEntity(customer.id);
    expect(
      useProjectStore.getState().project.model.relationships[naryId],
    ).toBeUndefined();
  });

  it("stores and clears n-ary hub positions per diagram", () => {
    const state = useProjectStore.getState();
    const entities = Object.values(state.project.model.entities);
    const [customer, order, product] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
      entities.find((entity) => entity.name === "Product")!,
    ];
    const relationshipId = state.addRelationship(
      customer.id,
      order.id,
      "relationship_hub",
      null,
      null,
      {
        participants: [
          { entityId: customer.id },
          { entityId: order.id },
          { entityId: product.id },
        ],
      },
    )!;
    const diagramId = state.activeDiagramId;

    useProjectStore
      .getState()
      .updateRelationshipHub(diagramId, relationshipId, { x: 320.4, y: 180.6 });
    expect(
      useProjectStore.getState().project.diagrams[diagramId].relationshipViews[
        relationshipId
      ].hub,
    ).toEqual({ x: 320, y: 181 });

    useProjectStore.getState().updateRelationshipHub(diagramId, relationshipId, null);
    expect(
      useProjectStore.getState().project.diagrams[diagramId].relationshipViews[
        relationshipId
      ].hub,
    ).toBeUndefined();
  });

  it("bulk-adds imported attribute drafts as a single undoable command", () => {
    const state = useProjectStore.getState();
    const entity = Object.values(state.project.model.entities)[0];
    const attributeCount = entity.attributes.length;
    const historyDepth = state.history.past.length;

    const ids = state.addAttributes(entity.id, [
      {
        name: "loyalty tier",
        logicalType: "Text",
        description: "Rewards level.",
        isRequired: false,
        isIdentifier: false,
      },
      {
        name: "joined at",
        logicalType: "Date",
        description: "",
        isRequired: true,
        isIdentifier: false,
      },
    ]);

    const updated = useProjectStore.getState().project.model.entities[entity.id];
    expect(ids).toHaveLength(2);
    expect(updated.attributes).toHaveLength(attributeCount + 2);
    expect(updated.attributes[attributeCount].name).toBe("loyalty tier");
    expect(updated.attributes[attributeCount + 1].isRequired).toBe(true);
    expect(useProjectStore.getState().history.past).toHaveLength(historyDepth + 1);

    useProjectStore.getState().undo();
    expect(
      useProjectStore.getState().project.model.entities[entity.id].attributes,
    ).toHaveLength(attributeCount);
  });

  it("inserts imported attributes after a chosen attribute", () => {
    const state = useProjectStore.getState();
    const entity = Object.values(state.project.model.entities)[0];

    state.addAttributes(
      entity.id,
      [
        {
          name: "inserted",
          logicalType: "Text",
          description: "",
          isRequired: false,
          isIdentifier: false,
        },
      ],
      entity.attributes[0].id,
    );

    const updated = useProjectStore.getState().project.model.entities[entity.id];
    expect(updated.attributes[1].name).toBe("inserted");
  });

  it("adds imported key attributes to the primary identifier", () => {
    const state = useProjectStore.getState();
    const entity = Object.values(state.project.model.entities)[0];

    const ids = state.addAttributes(entity.id, [
      {
        name: "tenant id",
        logicalType: "Identifier",
        description: "",
        isRequired: true,
        isIdentifier: true,
      },
    ]);

    const updated = useProjectStore.getState().project.model.entities[entity.id];
    const primary = updated.identifiers.find(
      (identifier) => identifier.kind === "primary",
    )!;
    expect(primary.attributeIds).toContain(ids[0]);
    expect(
      updated.attributes.find((attribute) => attribute.id === ids[0])?.isIdentifier,
    ).toBe(true);
  });

  it("creates an entity with imported attributes in one command", () => {
    const state = useProjectStore.getState();
    const entityId = state.addEntityWithAttributes("Invoice", [
      {
        name: "invoice id",
        logicalType: "Identifier",
        description: "",
        isRequired: true,
        isIdentifier: true,
      },
      {
        name: "total",
        logicalType: "Decimal",
        description: "",
        isRequired: true,
        isIdentifier: false,
      },
    ]);

    const current = useProjectStore.getState();
    const entity = current.project.model.entities[entityId];
    expect(entity.name).toBe("Invoice");
    expect(entity.attributes).toHaveLength(2);
    expect(entity.identifiers[0].attributeIds).toEqual([entity.attributes[0].id]);
    expect(
      current.project.diagrams[current.activeDiagramId].entityViews[entityId],
    ).toBeDefined();
    expect(current.selection).toEqual({ kind: "entity", id: entityId });
  });

  it("clears relationship and identifier mappings when an attribute is deleted", () => {
    const state = useProjectStore.getState();
    const relationship = Object.values(state.project.model.relationships)[0];
    const source = state.project.model.entities[relationship.sourceEntityId];
    const target = state.project.model.entities[relationship.targetEntityId];
    state.updateRelationship(relationship.id, {
      sourceAttributeId: source.attributes[0].id,
      targetAttributeId: target.attributes[0].id,
    });

    useProjectStore.getState().deleteAttribute(source.id, source.attributes[0].id);

    const current = useProjectStore.getState();
    const updated = current.project.model.relationships[relationship.id];
    expect(updated.sourceAttributeId).toBeNull();
    expect(updated.targetAttributeId).toBe(target.attributes[0].id);
    expect(
      current.project.model.entities[source.id].identifiers.some((identifier) =>
        identifier.attributeIds.includes(source.attributes[0].id),
      ),
    ).toBe(false);
  });

  it("creates an attached comment that follows the entity when it moves", () => {
    const state = useProjectStore.getState();
    const diagramId = state.activeDiagramId;
    const entity = Object.values(state.project.model.entities)[0];
    const view = state.project.diagrams[diagramId].entityViews[entity.id];

    const noteId = useProjectStore
      .getState()
      .addDiagramNote(diagramId, undefined, entity.id);
    const created =
      useProjectStore.getState().project.diagrams[diagramId].notes[noteId];
    expect(created.entityId).toBe(entity.id);
    expect(created.x).toBe(view.x + 300);
    expect(useProjectStore.getState().selection).toEqual({
      kind: "note",
      id: noteId,
    });

    useProjectStore.getState().updateEntityPosition(diagramId, entity.id, {
      x: view.x + 55,
      y: view.y + 35,
    });
    const moved = useProjectStore.getState().project.diagrams[diagramId].notes[noteId];
    expect(moved.x).toBe(created.x + 55);
    expect(moved.y).toBe(created.y + 35);
  });

  it("shifts attached comments on batch position updates and detaches via updateDiagramNote", () => {
    const state = useProjectStore.getState();
    const diagramId = state.activeDiagramId;
    const entity = Object.values(state.project.model.entities)[0];
    const view = state.project.diagrams[diagramId].entityViews[entity.id];
    const noteId = useProjectStore
      .getState()
      .addDiagramNote(diagramId, undefined, entity.id);
    const created =
      useProjectStore.getState().project.diagrams[diagramId].notes[noteId];

    useProjectStore
      .getState()
      .updateEntityPositions(diagramId, { [entity.id]: { x: 9, y: 9 } });
    const moved = useProjectStore.getState().project.diagrams[diagramId].notes[noteId];
    expect(moved.x).toBe(created.x + (9 - view.x));
    expect(moved.y).toBe(created.y + (9 - view.y));

    useProjectStore.getState().updateDiagramNote(diagramId, noteId, {
      entityId: undefined,
    });
    expect(
      useProjectStore.getState().project.diagrams[diagramId].notes[noteId].entityId,
    ).toBeUndefined();
  });

  it("removes attached comments when their entity is deleted", () => {
    const state = useProjectStore.getState();
    const diagramId = state.activeDiagramId;
    const entity = Object.values(state.project.model.entities)[0];
    const noteId = useProjectStore
      .getState()
      .addDiagramNote(diagramId, undefined, entity.id);

    useProjectStore.getState().deleteEntity(entity.id);

    expect(
      useProjectStore.getState().project.diagrams[diagramId].notes[noteId],
    ).toBeUndefined();
  });

  it("creates identifying relationships for import drafts that reference entities", () => {
    const state = useProjectStore.getState();
    const customer = Object.values(state.project.model.entities).find(
      (entity) => entity.name === "Customer",
    )!;
    const order = Object.values(state.project.model.entities).find(
      (entity) => entity.name === "Order",
    )!;
    const relationshipsBefore = new Set(Object.keys(state.project.model.relationships));

    const [attributeId] = useProjectStore.getState().addAttributes(order.id, [
      {
        name: "customer ref",
        logicalType: "Identifier",
        description: "",
        isRequired: true,
        isIdentifier: false,
        referencesEntityId: customer.id,
      },
    ]);

    const created = Object.values(
      useProjectStore.getState().project.model.relationships,
    ).find((relationship) => !relationshipsBefore.has(relationship.id))!;
    expect(created.sourceEntityId).toBe(customer.id);
    expect(created.targetEntityId).toBe(order.id);
    expect(created.sourceAttributeId).toBe(customer.identifiers[0].attributeIds[0]);
    expect(created.targetAttributeId).toBe(attributeId);

    // One history entry covers attributes and relationships together.
    useProjectStore.getState().undo();
    const restored = useProjectStore.getState();
    expect(
      Object.values(restored.project.model.relationships).some(
        (relationship) => !relationshipsBefore.has(relationship.id),
      ),
    ).toBe(false);
    expect(
      restored.project.model.entities[order.id].attributes.some(
        (attribute) => attribute.id === attributeId,
      ),
    ).toBe(false);
  });

  it("reorders attributes as a single undoable command", () => {
    const state = useProjectStore.getState();
    const entity = Object.values(state.project.model.entities)[0];
    const reversed = entity.attributes.map((attribute) => attribute.id).reverse();

    useProjectStore.getState().reorderAttributes(entity.id, reversed);
    expect(
      useProjectStore
        .getState()
        .project.model.entities[entity.id].attributes.map((attribute) => attribute.id),
    ).toEqual(reversed);

    useProjectStore.getState().undo();
    expect(
      useProjectStore
        .getState()
        .project.model.entities[entity.id].attributes.map((attribute) => attribute.id),
    ).toEqual(entity.attributes.map((attribute) => attribute.id));
  });

  it("rejects reorder permutations that do not match the attribute set", () => {
    const state = useProjectStore.getState();
    const entity = Object.values(state.project.model.entities)[0];
    const ids = entity.attributes.map((attribute) => attribute.id);

    useProjectStore
      .getState()
      .reorderAttributes(entity.id, [...ids.slice(1), "attr_unknown"]);
    expect(
      useProjectStore
        .getState()
        .project.model.entities[entity.id].attributes.map((attribute) => attribute.id),
    ).toEqual(ids);
  });
});

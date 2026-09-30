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
});

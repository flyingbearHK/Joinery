import { describe, expect, it } from "vitest";
import { calculateAutoLayout } from "../diagram/autoLayout";
import { createAttribute, createSampleProject } from "./project";

describe("Joinery project model", () => {
  it("creates a sample project with valid entity and relationship references", () => {
    const project = createSampleProject();
    const entityIds = new Set(Object.keys(project.model.entities));

    expect(entityIds.size).toBe(4);
    expect(Object.keys(project.diagrams)).toHaveLength(1);

    Object.values(project.model.relationships).forEach((relationship) => {
      expect(entityIds.has(relationship.sourceEntityId)).toBe(true);
      expect(entityIds.has(relationship.targetEntityId)).toBe(true);
    });

    Object.values(project.diagrams).forEach((diagram) => {
      Object.keys(diagram.entityViews).forEach((entityId) => {
        expect(entityIds.has(entityId)).toBe(true);
      });
    });
  });

  it("creates stable, distinct IDs for new attributes", () => {
    const first = createAttribute();
    const second = createAttribute();

    expect(first.id).toMatch(/^attribute_/);
    expect(second.id).toMatch(/^attribute_/);
    expect(first.id).not.toBe(second.id);
  });

  it("calculates a position for every visible entity", async () => {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const positions = await calculateAutoLayout(project, diagram);

    expect(Object.keys(positions).sort()).toEqual(
      Object.keys(diagram.entityViews).sort(),
    );
    Object.values(positions).forEach((position) => {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    });
  });
});

import { describe, expect, it } from "vitest";
import type { Edge } from "@antv/x6";
import { createSampleProject } from "../domain/project";
import {
  attributeIdFromPort,
  attributePortId,
  createRelationshipEdgeMetadata,
} from "./shapes";

describe("attribute relationship ports", () => {
  it("round-trips attribute IDs safely", () => {
    const attributeId = "attribute/customer email";
    const portId = attributePortId(attributeId, "right");

    expect(attributeIdFromPort(portId)).toBe(attributeId);
    expect(attributeIdFromPort("right")).toBeNull();
  });

  it("anchors mapped relationships to attribute rows", () => {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const relationship = Object.values(project.model.relationships)[0];
    const source = project.model.entities[relationship.sourceEntityId];
    const target = project.model.entities[relationship.targetEntityId];
    relationship.sourceAttributeId = source.attributes[0].id;
    relationship.targetAttributeId = target.attributes[0].id;

    const metadata = createRelationshipEdgeMetadata(relationship, project, diagram);
    const sourceTerminal = metadata.source as Edge.TerminalCellData;
    const targetTerminal = metadata.target as Edge.TerminalCellData;

    expect(attributeIdFromPort(sourceTerminal.port)).toBe(source.attributes[0].id);
    expect(attributeIdFromPort(targetTerminal.port)).toBe(target.attributes[0].id);
  });

  it("renders inheritance with a hollow triangle instead of cardinality markers", () => {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const relationship = Object.values(project.model.relationships)[0];
    relationship.kind = "inheritance";

    const metadata = createRelationshipEdgeMetadata(relationship, project, diagram);
    const line = metadata.attrs?.line as {
      sourceMarker?: unknown;
      targetMarker?: { name?: string; open?: boolean };
    };
    expect(line.sourceMarker).toBeNull();
    expect(line.targetMarker).toMatchObject({ name: "block", open: true });
  });

  it("falls back to entity ports when an entity is collapsed", () => {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const relationship = Object.values(project.model.relationships)[0];
    const source = project.model.entities[relationship.sourceEntityId];
    relationship.sourceAttributeId = source.attributes[0].id;
    diagram.entityViews[source.id].collapsed = true;

    const metadata = createRelationshipEdgeMetadata(relationship, project, diagram);
    const sourceTerminal = metadata.source as Edge.TerminalCellData;

    expect(attributeIdFromPort(sourceTerminal.port)).toBeNull();
  });
});

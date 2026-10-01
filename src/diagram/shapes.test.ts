import { describe, expect, it } from "vitest";
import type { Edge } from "@antv/x6";
import { createSampleProject } from "../domain/project";
import {
  attributeIdFromPort,
  attributePortId,
  createNaryLegMetadata,
  createRelationshipEdgeMetadata,
  createRelationshipHubMetadata,
  relationshipHubId,
  relationshipIdFromCellId,
  relationshipLegId,
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

  it("labels exact-N endpoints with their count", () => {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const relationship = Object.values(project.model.relationships)[0];
    relationship.kind = "association";
    relationship.targetCardinality = "exactly-5";

    const metadata = createRelationshipEdgeMetadata(relationship, project, diagram);
    const labels = (metadata.labels ?? []) as Array<{
      position?: { distance?: number };
      attrs?: { label?: { text?: string } };
    }>;
    const countLabel = labels.find((label) => label.attrs?.label?.text === "(5)");
    expect(countLabel?.position).toMatchObject({ distance: -30 });
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

describe("n-ary relationship cells", () => {
  function sampleWithNary() {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const entities = Object.values(project.model.entities);
    const [customer, order, product] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
      entities.find((entity) => entity.name === "Product")!,
    ];
    const relationship = {
      ...Object.values(project.model.relationships)[0],
      id: "rel_nary",
      name: "fulfills",
      kind: "association" as const,
      sourceEntityId: customer.id,
      targetEntityId: order.id,
      participants: [
        {
          id: "p1",
          entityId: customer.id,
          attributeId: null,
          role: "buyer",
          cardinality: "exactly-one" as const,
        },
        {
          id: "p2",
          entityId: order.id,
          attributeId: null,
          role: "",
          cardinality: "exactly-3" as const,
        },
        {
          id: "p3",
          entityId: product.id,
          attributeId: null,
          role: "",
          cardinality: "one-or-many" as const,
        },
      ],
    };
    project.model.relationships[relationship.id] = relationship;
    return { project, diagram, relationship, customer, order, product };
  }

  it("maps hub and leg cell ids back to the relationship", () => {
    expect(relationshipIdFromCellId("rel_nary__hub")).toBe("rel_nary");
    expect(relationshipIdFromCellId("rel_nary__leg__p2")).toBe("rel_nary");
    expect(relationshipIdFromCellId("rel_plain")).toBe("rel_plain");
  });

  it("centers the hub on participants or honors the stored position", () => {
    const { project, diagram, relationship } = sampleWithNary();
    const metadata = createRelationshipHubMetadata(
      relationship,
      diagram,
      project.model.entities,
    );
    expect(metadata.id).toBe(relationshipHubId(relationship.id));
    expect(metadata.data?.kind).toBe("relationship-hub");

    diagram.relationshipViews[relationship.id] = {
      vertices: [],
      hub: { x: 500, y: 400 },
    };
    const pinned = createRelationshipHubMetadata(
      relationship,
      diagram,
      project.model.entities,
    );
    expect(pinned.x).toBe(500 - (pinned.width as number) / 2);
    expect(pinned.y).toBe(400 - (pinned.height as number) / 2);
  });

  it("creates one leg per participant with the participant cardinality marker", () => {
    const { project, diagram, relationship } = sampleWithNary();
    const legs = relationship.participants!.map((participant) =>
      createNaryLegMetadata(relationship, participant, project, diagram),
    );
    expect(legs).toHaveLength(3);
    legs.forEach((leg, index) => {
      expect(leg.id).toBe(
        relationshipLegId(relationship.id, relationship.participants![index].id),
      );
      expect((leg.target as Edge.TerminalCellData).cell).toBe(
        relationshipHubId(relationship.id),
      );
      expect(leg.data?.kind).toBe("relationship");
    });
    // The exact-N participant carries a count label.
    const exactLeg = legs[1];
    const labels = (exactLeg.labels ?? []) as Array<{
      attrs?: { label?: { text?: string } };
    }>;
    expect(labels.some((label) => label.attrs?.label?.text === "(3)")).toBe(true);
    // The first participant carries its role label.
    const roleLabels = (legs[0].labels ?? []) as Array<{
      attrs?: { label?: { text?: string } };
    }>;
    expect(roleLabels.some((label) => label.attrs?.label?.text === "buyer")).toBe(true);
  });
});

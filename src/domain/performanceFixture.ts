import {
  PROJECT_FILE_TYPE,
  PROJECT_FORMAT_VERSION,
  type Entity,
  type JoineryProject,
  type Relationship,
} from "./model";

export function createPerformanceFixture(
  entityCount = 100,
  relationshipCount = 200,
): JoineryProject {
  const entities: Record<string, Entity> = {};
  const entityViews: JoineryProject["diagrams"][string]["entityViews"] = {};

  for (let index = 0; index < entityCount; index += 1) {
    const entityId = `perf_entity_${index}`;
    const identifierAttributeId = `perf_attribute_${index}_id`;
    entities[entityId] = {
      id: entityId,
      name: `Entity ${String(index + 1).padStart(3, "0")}`,
      description: "Generated performance entity.",
      color: "#29243d",
      attributes: [
        {
          id: identifierAttributeId,
          name: "identifier",
          logicalType: "Identifier",
          description: "",
          isRequired: true,
          isIdentifier: true,
        },
        ...Array.from({ length: 5 }, (_, attributeIndex) => ({
          id: `perf_attribute_${index}_${attributeIndex}`,
          name: `attribute ${attributeIndex + 1}`,
          logicalType: attributeIndex % 2 === 0 ? "Text" : "Number",
          description: "",
          isRequired: attributeIndex % 2 === 0,
          isIdentifier: false,
        })),
      ],
      identifiers: [
        {
          id: `perf_identifier_${index}`,
          name: "Primary identifier",
          kind: "primary",
          attributeIds: [identifierAttributeId],
        },
      ],
    };
    entityViews[entityId] = {
      x: 64 + (index % 10) * 320,
      y: 64 + Math.floor(index / 10) * 280,
      collapsed: false,
      pinned: false,
    };
  }

  const relationships: Record<string, Relationship> = {};
  for (let index = 0; index < relationshipCount; index += 1) {
    const sourceIndex = index % entityCount;
    let targetIndex = (index * 17 + 7) % entityCount;
    if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % entityCount;
    const relationshipId = `perf_relationship_${index}`;
    relationships[relationshipId] = {
      id: relationshipId,
      name: `relationship ${index + 1}`,
      description: "Generated performance relationship.",
      kind: "association",
      sourceRole: "source",
      targetRole: "target",
      sourceEntityId: `perf_entity_${sourceIndex}`,
      targetEntityId: `perf_entity_${targetIndex}`,
      sourceAttributeId: null,
      targetAttributeId: null,
      sourceCardinality: "exactly-one",
      targetCardinality: "zero-or-many",
      isIdentifying: false,
    };
  }

  const now = new Date().toISOString();
  return {
    fileType: PROJECT_FILE_TYPE,
    formatVersion: PROJECT_FORMAT_VERSION,
    id: "performance_project",
    name: "100 entity performance fixture",
    description: "Deterministic stress model for Joinery.",
    settings: { namingConvention: "none", requireDescriptions: false },
    createdAt: now,
    updatedAt: now,
    model: { entities, relationships, logicalTypes: {} },
    diagrams: {
      performance_diagram: {
        id: "performance_diagram",
        name: "Performance",
        description: "",
        entityViews,
        relationshipViews: {},
        notes: {},
        subjectAreas: {},
      },
    },
  };
}

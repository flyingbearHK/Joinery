import type { Entity, JoineryProject, Relationship } from "./model";

export type DifferenceKind = "added" | "removed" | "changed";

export interface ModelDifference {
  id: string;
  kind: DifferenceKind;
  category: "project" | "entity" | "attribute" | "relationship" | "logical-type";
  title: string;
  detail: string;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function entitySignature(entity: Entity): string {
  return JSON.stringify({
    description: entity.description,
    color: entity.color,
    identifiers: entity.identifiers.map((identifier) => ({
      name: identifier.name,
      kind: identifier.kind,
      attributes: identifier.attributeIds
        .map(
          (attributeId) =>
            entity.attributes.find((attribute) => attribute.id === attributeId)?.name ??
            attributeId,
        )
        .sort(),
    })),
  });
}

function relationshipKey(relationship: Relationship, project: JoineryProject): string {
  const source = normalized(
    project.model.entities[relationship.sourceEntityId]?.name ??
      relationship.sourceEntityId,
  );
  const target = normalized(
    project.model.entities[relationship.targetEntityId]?.name ??
      relationship.targetEntityId,
  );
  return `${source}|${target}|${normalized(relationship.name)}`;
}

export function compareProjects(
  current: JoineryProject,
  comparison: JoineryProject,
): ModelDifference[] {
  const differences: ModelDifference[] = [];
  if (JSON.stringify(current.settings) !== JSON.stringify(comparison.settings)) {
    differences.push({
      id: "project-settings",
      kind: "changed",
      category: "project",
      title: "Model standards changed",
      detail: "Naming or documentation requirements differ.",
    });
  }
  const currentEntities = new Map(
    Object.values(current.model.entities).map((entity) => [
      normalized(entity.name),
      entity,
    ]),
  );
  const comparisonEntities = new Map(
    Object.values(comparison.model.entities).map((entity) => [
      normalized(entity.name),
      entity,
    ]),
  );

  comparisonEntities.forEach((entity, key) => {
    const existing = currentEntities.get(key);
    if (!existing) {
      differences.push({
        id: `entity-added-${entity.id}`,
        kind: "added",
        category: "entity",
        title: `Entity added: ${entity.name}`,
        detail: "Exists only in the comparison model.",
      });
      return;
    }
    if (entitySignature(existing) !== entitySignature(entity)) {
      differences.push({
        id: `entity-changed-${existing.id}`,
        kind: "changed",
        category: "entity",
        title: `Entity changed: ${entity.name}`,
        detail: "Description, color, or identifiers differ.",
      });
    }

    const currentAttributes = new Map(
      existing.attributes.map((attribute) => [normalized(attribute.name), attribute]),
    );
    const comparisonAttributes = new Map(
      entity.attributes.map((attribute) => [normalized(attribute.name), attribute]),
    );
    comparisonAttributes.forEach((attribute, attributeKey) => {
      const currentAttribute = currentAttributes.get(attributeKey);
      if (!currentAttribute) {
        differences.push({
          id: `attribute-added-${entity.id}-${attribute.id}`,
          kind: "added",
          category: "attribute",
          title: `${entity.name}.${attribute.name} added`,
          detail: "Attribute exists only in the comparison model.",
        });
      } else if (
        currentAttribute.logicalType !== attribute.logicalType ||
        currentAttribute.isRequired !== attribute.isRequired ||
        currentAttribute.description !== attribute.description
      ) {
        differences.push({
          id: `attribute-changed-${entity.id}-${attribute.id}`,
          kind: "changed",
          category: "attribute",
          title: `${entity.name}.${attribute.name} changed`,
          detail: "Logical type, optionality, or description differs.",
        });
      }
    });
    currentAttributes.forEach((attribute, attributeKey) => {
      if (!comparisonAttributes.has(attributeKey)) {
        differences.push({
          id: `attribute-removed-${existing.id}-${attribute.id}`,
          kind: "removed",
          category: "attribute",
          title: `${existing.name}.${attribute.name} removed`,
          detail: "Attribute exists only in the current model.",
        });
      }
    });
  });

  currentEntities.forEach((entity, key) => {
    if (!comparisonEntities.has(key)) {
      differences.push({
        id: `entity-removed-${entity.id}`,
        kind: "removed",
        category: "entity",
        title: `Entity removed: ${entity.name}`,
        detail: "Exists only in the current model.",
      });
    }
  });

  const currentTypes = new Map(
    Object.values(current.model.logicalTypes).map((logicalType) => [
      normalized(logicalType.name),
      logicalType,
    ]),
  );
  const comparisonTypes = new Map(
    Object.values(comparison.model.logicalTypes).map((logicalType) => [
      normalized(logicalType.name),
      logicalType,
    ]),
  );
  comparisonTypes.forEach((logicalType, key) => {
    const existing = currentTypes.get(key);
    if (!existing) {
      differences.push({
        id: `logical-type-added-${logicalType.id}`,
        kind: "added",
        category: "logical-type",
        title: `Logical type added: ${logicalType.name}`,
        detail: "Exists only in the comparison model.",
      });
    } else if (
      existing.baseType !== logicalType.baseType ||
      existing.format !== logicalType.format ||
      existing.description !== logicalType.description
    ) {
      differences.push({
        id: `logical-type-changed-${logicalType.id}`,
        kind: "changed",
        category: "logical-type",
        title: `Logical type changed: ${logicalType.name}`,
        detail: "Base type, format, or description differs.",
      });
    }
  });
  currentTypes.forEach((logicalType, key) => {
    if (!comparisonTypes.has(key)) {
      differences.push({
        id: `logical-type-removed-${logicalType.id}`,
        kind: "removed",
        category: "logical-type",
        title: `Logical type removed: ${logicalType.name}`,
        detail: "Exists only in the current model.",
      });
    }
  });

  const currentRelationships = new Map(
    Object.values(current.model.relationships).map((relationship) => [
      relationshipKey(relationship, current),
      relationship,
    ]),
  );
  const comparisonRelationships = new Map(
    Object.values(comparison.model.relationships).map((relationship) => [
      relationshipKey(relationship, comparison),
      relationship,
    ]),
  );
  comparisonRelationships.forEach((relationship, key) => {
    const existing = currentRelationships.get(key);
    if (!existing) {
      differences.push({
        id: `relationship-added-${relationship.id}`,
        kind: "added",
        category: "relationship",
        title: `Relationship added: ${relationship.name || key}`,
        detail: "Exists only in the comparison model.",
      });
    } else if (
      existing.kind !== relationship.kind ||
      existing.sourceRole !== relationship.sourceRole ||
      existing.targetRole !== relationship.targetRole ||
      existing.sourceCardinality !== relationship.sourceCardinality ||
      existing.targetCardinality !== relationship.targetCardinality ||
      existing.isIdentifying !== relationship.isIdentifying
    ) {
      differences.push({
        id: `relationship-changed-${existing.id}`,
        kind: "changed",
        category: "relationship",
        title: `Relationship changed: ${relationship.name || key}`,
        detail: "Type, role names, cardinality, or identifying semantics differ.",
      });
    }
  });
  currentRelationships.forEach((relationship, key) => {
    if (!comparisonRelationships.has(key)) {
      differences.push({
        id: `relationship-removed-${relationship.id}`,
        kind: "removed",
        category: "relationship",
        title: `Relationship removed: ${relationship.name || key}`,
        detail: "Exists only in the current model.",
      });
    }
  });

  return differences.sort((left, right) =>
    `${left.category}-${left.title}`.localeCompare(`${right.category}-${right.title}`),
  );
}

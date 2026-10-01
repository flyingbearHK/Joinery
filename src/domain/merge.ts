import { normalized, relationshipCompareKey, type ModelDifference } from "./compare";
import type {
  Attribute,
  Diagram,
  Entity,
  EntityId,
  JoineryProject,
  Relationship,
} from "./model";
import { createId, nextEntityPosition } from "./project";

export interface MergeResult {
  project: JoineryProject;
  applied: number;
  skipped: Array<{ id: string; reason: string }>;
}

function entitiesByName(project: JoineryProject): Map<string, Entity> {
  return new Map(
    Object.values(project.model.entities).map((entity) => [
      normalized(entity.name),
      entity,
    ]),
  );
}

function attributesByName(entity: Entity): Map<string, Attribute> {
  return new Map(
    entity.attributes.map((attribute) => [normalized(attribute.name), attribute]),
  );
}

function relationshipsByKey(project: JoineryProject): Map<string, Relationship> {
  return new Map(
    Object.values(project.model.relationships).map((relationship) => [
      relationshipCompareKey(relationship, project),
      relationship,
    ]),
  );
}

function syncIdentifierFlags(entity: Entity): void {
  const ids = new Set(
    entity.identifiers.flatMap((identifier) => identifier.attributeIds),
  );
  entity.attributes.forEach((attribute) => {
    attribute.isIdentifier = ids.has(attribute.id);
  });
}

/** Copies an entity, remapping all ids so it can never collide on insert. */
function cloneEntityForMerge(entity: Entity): Entity {
  const attributeIds = new Map<string, string>();
  const attributes = entity.attributes.map((attribute) => {
    const id = createId("attribute");
    attributeIds.set(attribute.id, id);
    return { ...attribute, id };
  });
  const remap = (ids: string[]) =>
    ids.map((id) => attributeIds.get(id)).filter((id): id is string => Boolean(id));
  return {
    ...entity,
    id: createId("entity"),
    attributes,
    identifiers: entity.identifiers.map((identifier) => ({
      ...identifier,
      id: createId("identifier"),
      attributeIds: remap(identifier.attributeIds),
    })),
    inversionEntries: entity.inversionEntries.map((entry) => ({
      ...entry,
      id: createId("inversion_entry"),
      attributeIds: remap(entry.attributeIds),
    })),
  };
}

function mapAttributeIds(source: Entity, target: Entity, ids: string[]): string[] {
  const targetAttrs = attributesByName(target);
  const sourceById = new Map(
    source.attributes.map((attribute) => [attribute.id, attribute]),
  );
  return ids
    .map((id) => sourceById.get(id))
    .map((attribute) =>
      attribute ? targetAttrs.get(normalized(attribute.name))?.id : undefined,
    )
    .filter((id): id is string => Boolean(id));
}

/** Maps an endpoint attribute across models by attribute name. */
function mappedEndpointAttribute(
  sourceEntity: Entity | undefined,
  targetEntity: Entity,
  sourceAttributeId: string | null,
): string | null {
  if (!sourceEntity || !sourceAttributeId) return null;
  const name = sourceEntity.attributes.find(
    (attribute) => attribute.id === sourceAttributeId,
  )?.name;
  if (!name) return null;
  return (
    targetEntity.attributes.find(
      (attribute) => normalized(attribute.name) === normalized(name),
    )?.id ?? null
  );
}

function removeEntityCascade(project: JoineryProject, entityId: EntityId): void {
  delete project.model.entities[entityId];
  const removedRelationships = new Set<string>();
  Object.values(project.model.relationships).forEach((relationship) => {
    if (relationship.participants?.length) {
      relationship.participants = relationship.participants.filter(
        (participant) => participant.entityId !== entityId,
      );
      if (relationship.participants.length < 2) {
        removedRelationships.add(relationship.id);
        delete project.model.relationships[relationship.id];
        return;
      }
      const [first, second] = relationship.participants;
      if (relationship.participants.length === 2) {
        // Collapse back to a plain binary relationship.
        delete relationship.participants;
        relationship.sourceEntityId = first.entityId;
        relationship.sourceAttributeId = first.attributeId;
        relationship.sourceRole = first.role;
        relationship.sourceCardinality = first.cardinality;
        relationship.targetEntityId = second!.entityId;
        relationship.targetAttributeId = second!.attributeId;
        relationship.targetRole = second!.role;
        relationship.targetCardinality = second!.cardinality;
        return;
      }
      relationship.sourceEntityId = first.entityId;
      relationship.sourceAttributeId = first.attributeId;
      relationship.sourceRole = first.role;
      relationship.sourceCardinality = first.cardinality;
      relationship.targetEntityId = second!.entityId;
      relationship.targetAttributeId = second!.attributeId;
      relationship.targetRole = second!.role;
      relationship.targetCardinality = second!.cardinality;
      return;
    }
    if (
      relationship.sourceEntityId === entityId ||
      relationship.targetEntityId === entityId
    ) {
      removedRelationships.add(relationship.id);
      delete project.model.relationships[relationship.id];
    }
  });
  Object.values(project.diagrams).forEach((diagram: Diagram) => {
    delete diagram.entityViews[entityId];
    removedRelationships.forEach((relationshipId) => {
      delete diagram.relationshipViews[relationshipId];
    });
  });
}

function removeAttributeCascade(entity: Entity, attributeId: string): void {
  entity.attributes = entity.attributes.filter(
    (attribute) => attribute.id !== attributeId,
  );
  entity.identifiers.forEach((identifier) => {
    identifier.attributeIds = identifier.attributeIds.filter(
      (id) => id !== attributeId,
    );
  });
  entity.identifiers = entity.identifiers.filter(
    (identifier) => identifier.attributeIds.length > 0,
  );
  entity.inversionEntries.forEach((entry) => {
    entry.attributeIds = entry.attributeIds.filter((id) => id !== attributeId);
  });
  entity.inversionEntries = entity.inversionEntries.filter(
    (entry) => entry.attributeIds.length > 0,
  );
}

/**
 * Applies a selected subset of `compareProjects` differences to `current`,
 * matching objects by logical name rather than internal ID. Returns a new
 * project — the caller is responsible for history recording.
 */
export function mergeDifferences(
  current: JoineryProject,
  comparison: JoineryProject,
  differences: ModelDifference[],
  activeDiagramId?: string,
): MergeResult {
  const project = structuredClone(current);
  const diagram =
    (activeDiagramId && project.diagrams[activeDiagramId]) ||
    Object.values(project.diagrams)[0];
  const skipped: MergeResult["skipped"] = [];
  let applied = 0;

  const currentEntities = entitiesByName(project);
  const comparisonEntities = entitiesByName(comparison);

  const resolveComparisonEntity = (name?: string) =>
    name === undefined ? undefined : comparisonEntities.get(name);

  for (const difference of differences) {
    const ref = difference.ref ?? {};
    const entity = ref.entityName ? currentEntities.get(ref.entityName) : undefined;
    const comparisonEntity = resolveComparisonEntity(ref.entityName);

    if (
      difference.category === "entity" &&
      difference.kind === "added" &&
      comparisonEntity
    ) {
      if (project.model.entities[comparisonEntity.id]) {
        // Rare: identical internal IDs across files — remap to be safe.
        const clone = cloneEntityForMerge(comparisonEntity);
        project.model.entities[clone.id] = clone;
        diagram.entityViews[clone.id] = {
          ...nextEntityPosition(diagram),
          collapsed: false,
          pinned: false,
        };
        currentEntities.set(ref.entityName!, clone);
      } else {
        const clone = structuredClone(comparisonEntity);
        project.model.entities[clone.id] = clone;
        diagram.entityViews[clone.id] = {
          ...nextEntityPosition(diagram),
          collapsed: false,
          pinned: false,
        };
        currentEntities.set(ref.entityName!, clone);
      }
      applied += 1;
      continue;
    }

    if (difference.category === "entity" && difference.kind === "removed") {
      if (!entity) {
        skipped.push({ id: difference.id, reason: "Entity not found." });
        continue;
      }
      removeEntityCascade(project, entity.id);
      currentEntities.delete(ref.entityName!);
      applied += 1;
      continue;
    }

    if (
      difference.category === "entity" &&
      difference.kind === "changed" &&
      comparisonEntity
    ) {
      if (!entity) {
        skipped.push({ id: difference.id, reason: "Entity not found." });
        continue;
      }
      entity.description = comparisonEntity.description;
      entity.color = comparisonEntity.color;
      const keepId = <T extends { id: string; name: string }>(
        list: T[],
        name: string,
        fallback: string,
      ) =>
        list.find((item) => normalized(item.name) === normalized(name))?.id ??
        createId(fallback);
      entity.identifiers = comparisonEntity.identifiers
        .map((identifier) => ({
          ...identifier,
          id: keepId(entity.identifiers, identifier.name, "identifier"),
          attributeIds: mapAttributeIds(
            comparisonEntity,
            entity,
            identifier.attributeIds,
          ),
        }))
        .filter((identifier) => identifier.attributeIds.length > 0);
      entity.inversionEntries = comparisonEntity.inversionEntries
        .map((entry) => ({
          ...entry,
          id: keepId(entity.inversionEntries, entry.name, "inversion_entry"),
          attributeIds: mapAttributeIds(comparisonEntity, entity, entry.attributeIds),
        }))
        .filter((entry) => entry.attributeIds.length > 0);
      syncIdentifierFlags(entity);
      applied += 1;
      continue;
    }

    if (difference.category === "attribute" && comparisonEntity) {
      if (!entity) {
        skipped.push({
          id: difference.id,
          reason: "The attribute's entity is not in the model.",
        });
        continue;
      }
      const sourceAttribute = attributesByName(comparisonEntity).get(
        ref.attributeName ?? "",
      );
      const targetAttribute = ref.attributeName
        ? attributesByName(entity).get(ref.attributeName)
        : undefined;
      if (difference.kind === "added") {
        if (!sourceAttribute) {
          skipped.push({ id: difference.id, reason: "Attribute not found." });
          continue;
        }
        if (targetAttribute) {
          skipped.push({
            id: difference.id,
            reason: "An attribute with that name already exists.",
          });
          continue;
        }
        const attribute: Attribute = {
          ...structuredClone(sourceAttribute),
          id: createId("attribute"),
          isIdentifier: false,
        };
        entity.attributes.push(attribute);
        // Join the same-named identifier the attribute belonged to upstream.
        const sourceIds = new Set(
          comparisonEntity.identifiers.flatMap((identifier) => identifier.attributeIds),
        );
        if (sourceIds.has(sourceAttribute.id)) {
          const sourceIdentifier = comparisonEntity.identifiers.find((identifier) =>
            identifier.attributeIds.includes(sourceAttribute.id),
          );
          let identifier = sourceIdentifier
            ? entity.identifiers.find(
                (candidate) =>
                  normalized(candidate.name) === normalized(sourceIdentifier.name),
              )
            : undefined;
          if (!identifier) {
            identifier = entity.identifiers.find(
              (candidate) => candidate.kind === "primary",
            );
          }
          if (identifier) identifier.attributeIds.push(attribute.id);
        }
        syncIdentifierFlags(entity);
        applied += 1;
        continue;
      }
      if (!targetAttribute) {
        skipped.push({ id: difference.id, reason: "Attribute not found." });
        continue;
      }
      if (difference.kind === "removed") {
        removeAttributeCascade(entity, targetAttribute.id);
        Object.values(project.model.relationships).forEach((relationship) => {
          if (relationship.sourceAttributeId === targetAttribute.id) {
            relationship.sourceAttributeId = null;
          }
          if (relationship.targetAttributeId === targetAttribute.id) {
            relationship.targetAttributeId = null;
          }
          relationship.participants?.forEach((participant) => {
            if (participant.attributeId === targetAttribute.id) {
              participant.attributeId = null;
            }
          });
        });
        syncIdentifierFlags(entity);
        applied += 1;
        continue;
      }
      if (difference.kind === "changed" && sourceAttribute) {
        targetAttribute.logicalType = sourceAttribute.logicalType;
        targetAttribute.isRequired = sourceAttribute.isRequired;
        targetAttribute.description = sourceAttribute.description;
        applied += 1;
        continue;
      }
      skipped.push({ id: difference.id, reason: "Nothing to apply." });
      continue;
    }

    if (difference.category === "relationship") {
      const currentRelationships = relationshipsByKey(project);
      const comparisonRelationships = relationshipsByKey(comparison);
      const key = ref.relationshipKey ?? "";
      if (difference.kind === "added") {
        const source = comparisonRelationships.get(key);
        if (!source) {
          skipped.push({ id: difference.id, reason: "Relationship not found." });
          continue;
        }
        const sourceEntity = currentEntities.get(
          normalized(comparison.model.entities[source.sourceEntityId]?.name ?? ""),
        );
        const targetEntity = currentEntities.get(
          normalized(comparison.model.entities[source.targetEntityId]?.name ?? ""),
        );
        if (!sourceEntity || !targetEntity) {
          skipped.push({
            id: difference.id,
            reason: "An endpoint entity is not in the model.",
          });
          continue;
        }
        const relationship: Relationship = {
          ...structuredClone(source),
          id: project.model.relationships[source.id]
            ? createId("relationship")
            : source.id,
          sourceEntityId: sourceEntity.id,
          targetEntityId: targetEntity.id,
          sourceAttributeId: mappedEndpointAttribute(
            comparison.model.entities[source.sourceEntityId],
            sourceEntity,
            source.sourceAttributeId,
          ),
          targetAttributeId: mappedEndpointAttribute(
            comparison.model.entities[source.targetEntityId],
            targetEntity,
            source.targetAttributeId,
          ),
        };
        if (source.participants?.length) {
          const participants = source.participants.map((participant) => {
            const comparisonEntity = comparison.model.entities[participant.entityId];
            const entity = comparisonEntity
              ? currentEntities.get(normalized(comparisonEntity.name))
              : undefined;
            if (!entity) return null;
            return {
              id: createId("participant"),
              entityId: entity.id,
              attributeId: mappedEndpointAttribute(
                comparisonEntity,
                entity,
                participant.attributeId,
              ),
              role: participant.role,
              cardinality: participant.cardinality,
            };
          });
          if (participants.some((participant) => !participant)) {
            skipped.push({
              id: difference.id,
              reason: "A participant entity is not in the model.",
            });
            continue;
          }
          relationship.participants = participants as Relationship["participants"];
        }
        project.model.relationships[relationship.id] = relationship;
        applied += 1;
        continue;
      }
      const existing = currentRelationships.get(key);
      if (!existing) {
        skipped.push({ id: difference.id, reason: "Relationship not found." });
        continue;
      }
      if (difference.kind === "removed") {
        delete project.model.relationships[existing.id];
        Object.values(project.diagrams).forEach((d) => {
          delete d.relationshipViews[existing.id];
        });
        applied += 1;
        continue;
      }
      const source = comparisonRelationships.get(key);
      if (!source) {
        skipped.push({ id: difference.id, reason: "Relationship not found." });
        continue;
      }
      Object.assign(existing, {
        name: source.name,
        description: source.description,
        kind: source.kind,
        sourceRole: source.sourceRole,
        targetRole: source.targetRole,
        sourceCardinality: source.sourceCardinality,
        targetCardinality: source.targetCardinality,
        isIdentifying: source.isIdentifying,
      });
      if (source.participants?.length) {
        const participants = source.participants.map((participant) => {
          const comparisonEntity = comparison.model.entities[participant.entityId];
          const entity = comparisonEntity
            ? currentEntities.get(normalized(comparisonEntity.name))
            : undefined;
          if (!entity) return null;
          return {
            id: createId("participant"),
            entityId: entity.id,
            attributeId: mappedEndpointAttribute(
              comparisonEntity,
              entity,
              participant.attributeId,
            ),
            role: participant.role,
            cardinality: participant.cardinality,
          };
        });
        if (participants.some((participant) => !participant)) {
          skipped.push({
            id: difference.id,
            reason: "A participant entity is not in the model.",
          });
          continue;
        }
        const merged = participants as Relationship["participants"];
        existing.participants = merged;
        const [first, second] = merged!;
        existing.sourceEntityId = first!.entityId;
        existing.sourceAttributeId = first!.attributeId;
        existing.sourceRole = first!.role;
        existing.sourceCardinality = first!.cardinality;
        existing.targetEntityId = second!.entityId;
        existing.targetAttributeId = second!.attributeId;
        existing.targetRole = second!.role;
        existing.targetCardinality = second!.cardinality;
      } else {
        delete existing.participants;
      }
      applied += 1;
      continue;
    }

    if (difference.category === "logical-type") {
      const key = ref.logicalTypeName ?? "";
      const comparisonType = Object.values(comparison.model.logicalTypes).find(
        (type) => normalized(type.name) === key,
      );
      const existing = Object.values(project.model.logicalTypes).find(
        (type) => normalized(type.name) === key,
      );
      if (difference.kind === "added") {
        if (!comparisonType) {
          skipped.push({ id: difference.id, reason: "Logical type not found." });
          continue;
        }
        const clone = structuredClone(comparisonType);
        if (project.model.logicalTypes[clone.id]) clone.id = createId("type");
        project.model.logicalTypes[clone.id] = clone;
        applied += 1;
        continue;
      }
      if (!existing) {
        skipped.push({ id: difference.id, reason: "Logical type not found." });
        continue;
      }
      if (difference.kind === "removed") {
        delete project.model.logicalTypes[existing.id];
        applied += 1;
        continue;
      }
      if (comparisonType) {
        Object.assign(existing, {
          baseType: comparisonType.baseType,
          format: comparisonType.format,
          description: comparisonType.description,
        });
        applied += 1;
      }
      continue;
    }

    if (difference.category === "project") {
      project.settings = structuredClone(comparison.settings);
      applied += 1;
      continue;
    }

    skipped.push({ id: difference.id, reason: "Unsupported difference." });
  }

  return { project, applied, skipped };
}

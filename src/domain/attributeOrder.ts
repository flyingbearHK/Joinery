import type { Attribute, Entity, Relationship } from "./model";
import { isNaryRelationship } from "./model";

/**
 * Bulk ordering presets for an entity's attribute list. Sorts are stable —
 * attributes that compare equal keep their existing relative order.
 */
export type AttributeSortMode = "keys-first" | "name" | "keys-then-name";

export const ATTRIBUTE_SORT_OPTIONS: ReadonlyArray<{
  value: AttributeSortMode;
  label: string;
}> = [
  { value: "keys-first", label: "Keys & FKs first" },
  { value: "name", label: "Name A–Z" },
  { value: "keys-then-name", label: "Keys, FKs, then A–Z" },
];

function identifierIds(entity: Entity): Set<string> {
  return new Set(entity.identifiers.flatMap((identifier) => identifier.attributeIds));
}

/**
 * Attributes on `entity` that act as foreign keys — i.e. the mapped endpoint
 * on the "child" side of a relationship (binary target end, or any n-ary
 * participant belonging to this entity).
 */
export function foreignKeyIds(
  entity: Entity,
  relationships: Iterable<Relationship>,
): Set<string> {
  const ids = new Set<string>();
  for (const relationship of relationships) {
    if (isNaryRelationship(relationship) && relationship.participants) {
      for (const participant of relationship.participants) {
        if (participant.entityId === entity.id && participant.attributeId) {
          ids.add(participant.attributeId);
        }
      }
    } else if (
      relationship.targetEntityId === entity.id &&
      relationship.targetAttributeId
    ) {
      ids.add(relationship.targetAttributeId);
    }
  }
  return ids;
}

/**
 * Ordering tier: identifier members first, then foreign-key attributes, then
 * everything else.
 */
function tierOf(attribute: Attribute, keyIds: Set<string>, fkIds: Set<string>): number {
  if (keyIds.has(attribute.id)) return 0;
  if (fkIds.has(attribute.id)) return 1;
  return 2;
}

export function sortAttributes(
  entity: Entity,
  mode: AttributeSortMode,
  relationships: Iterable<Relationship> = [],
): Attribute[] {
  const keyIds = identifierIds(entity);
  const fkIds = foreignKeyIds(entity, relationships);
  const byName = (a: Attribute, b: Attribute) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const byTier = (a: Attribute, b: Attribute) =>
    tierOf(a, keyIds, fkIds) - tierOf(b, keyIds, fkIds);
  const sorted = entity.attributes.slice();
  switch (mode) {
    case "keys-first":
      sorted.sort(byTier);
      break;
    case "name":
      sorted.sort(byName);
      break;
    case "keys-then-name":
      sorted.sort((a, b) => byTier(a, b) || byName(a, b));
      break;
  }
  return sorted;
}

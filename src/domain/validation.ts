import type { JoineryProject, ProjectSelection } from "./model";

export type ValidationSeverity = "error" | "warning" | "info";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function followsConvention(
  value: string,
  convention: JoineryProject["settings"]["namingConvention"],
): boolean {
  if (convention === "none" || !value.trim()) return true;
  if (convention === "pascal") return /^[A-Z][A-Za-z0-9]*$/.test(value);
  if (convention === "camel") return /^[a-z][A-Za-z0-9]*$/.test(value);
  return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(value);
}

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  title: string;
  detail: string;
  selection: ProjectSelection;
}

export function validateLogicalModel(project: JoineryProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entityNames = new Map<string, string[]>();

  Object.values(project.model.entities).forEach((entity) => {
    const normalizedName = entity.name.trim().toLocaleLowerCase();
    if (!entity.name.trim()) {
      issues.push({
        id: `entity-name-${entity.id}`,
        severity: "error",
        title: "Entity has no name",
        detail: "Every logical entity should have a meaningful name.",
        selection: { kind: "entity", id: entity.id },
      });
    } else {
      entityNames.set(normalizedName, [
        ...(entityNames.get(normalizedName) ?? []),
        entity.id,
      ]);
    }

    if (!followsConvention(entity.name, project.settings.namingConvention)) {
      issues.push({
        id: `entity-convention-${entity.id}`,
        severity: "warning",
        title: `${entity.name || "Entity"} violates the naming standard`,
        detail: `Expected ${project.settings.namingConvention} naming.`,
        selection: { kind: "entity", id: entity.id },
      });
    }
    if (project.settings.requireDescriptions && !entity.description.trim()) {
      issues.push({
        id: `entity-description-${entity.id}`,
        severity: "warning",
        title: `${entity.name || "Entity"} has no definition`,
        detail: "A business definition is required by this model's standards.",
        selection: { kind: "entity", id: entity.id },
      });
    }

    if (entity.attributes.length === 0) {
      issues.push({
        id: `entity-empty-${entity.id}`,
        severity: "warning",
        title: `${entity.name || "Untitled entity"} has no attributes`,
        detail: "Add the information that describes this entity.",
        selection: { kind: "entity", id: entity.id },
      });
    }

    const attributeNames = new Map<string, number>();
    entity.attributes.forEach((attribute) => {
      const key = attribute.name.trim().toLocaleLowerCase();
      if (!key) {
        issues.push({
          id: `attribute-name-${attribute.id}`,
          severity: "error",
          title: `${entity.name || "Entity"} has an unnamed attribute`,
          detail: "Attribute names cannot be empty.",
          selection: { kind: "entity", id: entity.id },
        });
      } else {
        attributeNames.set(key, (attributeNames.get(key) ?? 0) + 1);
      }
      if (!followsConvention(attribute.name, project.settings.namingConvention)) {
        issues.push({
          id: `attribute-convention-${attribute.id}`,
          severity: "warning",
          title: `${attribute.name || "Attribute"} violates the naming standard`,
          detail: `Expected ${project.settings.namingConvention} naming in ${entity.name || "the entity"}.`,
          selection: { kind: "entity", id: entity.id },
        });
      }
      if (project.settings.requireDescriptions && !attribute.description.trim()) {
        issues.push({
          id: `attribute-description-${attribute.id}`,
          severity: "warning",
          title: `${attribute.name || "Attribute"} has no definition`,
          detail: "An attribute definition is required by this model's standards.",
          selection: { kind: "entity", id: entity.id },
        });
      }
      if (!attribute.logicalType.trim()) {
        issues.push({
          id: `attribute-type-${attribute.id}`,
          severity: "warning",
          title: `${attribute.name || "Attribute"} has no logical type`,
          detail: `Choose a type in ${entity.name || "the entity"}.`,
          selection: { kind: "entity", id: entity.id },
        });
      }
    });

    attributeNames.forEach((count, name) => {
      if (count > 1) {
        issues.push({
          id: `attribute-duplicate-${entity.id}-${name}`,
          severity: "error",
          title: `${entity.name || "Entity"} repeats attribute “${name}”`,
          detail: "Attribute names should be unique within an entity.",
          selection: { kind: "entity", id: entity.id },
        });
      }
    });

    if (!entity.identifiers.some((identifier) => identifier.kind === "primary")) {
      issues.push({
        id: `identifier-primary-${entity.id}`,
        severity: "warning",
        title: `${entity.name || "Entity"} has no primary identifier`,
        detail: "Define how an occurrence of this entity is uniquely identified.",
        selection: { kind: "entity", id: entity.id },
      });
    }
  });

  entityNames.forEach((entityIds, name) => {
    if (entityIds.length > 1) {
      entityIds.forEach((entityId) => {
        issues.push({
          id: `entity-duplicate-${entityId}`,
          severity: "error",
          title: `Duplicate entity name “${name}”`,
          detail: "Entity names should be unique in the logical model.",
          selection: { kind: "entity", id: entityId },
        });
      });
    }
  });

  const inheritanceParents = new Map<string, string[]>();
  Object.values(project.model.relationships).forEach((relationship) => {
    if (relationship.kind === "inheritance") {
      inheritanceParents.set(relationship.sourceEntityId, [
        ...(inheritanceParents.get(relationship.sourceEntityId) ?? []),
        relationship.targetEntityId,
      ]);
    }
    if (!relationship.name.trim() && relationship.kind === "association") {
      issues.push({
        id: `relationship-name-${relationship.id}`,
        severity: "info",
        title: "Relationship has no verb phrase",
        detail: "An optional name such as “places” makes the diagram easier to read.",
        selection: { kind: "relationship", id: relationship.id },
      });
    }
    if (
      relationship.sourceAttributeId &&
      relationship.targetAttributeId &&
      relationship.kind === "association"
    ) {
      const sourceAttribute = project.model.entities[
        relationship.sourceEntityId
      ]?.attributes.find(
        (attribute) => attribute.id === relationship.sourceAttributeId,
      );
      const targetAttribute = project.model.entities[
        relationship.targetEntityId
      ]?.attributes.find(
        (attribute) => attribute.id === relationship.targetAttributeId,
      );
      if (
        sourceAttribute &&
        targetAttribute &&
        normalized(sourceAttribute.logicalType) !==
          normalized(targetAttribute.logicalType)
      ) {
        issues.push({
          id: `relationship-type-${relationship.id}`,
          severity: "warning",
          title: "Mapped attributes use different logical types",
          detail: `${sourceAttribute.name} is ${sourceAttribute.logicalType}; ${targetAttribute.name} is ${targetAttribute.logicalType}.`,
          selection: { kind: "relationship", id: relationship.id },
        });
      }
    }
    if (
      !relationship.sourceAttributeId &&
      !relationship.targetAttributeId &&
      relationship.kind === "association"
    ) {
      issues.push({
        id: `relationship-map-${relationship.id}`,
        severity: "info",
        title: relationship.name
          ? `“${relationship.name}” is entity-level`
          : "Entity-level relationship",
        detail:
          "Map endpoint attributes if this relationship carries explicit key attributes.",
        selection: { kind: "relationship", id: relationship.id },
      });
    }
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const findInheritanceCycle = (entityId: string): boolean => {
    if (visiting.has(entityId)) return true;
    if (visited.has(entityId)) return false;
    visiting.add(entityId);
    const hasCycle = (inheritanceParents.get(entityId) ?? []).some(
      findInheritanceCycle,
    );
    visiting.delete(entityId);
    visited.add(entityId);
    return hasCycle;
  };
  for (const entityId of Object.keys(project.model.entities)) {
    if (findInheritanceCycle(entityId)) {
      issues.push({
        id: `inheritance-cycle-${entityId}`,
        severity: "error",
        title: "Inheritance cycle detected",
        detail: "Subtype/supertype relationships must form an acyclic hierarchy.",
        selection: { kind: "entity", id: entityId },
      });
      break;
    }
  }

  return issues.sort((left, right) => {
    const rank: Record<ValidationSeverity, number> = {
      error: 0,
      warning: 1,
      info: 2,
    };
    return (
      rank[left.severity] - rank[right.severity] ||
      left.title.localeCompare(right.title)
    );
  });
}

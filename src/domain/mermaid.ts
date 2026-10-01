import { isExactCardinality } from "./model";
import type {
  Cardinality,
  DiagramId,
  Entity,
  EntityId,
  JoineryProject,
  Relationship,
} from "./model";
import { createBlankProject, createId, nextEntityPosition } from "./project";

export interface ModelImportResult {
  project: JoineryProject;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

// Exact-N cardinalities have no Mermaid symbol; they render as "exactly one"
// bars and the precise value is carried by a `%% cardinality:` meta comment.
const LEFT_CARDINALITY: Partial<Record<Cardinality, string>> = {
  "zero-or-one": "|o",
  "exactly-one": "||",
  "zero-or-many": "}o",
  "one-or-many": "}|",
};

const RIGHT_CARDINALITY: Partial<Record<Cardinality, string>> = {
  "zero-or-one": "o|",
  "exactly-one": "||",
  "zero-or-many": "o{",
  "one-or-many": "|{",
};

function mermaidIdentifier(name: string, used: Set<string>): string {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  let base = /^[A-Za-z]/.test(cleaned) ? cleaned : `n_${cleaned}`;
  if (base === "n_") base = "unnamed";
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function metaComment(key: string, value: string): string {
  return `%% ${key}: ${value.replace(/\r?\n/g, " ")}`;
}

function mermaidLabel(value: string): string {
  return value.replace(/["\r\n]+/g, " ").trim();
}

/**
 * Serializes the entities visible on one diagram as a Mermaid `erDiagram`.
 * Joinery-specific details that Mermaid cannot express (display names, colors,
 * descriptions, role names, inheritance) are emitted as `%% key: value`
 * comments immediately before the element they describe, so importing a
 * Joinery-exported file restores them. Foreign Mermaid renderers ignore them.
 */
export function exportMermaidDiagram(
  project: JoineryProject,
  diagramId: DiagramId,
): string {
  const diagram = project.diagrams[diagramId];
  if (!diagram) throw new Error("The selected diagram no longer exists.");

  const visibleIds = new Set(Object.keys(diagram.entityViews));
  const usedNames = new Set<string>();
  const aliases = new Map<EntityId, string>();
  for (const entity of Object.values(project.model.entities)) {
    if (visibleIds.has(entity.id)) {
      aliases.set(entity.id, mermaidIdentifier(entity.name, usedNames));
    }
  }

  const lines: string[] = ["erDiagram"];
  const attrAliasesByEntity = new Map<string, Map<string, string>>();

  for (const [entityId, alias] of aliases) {
    const entity = project.model.entities[entityId];
    lines.push(metaComment("name", entity.name));
    if (entity.color) lines.push(metaComment("color", entity.color));
    if (entity.description) {
      lines.push(metaComment("description", entity.description));
    }
    if (entity.attributes.length === 0) {
      lines.push(alias);
      continue;
    }
    lines.push(`${alias} {`);
    const usedAttrNames = new Set<string>();
    const attrAliases = new Map<string, string>();
    attrAliasesByEntity.set(entity.id, attrAliases);

    const keyAttributes = new Set(
      entity.identifiers.flatMap((identifier) => identifier.attributeIds),
    );
    const primaryAttributes = new Set(
      entity.identifiers
        .filter((identifier) => identifier.kind === "primary")
        .flatMap((identifier) => identifier.attributeIds),
    );
    for (const attribute of entity.attributes) {
      const attrName = mermaidIdentifier(attribute.name, usedAttrNames);
      attrAliases.set(attribute.id, attrName);
      const attrType =
        attribute.logicalType
          .trim()
          .replace(/[^A-Za-z0-9_()]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "") || "string";
      const keys: string[] = [];
      if (primaryAttributes.has(attribute.id)) keys.push("PK");
      else if (keyAttributes.has(attribute.id)) keys.push("UK");
      const commentParts: string[] = [];
      if (attribute.isRequired) commentParts.push("[required]");
      if (attribute.description) commentParts.push(attribute.description);
      const comment = commentParts.join(" ").trim();
      const keysText = keys.length ? ` ${keys.join(", ")}` : "";
      const commentText = comment ? ` "${mermaidLabel(comment)}"` : "";
      lines.push(`\t${attrType} ${attrName}${keysText}${commentText}`);
    }
    for (const entry of entity.inversionEntries) {
      const members = entry.attributeIds
        .map((attributeId) => attrAliases.get(attributeId))
        .filter((attrAlias): attrAlias is string => Boolean(attrAlias));
      if (members.length === 0) continue;
      const name = mermaidLabel(entry.name).replace(/\|/g, " ") || "Entry";
      const description = mermaidLabel(entry.description).replace(/\|/g, " ");
      lines.push(
        `\t%% inversion: ${name} | ${members.join(",")}${description ? ` | ${description}` : ""}`,
      );
    }
    lines.push("}");
  }

  let naryIndex = 0;
  for (const relationship of Object.values(project.model.relationships)) {
    if (relationship.participants?.length) {
      // Mermaid has no n-ary construct: emit Joinery metadata for lossless
      // re-import plus a reified hub entity with star edges so foreign
      // renderers still show the association.
      naryIndex += 1;
      const hubAlias = `NARY_${naryIndex}`;
      const relName = (relationship.name || "relates to").replace(/\|/g, "/");
      const metaParts = [
        relName,
        relationship.isIdentifying ? "identifying" : "non-identifying",
        relationship.description.replace(/\|/g, "/").replace(/\r?\n/g, " "),
      ];
      lines.push(metaComment("nary", metaParts.join(" | ")));
      relationship.participants.forEach((participant) => {
        const alias = aliases.get(participant.entityId);
        if (!alias) return;
        const attributeName = participant.attributeId
          ? (attrAliasesByEntity
              .get(participant.entityId)
              ?.get(participant.attributeId) ?? "-")
          : "-";
        lines.push(
          metaComment(
            "participant",
            `${alias} | ${participant.cardinality} | ${(participant.role || "-").replace(/\|/g, "/")} | ${attributeName || "-"}`,
          ),
        );
      });
      lines.push(metaComment("nary-end", ""));
      const connector = relationship.isIdentifying ? "--" : "..";
      const hubLabel = `${relName} (n-ary)`;
      relationship.participants.forEach((participant) => {
        const alias = aliases.get(participant.entityId);
        if (!alias) return;
        lines.push(metaComment("nary-edge", relName));
        lines.push(
          `${alias} ${LEFT_CARDINALITY[participant.cardinality] ?? "||"}${connector}o| ${hubAlias}["${hubLabel}"] : ${mermaidLabel(relName)}`,
        );
      });
      continue;
    }

    const source = aliases.get(relationship.sourceEntityId);
    const target = aliases.get(relationship.targetEntityId);
    if (!source || !target) continue;

    if (relationship.kind === "inheritance") {
      lines.push(metaComment("kind", "inheritance"));
    }
    if (relationship.sourceRole || relationship.targetRole) {
      lines.push(
        metaComment(
          "roles",
          `${relationship.sourceRole || "-"} / ${relationship.targetRole || "-"}`,
        ),
      );
    }
    if (
      relationship.kind === "association" &&
      (isExactCardinality(relationship.sourceCardinality) ||
        isExactCardinality(relationship.targetCardinality))
    ) {
      lines.push(
        metaComment(
          "cardinality",
          `${relationship.sourceCardinality} / ${relationship.targetCardinality}`,
        ),
      );
    }
    if (relationship.description) {
      lines.push(metaComment("description", relationship.description));
    }
    const label = mermaidLabel(
      relationship.name ||
        (relationship.kind === "inheritance" ? "subtype of" : "relates to"),
    );
    const connector = relationship.isIdentifying ? "--" : "..";
    if (relationship.kind === "inheritance") {
      lines.push(`${source} ||--o| ${target} : ${label}`);
    } else {
      lines.push(
        `${source} ${LEFT_CARDINALITY[relationship.sourceCardinality] ?? "||"}${connector}${RIGHT_CARDINALITY[relationship.targetCardinality] ?? "||"} ${target} : ${label}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const IDENTIFIER_LINE = /^[A-Za-z_][\w-]*$/;
const ENTITY_BLOCK_START = /^([A-Za-z_][\w-]*)(?:\s*\[\s*"([^"]*)"\s*\])?\s*\{\s*$/;
const RELATIONSHIP_LINE =
  /^([A-Za-z_][\w-]*)(?:\s*\[\s*"([^"]*)"\s*\])?\s+([|}{o]{1,3}(?:--|\.\.)[|}{o]{1,3})\s+([A-Za-z_][\w-]*)(?:\s*\[\s*"([^"]*)"\s*\])?\s*:\s*(.*)$/;
const META_COMMENT = /^%%\s*([\w-]+)\s*[:=]\s*(.*)$/;
const COLOR_VALUE = /^#[0-9a-f]{3,8}$/i;
const CARDINALITY_VALUE =
  /^(zero-or-one|exactly-one|zero-or-many|one-or-many|exactly-[1-9]\d{0,5})$/;

function decodeCardinality(symbols: string): Cardinality | null {
  const hasMany = /[}{]/.test(symbols);
  const hasZero = /o/.test(symbols);
  const hasOne = /\|/.test(symbols);
  if (hasMany) {
    if (hasOne) return "one-or-many";
    return "zero-or-many";
  }
  if (hasZero && hasOne) return "zero-or-one";
  if (hasOne) return "exactly-one";
  return null;
}

function displayName(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\s+/g, " ").trim() || raw;
}

export function parseMermaidDiagram(
  source: string,
  projectName = "Imported model",
): ModelImportResult {
  const warnings: string[] = [];
  const project = createBlankProject(projectName);
  const diagramId = Object.keys(project.diagrams)[0];
  const diagram = project.diagrams[diagramId];

  const entityByMermaidName = new Map<string, Entity>();
  const attrIdByMermaidName = new Map<string, Map<string, string>>();
  let sawErDiagramHeader = false;
  let currentEntity: Entity | null = null;
  let pendingMeta = new Map<string, string>();
  let unknownLines = 0;

  const takeMeta = () => {
    const meta = pendingMeta;
    pendingMeta = new Map();
    return meta;
  };

  const ensureEntity = (mermaidName: string, alias?: string): Entity => {
    const existing = entityByMermaidName.get(mermaidName);
    if (existing) return existing;
    const entity: Entity = {
      id: createId("entity"),
      name: alias?.trim() || displayName(mermaidName),
      description: "",
      color: "#6d4bb9",
      attributes: [],
      identifiers: [],
      inversionEntries: [],
    };
    entityByMermaidName.set(mermaidName, entity);
    project.model.entities[entity.id] = entity;
    const position = nextEntityPosition(diagram);
    diagram.entityViews[entity.id] = {
      x: position.x,
      y: position.y,
      collapsed: false,
      pinned: false,
    };
    return entity;
  };

  // Pending n-ary relationship, collected between `%% nary:` and `%% nary-end`.
  let pendingNary: {
    name: string;
    isIdentifying: boolean;
    description: string;
    participants: Array<{
      entityId: string;
      attributeId: string | null;
      role: string;
      cardinality: Cardinality;
    }>;
  } | null = null;
  const finishNary = () => {
    if (!pendingNary) return;
    const specs = pendingNary.participants;
    if (specs.length < 2) {
      warnings.push(
        `N-ary relationship "${pendingNary.name}" had fewer than two resolvable participants and was skipped.`,
      );
      pendingNary = null;
      return;
    }
    const relationship: Relationship = {
      id: createId("relationship"),
      name: pendingNary.name,
      description: pendingNary.description,
      kind: "association",
      sourceRole: specs[0].role,
      targetRole: specs[1].role,
      sourceEntityId: specs[0].entityId,
      targetEntityId: specs[1].entityId,
      sourceAttributeId: specs[0].attributeId,
      targetAttributeId: specs[1].attributeId,
      sourceCardinality: specs[0].cardinality,
      targetCardinality: specs[1].cardinality,
      isIdentifying: pendingNary.isIdentifying,
    };
    if (specs.length >= 3) {
      relationship.participants = specs.map((spec) => ({
        id: createId("participant"),
        ...spec,
      }));
    }
    project.model.relationships[relationship.id] = relationship;
    pendingNary = null;
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^%%/.test(line)) {
      const match = META_COMMENT.exec(line);
      if (match) {
        const key = match[1].toLowerCase();
        if (key === "nary") {
          const [name = "", mode = "", description = ""] = match[2]
            .split("|")
            .map((part) => part.trim());
          pendingNary = {
            name,
            isIdentifying: mode === "identifying",
            description,
            participants: [],
          };
        } else if (key === "participant" && pendingNary) {
          const [alias = "", cardinality = "", role = "", attrAlias = ""] = match[2]
            .split("|")
            .map((part) => part.trim());
          const entity = alias ? ensureEntity(alias) : null;
          if (entity && CARDINALITY_VALUE.test(cardinality)) {
            pendingNary.participants.push({
              entityId: entity.id,
              attributeId:
                attrAlias && attrAlias !== "-"
                  ? (attrIdByMermaidName.get(entity.id)?.get(attrAlias) ?? null)
                  : null,
              role: role === "-" ? "" : role,
              cardinality: cardinality as Cardinality,
            });
          }
        } else if (key === "nary-end") {
          finishNary();
        } else if (key === "inversion" && currentEntity) {
          // `%% inversion: name | attr1,attr2 | description` inside a block.
          const entity = currentEntity;
          const [entryName = "", membersText = "", entryDescription = ""] = match[2]
            .split("|")
            .map((part) => part.trim());
          const attrIds = membersText
            .split(",")
            .map((member) => attrIdByMermaidName.get(entity.id)?.get(member.trim()))
            .filter((attributeId): attributeId is string => Boolean(attributeId));
          if (attrIds.length > 0) {
            currentEntity.inversionEntries.push({
              id: createId("inversion_entry"),
              name: entryName,
              description: entryDescription,
              attributeIds: attrIds,
            });
          }
        } else {
          pendingMeta.set(key, match[2]);
        }
      }
      continue;
    }

    if (currentEntity) {
      if (line === "}") {
        currentEntity = null;
        pendingMeta = new Map();
        continue;
      }
      const attrMatch = /^([^\s"']+)\s+([^\s"']+)\s*([^"]*?)\s*(?:"([^"]*)")?\s*$/.exec(
        line,
      );
      if (!attrMatch) {
        unknownLines += 1;
        continue;
      }
      const [, rawType, rawName, keysText = "", comment = ""] = attrMatch;
      const keys = new Set(
        keysText
          .split(/[,\s]+/)
          .map((token) => token.trim().toUpperCase())
          .filter(Boolean),
      );
      let description = comment.trim();
      let isRequired = false;
      if (description.startsWith("[required]")) {
        isRequired = true;
        description = description.slice("[required]".length).trim();
      }
      const attribute = {
        id: createId("attribute"),
        name: displayName(rawName),
        logicalType: rawType.replace(/_/g, " ") || "Text",
        description,
        isRequired,
        isIdentifier: keys.has("PK"),
      };
      currentEntity.attributes.push(attribute);
      let attrMap = attrIdByMermaidName.get(currentEntity.id);
      if (!attrMap) {
        attrMap = new Map();
        attrIdByMermaidName.set(currentEntity.id, attrMap);
      }
      attrMap.set(rawName, attribute.id);
      if (keys.has("PK")) {
        let primary = currentEntity.identifiers.find(
          (identifier) => identifier.kind === "primary",
        );
        if (!primary) {
          primary = {
            id: createId("identifier"),
            name: "Primary identifier",
            kind: "primary",
            attributeIds: [],
          };
          currentEntity.identifiers.push(primary);
        }
        primary.attributeIds.push(attribute.id);
      } else if (keys.has("UK")) {
        let alternate = currentEntity.identifiers.find(
          (identifier) => identifier.kind === "alternate",
        );
        if (!alternate) {
          alternate = {
            id: createId("identifier"),
            name: "Alternate identifier",
            kind: "alternate",
            attributeIds: [],
          };
          currentEntity.identifiers.push(alternate);
        }
        alternate.attributeIds.push(attribute.id);
      }
      if (keys.has("FK")) {
        warnings.push(
          `Foreign key flag on "${attribute.name}" was kept as a plain attribute (Joinery is logical-only).`,
        );
      }
      continue;
    }

    if (/^erdiagram$/i.test(line.replace(/\s+/g, ""))) {
      sawErDiagramHeader = true;
      continue;
    }

    const relationshipMatch = RELATIONSHIP_LINE.exec(line);
    if (relationshipMatch) {
      const [, sourceRaw, sourceAlias, symbols, targetRaw, targetAlias, label] =
        relationshipMatch;
      const meta = takeMeta();
      if (meta.has("nary-edge")) {
        // Fallback star edge for a reified n-ary hub — the `%% nary:` block
        // already reconstructed the real relationship.
        continue;
      }
      const source = ensureEntity(sourceRaw, sourceAlias);
      const target = ensureEntity(targetRaw, targetAlias);
      const isIdentifying = symbols.includes("--");
      const sides = symbols.split(/--|\.\./);
      let sourceCardinality = decodeCardinality(sides[0] ?? "");
      let targetCardinality = decodeCardinality(sides[1] ?? "");
      const metaCardinality = meta.get("cardinality")?.split("/");
      const metaSource = metaCardinality?.[0]?.trim();
      const metaTarget = metaCardinality?.[1]?.trim();
      if (metaSource && CARDINALITY_VALUE.test(metaSource)) {
        sourceCardinality = metaSource as Cardinality;
      }
      if (metaTarget && CARDINALITY_VALUE.test(metaTarget)) {
        targetCardinality = metaTarget as Cardinality;
      }
      if (!sourceCardinality || !targetCardinality) {
        warnings.push(
          `Relationship "${label || `${sourceRaw} ${targetRaw}`}" used an unrecognized cardinality and defaulted to 1 to many.`,
        );
      }
      const isInheritance = meta.get("kind") === "inheritance";
      const roles = meta
        .get("roles")
        ?.split("/")
        .map((role) => role.trim());
      const relationship: Relationship = {
        id: createId("relationship"),
        name: label.replace(/^"|"$/g, "").trim(),
        description: meta.get("description") ?? "",
        kind: isInheritance ? "inheritance" : "association",
        sourceRole: roles?.[0] && roles[0] !== "-" ? roles[0] : "",
        targetRole: roles?.[1] && roles[1] !== "-" ? roles[1] : "",
        sourceEntityId: source.id,
        targetEntityId: target.id,
        sourceAttributeId: null,
        targetAttributeId: null,
        sourceCardinality: isInheritance
          ? "exactly-one"
          : (sourceCardinality ?? "exactly-one"),
        targetCardinality: isInheritance
          ? "zero-or-one"
          : (targetCardinality ?? "zero-or-many"),
        isIdentifying,
      };
      project.model.relationships[relationship.id] = relationship;
      continue;
    }

    const blockStart = ENTITY_BLOCK_START.exec(line);
    if (blockStart) {
      const meta = takeMeta();
      const entity = ensureEntity(blockStart[1], blockStart[2]);
      const metaName = meta.get("name");
      if (metaName) entity.name = metaName;
      const metaColor = meta.get("color");
      if (metaColor && COLOR_VALUE.test(metaColor)) entity.color = metaColor;
      if (meta.get("description")) {
        entity.description = meta.get("description") ?? "";
      }
      currentEntity = entity;
      continue;
    }

    if (IDENTIFIER_LINE.test(line)) {
      const meta = takeMeta();
      const entity = ensureEntity(line);
      const metaName = meta.get("name");
      if (metaName) entity.name = metaName;
      const metaColor = meta.get("color");
      if (metaColor && COLOR_VALUE.test(metaColor)) entity.color = metaColor;
      if (meta.get("description")) {
        entity.description = meta.get("description") ?? "";
      }
      continue;
    }

    pendingMeta = new Map();
    unknownLines += 1;
  }

  if (!sawErDiagramHeader) {
    throw new Error("The file does not contain a Mermaid erDiagram section.");
  }
  if (entityByMermaidName.size === 0) {
    throw new Error("No entities were found in the Mermaid diagram.");
  }
  if (unknownLines > 0) {
    warnings.push(`${unknownLines} line(s) could not be parsed and were skipped.`);
  }

  return { project, warnings };
}

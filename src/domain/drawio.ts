import type {
  Cardinality,
  Diagram,
  Entity,
  JoineryProject,
  Relationship,
} from "./model";
import { createBlankProject, createId } from "./project";
import type { ModelImportResult } from "./mermaid";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const ENTITY_WIDTH = 272;
const ENTITY_HEADER_HEIGHT = 48;
const ATTRIBUTE_ROW_HEIGHT = 32;
const ENTITY_BOTTOM_PADDING = 8;

// Exact-N cardinalities have no drawio arrow; they export as ERone plus a
// joineryCard style key that carries the precise values on re-import.
const ER_ARROW: Partial<Record<Cardinality, string>> = {
  "exactly-one": "ERone",
  "zero-or-one": "ERzeroToOne",
  "zero-or-many": "ERzeroToMany",
  "one-or-many": "ERoneToMany",
};

const CARDINALITY_VALUE =
  /^(zero-or-one|exactly-one|zero-or-many|one-or-many|exactly-[1-9]\d{0,5})$/;

function joineryCardinality(
  raw: string | undefined,
  fallback: Cardinality,
): Cardinality {
  return raw && CARDINALITY_VALUE.test(raw) ? (raw as Cardinality) : fallback;
}

const ARROW_CARDINALITY: Record<string, Cardinality> = {
  ERone: "exactly-one",
  ERmandOne: "exactly-one",
  ERzeroToOne: "zero-or-one",
  ERoneToMany: "one-or-many",
  ERmandMany: "one-or-many",
  ERmany: "zero-or-many",
  ERzeroToMany: "zero-or-many",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

function encodeStyleValue(value: string): string {
  return encodeURIComponent(value).replace(/'/g, "%27");
}

function decodeStyleValue(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function entityNodeHeight(entity: Entity, collapsed: boolean): number {
  return collapsed
    ? ENTITY_HEADER_HEIGHT
    : ENTITY_HEADER_HEIGHT +
        entity.attributes.length * ATTRIBUTE_ROW_HEIGHT +
        ENTITY_BOTTOM_PADDING;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Serializes the whole project as an uncompressed drawio (.drawio) mxfile.
 * Each Joinery diagram becomes a drawio page. Cells carry `joineryKind`
 * style keys so files exported by Joinery re-import deterministically;
 * drawio itself ignores the extra style keys.
 */
export function exportDrawioFile(project: JoineryProject): string {
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<mxfile host="Joinery" agent="Joinery" type="device">`,
  ];

  for (const diagram of Object.values(project.diagrams)) {
    parts.push(
      `  <diagram id="${escapeXml(diagram.id)}" name="${escapeXml(diagram.name)}">`,
      `    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">`,
      `      <root>`,
      `        <mxCell id="0" />`,
      `        <mxCell id="1" parent="0" />`,
    );

    // Subject areas first so they render behind entity cells.
    for (const area of Object.values(diagram.subjectAreas)) {
      parts.push(
        `        <mxCell id="${escapeXml(area.id)}" value="${escapeXml(area.name)}" ` +
          `style="rounded=1;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;fontSize=15;align=left;verticalAlign=top;spacingLeft=12;spacingTop=8;dashed=1;fillColor=${escapeXml(area.color)};fillOpacity=15;joineryKind=subjectArea;joineryDescription=${encodeStyleValue(area.description)};" ` +
          `vertex="1" parent="1">`,
        `          <mxGeometry x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" as="geometry" />`,
        `        </mxCell>`,
      );
    }

    const cellIdForAttribute = new Map<string, string>();
    for (const viewEntry of Object.entries(diagram.entityViews)) {
      const [entityId, view] = viewEntry;
      const entity = project.model.entities[entityId];
      if (!entity) continue;
      const entityCellId = `entity_${entityId}`;
      const height = entityNodeHeight(entity, view.collapsed);
      const ieStyle = entity.inversionEntries.length
        ? `joineryIEs=${encodeStyleValue(
            JSON.stringify(
              entity.inversionEntries.map((entry) => ({
                name: entry.name,
                description: entry.description,
                attrs: entry.attributeIds
                  .map(
                    (attributeId) =>
                      entity.attributes.find(
                        (attribute) => attribute.id === attributeId,
                      )?.name,
                  )
                  .filter((name): name is string => Boolean(name)),
              })),
            ),
          )};`
        : "";
      parts.push(
        `        <mxCell id="${escapeXml(entityCellId)}" value="${escapeXml(entity.name)}" ` +
          `style="shape=table;startSize=${ENTITY_HEADER_HEIGHT};container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;fontSize=13;align=center;fillColor=${escapeXml(entity.color)};fontColor=#FFFFFF;html=1;joineryKind=entity;joineryDescription=${encodeStyleValue(entity.description)};${ieStyle}" ` +
          `vertex="1" parent="1">`,
        `          <mxGeometry x="${view.x}" y="${view.y}" width="${ENTITY_WIDTH}" height="${height}" as="geometry" />`,
        `        </mxCell>`,
      );
      if (view.collapsed) continue;
      const identifierIds = new Set(
        entity.identifiers.flatMap((identifier) => identifier.attributeIds),
      );
      for (const attribute of entity.attributes) {
        const rowId = `attr_${attribute.id}`;
        cellIdForAttribute.set(attribute.id, rowId);
        const label = attribute.logicalType
          ? `${attribute.name}: ${attribute.logicalType}`
          : attribute.name;
        const isKey = identifierIds.has(attribute.id);
        parts.push(
          `          <mxCell id="${escapeXml(rowId)}" value="${escapeXml(label)}" ` +
            `style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;align=left;spacingLeft=10;overflow=hidden;html=1;${isKey ? "fontStyle=1;" : ""}joineryKind=${isKey ? "keyAttribute" : "attribute"};joineryName=${encodeStyleValue(attribute.name)};joineryType=${encodeStyleValue(attribute.logicalType)};joineryDescription=${encodeStyleValue(attribute.description)};${attribute.isRequired ? "joineryRequired=1;" : ""}" ` +
            `vertex="1" parent="${escapeXml(entityCellId)}">`,
          `            <mxGeometry width="${ENTITY_WIDTH}" height="${ATTRIBUTE_ROW_HEIGHT}" as="geometry" />`,
          `          </mxCell>`,
        );
      }
    }

    for (const relationship of Object.values(project.model.relationships)) {
      if (relationship.participants?.length) {
        // N-ary: a rhombus hub cell plus one leg edge per participant.
        const hubId = `hub_${relationship.id}`;
        const stored = diagram.relationshipViews[relationship.id]?.hub;
        const centers = relationship.participants
          .map((participant) => {
            const view = diagram.entityViews[participant.entityId];
            const entity = project.model.entities[participant.entityId];
            if (!view || !entity) return null;
            return {
              x: view.x + 140,
              y: view.y + entityNodeHeight(entity, view.collapsed) / 2,
            };
          })
          .filter((point): point is { x: number; y: number } => Boolean(point));
        const hubCenter = stored ?? {
          x:
            centers.reduce((sum, point) => sum + point.x, 0) /
            Math.max(centers.length, 1),
          y:
            centers.reduce((sum, point) => sum + point.y, 0) /
            Math.max(centers.length, 1),
        };
        parts.push(
          `        <mxCell id="${escapeXml(hubId)}" value="${escapeXml(relationship.name || "Relationship")}" ` +
            `style="rhombus;whiteSpace=wrap;html=1;fillColor=#f4f1fb;strokeColor=#65558f;${relationship.isIdentifying ? "" : "dashed=1;"}fontSize=10;joineryKind=naryHub;joineryRelId=${escapeXml(relationship.id)};joineryRel=${relationship.kind};joineryIdentifying=${relationship.isIdentifying ? 1 : 0};joineryDescription=${encodeStyleValue(relationship.description)};" ` +
            `vertex="1" parent="1">`,
          `          <mxGeometry x="${Math.round(hubCenter.x - 54)}" y="${Math.round(hubCenter.y - 26)}" width="108" height="52" as="geometry" />`,
          `        </mxCell>`,
        );
        for (const participant of relationship.participants) {
          const legSource =
            (participant.attributeId &&
              cellIdForAttribute.get(participant.attributeId)) ||
            `entity_${participant.entityId}`;
          parts.push(
            `        <mxCell id="${escapeXml(`leg_${relationship.id}_${participant.id}`)}" value="${escapeXml(participant.role)}" ` +
              `style="edgeStyle=entityRelationEdgeStyle;rounded=0;html=1;startArrow=${ER_ARROW[participant.cardinality] ?? "ERone"};endArrow=none;startFill=0;${relationship.isIdentifying ? "" : "dashed=1;"}joineryKind=naryLeg;joineryRelId=${escapeXml(relationship.id)};joineryCard=${encodeURIComponent(participant.cardinality)};joineryRole=${encodeStyleValue(participant.role)};" ` +
              `edge="1" parent="1" source="${escapeXml(legSource)}" target="${escapeXml(hubId)}">`,
            `          <mxGeometry relative="1" as="geometry" />`,
            `        </mxCell>`,
          );
        }
        continue;
      }

      const sourceView = diagram.entityViews[relationship.sourceEntityId];
      const targetView = diagram.entityViews[relationship.targetEntityId];
      if (!sourceView || !targetView) continue;
      const edgeId = `rel_${relationship.id}`;
      const sourceCell =
        (relationship.sourceAttributeId &&
          cellIdForAttribute.get(relationship.sourceAttributeId)) ||
        `entity_${relationship.sourceEntityId}`;
      const targetCell =
        (relationship.targetAttributeId &&
          cellIdForAttribute.get(relationship.targetAttributeId)) ||
        `entity_${relationship.targetEntityId}`;
      const isInheritance = relationship.kind === "inheritance";
      const arrows = isInheritance
        ? "startArrow=block;startFill=0;startSize=16;endArrow=none;"
        : `startArrow=${ER_ARROW[relationship.sourceCardinality] ?? "ERone"};endArrow=${ER_ARROW[relationship.targetCardinality] ?? "ERone"};startFill=0;endFill=0;`;
      const dashed = relationship.isIdentifying || isInheritance ? "" : "dashed=1;";
      const cardStyle = isInheritance
        ? ""
        : `joineryCard=${encodeURIComponent(`${relationship.sourceCardinality}|${relationship.targetCardinality}`)};`;
      parts.push(
        `        <mxCell id="${escapeXml(edgeId)}" value="${escapeXml(relationship.name)}" ` +
          `style="edgeStyle=entityRelationEdgeStyle;rounded=0;html=1;${arrows}${dashed}joineryKind=relationship;joineryRel=${relationship.kind};${cardStyle}joineryDescription=${encodeStyleValue(relationship.description)};" ` +
          `edge="1" parent="1" source="${escapeXml(sourceCell)}" target="${escapeXml(targetCell)}">`,
      );
      const view = diagram.relationshipViews[relationship.id];
      const points = (view?.vertices ?? [])
        .map((point) => `            <mxPoint x="${point.x}" y="${point.y}" />`)
        .join("\n");
      if (points) {
        parts.push(
          `          <mxGeometry relative="1" as="geometry">`,
          `            <Array as="points">`,
          points,
          `            </Array>`,
          `          </mxGeometry>`,
        );
      } else {
        parts.push(`          <mxGeometry relative="1" as="geometry" />`);
      }
      parts.push(`        </mxCell>`);
      if (relationship.sourceRole) {
        parts.push(
          `          <mxCell value="${escapeXml(relationship.sourceRole)}" ` +
            `style="edgeLabel;html=1;align=center;verticalAlign=middle;fontSize=8;joineryKind=sourceRole;" ` +
            `vertex="1" connectable="0" parent="${escapeXml(edgeId)}">`,
          `            <mxGeometry x="-0.9" relative="1" as="geometry" />`,
          `          </mxCell>`,
        );
      }
      if (relationship.targetRole) {
        parts.push(
          `          <mxCell value="${escapeXml(relationship.targetRole)}" ` +
            `style="edgeLabel;html=1;align=center;verticalAlign=middle;fontSize=8;joineryKind=targetRole;" ` +
            `vertex="1" connectable="0" parent="${escapeXml(edgeId)}">`,
          `            <mxGeometry x="0.9" relative="1" as="geometry" />`,
          `          </mxCell>`,
        );
      }
    }

    for (const note of Object.values(diagram.notes)) {
      const attachCellId = note.entityId ? `entity_${note.entityId}` : "";
      const attachStyle = attachCellId
        ? `joineryEntity=${encodeStyleValue(attachCellId)};`
        : "";
      parts.push(
        `        <mxCell id="${escapeXml(note.id)}" value="${escapeXml(note.text)}" ` +
          `style="shape=note;size=18;whiteSpace=wrap;html=1;fillColor=${escapeXml(note.color)};joineryKind=note;${attachStyle}" ` +
          `vertex="1" parent="1">`,
        `          <mxGeometry x="${note.x}" y="${note.y}" width="${note.width}" height="${note.height}" as="geometry" />`,
        `        </mxCell>`,
      );
      if (attachCellId) {
        parts.push(
          `        <mxCell id="${escapeXml(note.id)}__link" ` +
            `style="edgeStyle=none;dashed=1;startArrow=none;endArrow=none;joineryKind=noteLink;" ` +
            `edge="1" source="${escapeXml(note.id)}" target="${escapeXml(attachCellId)}" parent="1" />`,
        );
      }
    }

    parts.push(`      </root>`, `    </mxGraphModel>`, `  </diagram>`);
  }

  parts.push(`</mxfile>`);
  return `${parts.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Import (best effort — drawio stores shapes, not semantics)
// ---------------------------------------------------------------------------

interface ParsedCell {
  id: string;
  value: string;
  styles: Record<string, string>;
  vertex: boolean;
  edge: boolean;
  parent: string;
  source: string;
  target: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points: Array<{ x: number; y: number }>;
}

function parseStyle(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of style.split(";")) {
    if (!part) continue;
    const separator = part.indexOf("=");
    if (separator === -1) result[part] = "";
    else result[part.slice(0, separator)] = part.slice(separator + 1);
  }
  return result;
}

function parseCells(root: Element): ParsedCell[] {
  const cells: ParsedCell[] = [];
  for (const cell of Array.from(root.querySelectorAll("mxCell"))) {
    const geometry = cell.querySelector(":scope > mxGeometry");
    const points = Array.from(geometry?.querySelectorAll("Array > mxPoint") ?? []).map(
      (point) => ({
        x: Number(point.getAttribute("x") ?? 0),
        y: Number(point.getAttribute("y") ?? 0),
      }),
    );
    cells.push({
      id: cell.getAttribute("id") ?? "",
      value: decodeXmlText(cell.getAttribute("value") ?? ""),
      styles: parseStyle(cell.getAttribute("style") ?? ""),
      vertex: cell.getAttribute("vertex") === "1",
      edge: cell.getAttribute("edge") === "1",
      parent: cell.getAttribute("parent") ?? "",
      source: cell.getAttribute("source") ?? "",
      target: cell.getAttribute("target") ?? "",
      x: Number(geometry?.getAttribute("x") ?? 0),
      y: Number(geometry?.getAttribute("y") ?? 0),
      width: Number(geometry?.getAttribute("width") ?? 120),
      height: Number(geometry?.getAttribute("height") ?? 40),
      points,
    });
  }
  return cells;
}

async function inflateDiagramContent(encoded: string): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Compressed drawio pages are not supported in this environment.");
  }
  const binary = Uint8Array.from(atob(encoded.trim()), (char) => char.charCodeAt(0));
  const body = new Response(binary).body;
  if (!body) {
    throw new Error("The environment cannot decompress drawio pages.");
  }
  const stream = body.pipeThrough(new DecompressionStream("deflate-raw"));
  const inflated = await new Response(stream).text();
  try {
    return decodeURIComponent(inflated);
  } catch {
    return inflated;
  }
}

async function diagramModels(
  source: string,
  warnings: string[],
): Promise<Array<{ name: string; model: Element }>> {
  const document = new DOMParser().parseFromString(source, "text/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("The file is not valid XML.");
  }
  const mxfile = document.querySelector("mxfile");
  const diagramElements = mxfile
    ? Array.from(mxfile.querySelectorAll(":scope > diagram"))
    : [];
  if (diagramElements.length === 0) {
    const model = document.querySelector("mxGraphModel");
    if (model) return [{ name: "Imported diagram", model }];
    throw new Error("No mxfile diagram pages were found in the file.");
  }

  const models: Array<{ name: string; model: Element }> = [];
  for (const [index, element] of diagramElements.entries()) {
    const name = element.getAttribute("name")?.trim() || `Diagram ${index + 1}`;
    const inlineModel = element.querySelector(":scope > mxGraphModel");
    if (inlineModel) {
      models.push({ name, model: inlineModel });
      continue;
    }
    const encoded = element.textContent?.trim();
    if (!encoded) continue;
    try {
      const xml = await inflateDiagramContent(encoded);
      const parsed = new DOMParser().parseFromString(xml, "text/xml");
      const model = parsed.querySelector("mxGraphModel");
      if (model) models.push({ name, model });
      else warnings.push(`Page "${name}" could not be decoded and was skipped.`);
    } catch {
      warnings.push(`Page "${name}" could not be decompressed and was skipped.`);
    }
  }
  return models;
}

function isEntityCell(cell: ParsedCell): boolean {
  const kind = cell.styles["joineryKind"];
  if (kind) return kind === "entity";
  if (!cell.vertex) return false;
  return (
    cell.styles["shape"] === "table" ||
    cell.styles["shape"] === "swimlane" ||
    cell.styles["shape"] === "mxgraph.er.entity"
  );
}

function isRowCell(cell: ParsedCell, entityCellIds: Set<string>): boolean {
  const kind = cell.styles["joineryKind"];
  if (kind) return kind === "attribute" || kind === "keyAttribute";
  return (
    cell.vertex &&
    entityCellIds.has(cell.parent) &&
    cell.styles["shape"] === "partialRectangle"
  );
}

function parseRowText(value: string): {
  name: string;
  logicalType: string;
  isKey: boolean;
} {
  let text = value.trim();
  let isKey = false;
  const pkMatch = /^(?:PK|FK)\s*[,:—-]?\s*/i.exec(text);
  if (pkMatch) {
    isKey = /^PK/i.test(text);
    text = text.slice(pkMatch[0].length);
  }
  const typed = /^(.*?)\s*[:|]\s*(.+)$/.exec(text);
  if (typed) return { name: typed[1].trim(), logicalType: typed[2].trim(), isKey };
  return { name: text, logicalType: "", isKey };
}

export async function importDrawioFile(
  source: string,
  projectName = "Imported model",
): Promise<ModelImportResult> {
  const warnings: string[] = [];
  const models = await diagramModels(source, warnings);
  if (models.length === 0) {
    throw new Error("No readable diagram pages were found in the file.");
  }

  const project = createBlankProject(projectName);
  const diagrams: Record<string, Diagram> = {};
  let skippedCells = 0;

  for (const { name, model } of models) {
    const cells = parseCells(model.querySelector(":scope > root") ?? model).filter(
      (cell) => cell.id !== "0" && cell.id !== "1",
    );
    const byId = new Map(cells.map((cell) => [cell.id, cell]));

    const diagram: Diagram = {
      id: createId("diagram"),
      name,
      description: "",
      entityViews: {},
      relationshipViews: {},
      notes: {},
      subjectAreas: {},
    };
    diagrams[diagram.id] = diagram;

    const entityCells = cells.filter(isEntityCell);
    const entityCellIds = new Set(entityCells.map((cell) => cell.id));
    const entityByCellId = new Map<string, Entity>();
    const rowToEntity = new Map<string, { entity: Entity; attributeId: string }>();
    const pendingInversions = new Map<Entity, string>();

    for (const cell of entityCells) {
      const joineryName = decodeStyleValue(cell.styles["joineryName"]);
      const entity: Entity = {
        id: createId("entity"),
        name: joineryName || cell.value.trim() || "Imported entity",
        description: decodeStyleValue(cell.styles["joineryDescription"]),
        color: /^#[0-9a-f]{6}$/i.test(cell.styles["fillColor"] ?? "")
          ? cell.styles["fillColor"]
          : "#6d4bb9",
        attributes: [],
        identifiers: [],
        inversionEntries: [],
      };
      project.model.entities[entity.id] = entity;
      entityByCellId.set(cell.id, entity);
      const ieText = decodeStyleValue(cell.styles["joineryIEs"]);
      if (ieText) pendingInversions.set(entity, ieText);
      diagram.entityViews[entity.id] = {
        x: cell.x,
        y: cell.y,
        collapsed: false,
        pinned: false,
      };
    }

    for (const cell of cells.filter((cell) => isRowCell(cell, entityCellIds))) {
      const entity = entityByCellId.get(cell.parent);
      if (!entity) continue;
      const kind = cell.styles["joineryKind"];
      const parsed = parseRowText(cell.value);
      const joineryName = decodeStyleValue(cell.styles["joineryName"]);
      const attribute = {
        id: createId("attribute"),
        name: joineryName || parsed.name || "attribute",
        logicalType:
          decodeStyleValue(cell.styles["joineryType"]) || parsed.logicalType || "Text",
        description: decodeStyleValue(cell.styles["joineryDescription"]),
        isRequired: cell.styles["joineryRequired"] === "1",
        isIdentifier: kind === "keyAttribute" || parsed.isKey,
      };
      entity.attributes.push(attribute);
      rowToEntity.set(cell.id, { entity, attributeId: attribute.id });
      if (attribute.isIdentifier) {
        let primary = entity.identifiers.find(
          (identifier) => identifier.kind === "primary",
        );
        if (!primary) {
          primary = {
            id: createId("identifier"),
            name: "Primary identifier",
            kind: "primary",
            attributeIds: [],
          };
          entity.identifiers.push(primary);
        }
        primary.attributeIds.push(attribute.id);
      }
    }

    for (const [entity, raw] of pendingInversions) {
      try {
        const entries = JSON.parse(raw) as Array<{
          name?: unknown;
          description?: unknown;
          attrs?: unknown;
        }>;
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          const attrIds = (Array.isArray(entry.attrs) ? entry.attrs : [])
            .filter((name): name is string => typeof name === "string")
            .map(
              (name) =>
                entity.attributes.find((attribute) => attribute.name === name)?.id,
            )
            .filter((attributeId): attributeId is string => Boolean(attributeId));
          if (attrIds.length === 0) continue;
          entity.inversionEntries.push({
            id: createId("inversion_entry"),
            name: typeof entry.name === "string" ? entry.name : "",
            description: typeof entry.description === "string" ? entry.description : "",
            attributeIds: attrIds,
          });
        }
      } catch {
        skippedCells += 1;
      }
    }

    const resolveEntity = (cellId: string) => {
      const cell = byId.get(cellId);
      if (!cell) return null;
      if (entityByCellId.has(cell.id)) {
        return { entity: entityByCellId.get(cell.id)!, attributeId: null };
      }
      const row = rowToEntity.get(cell.id);
      if (row) return { entity: row.entity, attributeId: row.attributeId };
      return null;
    };

    // Collect n-ary legs by their relationship id before generic edge import.
    const hubByRelId = new Map<string, ParsedCell>();
    for (const cell of cells) {
      if (cell.styles["joineryKind"] === "naryHub") {
        const relId = cell.styles["joineryRelId"];
        if (relId) hubByRelId.set(relId, cell);
      }
    }
    const naryLegs = new Map<string, ParsedCell[]>();
    for (const cell of cells.filter((cell) => cell.edge)) {
      if (cell.styles["joineryKind"] === "naryLeg") {
        const relId = cell.styles["joineryRelId"];
        if (!relId) continue;
        naryLegs.set(relId, [...(naryLegs.get(relId) ?? []), cell]);
      }
    }
    naryLegs.forEach((legCells, relId) => {
      const hub = hubByRelId.get(relId);
      const specs = legCells
        .map((leg) => {
          const endpoint = resolveEntity(leg.source);
          if (!endpoint) return null;
          return {
            entityId: endpoint.entity.id,
            attributeId: endpoint.attributeId,
            role: decodeStyleValue(leg.styles["joineryRole"]) || leg.value.trim(),
            cardinality: joineryCardinality(
              decodeStyleValue(leg.styles["joineryCard"]),
              ARROW_CARDINALITY[leg.styles["startArrow"] ?? ""] ?? "zero-or-many",
            ),
          };
        })
        .filter((spec): spec is NonNullable<typeof spec> => Boolean(spec));
      if (specs.length < 2) {
        skippedCells += legCells.length;
        warnings.push(
          `N-ary relationship "${hub?.value || relId}" was skipped — fewer than two legs resolve to entities.`,
        );
        return;
      }
      const relationship: Relationship = {
        id: createId("relationship"),
        name: hub?.value.trim() ?? "",
        description: decodeStyleValue(hub?.styles["joineryDescription"]),
        kind: "association",
        sourceRole: specs[0].role,
        targetRole: specs[1].role,
        sourceEntityId: specs[0].entityId,
        targetEntityId: specs[1].entityId,
        sourceAttributeId: specs[0].attributeId,
        targetAttributeId: specs[1].attributeId,
        sourceCardinality: specs[0].cardinality,
        targetCardinality: specs[1].cardinality,
        isIdentifying: hub?.styles["joineryIdentifying"] === "1",
      };
      if (specs.length >= 3) {
        relationship.participants = specs.map((spec) => ({
          id: createId("participant"),
          ...spec,
        }));
      }
      project.model.relationships[relationship.id] = relationship;
      if (hub) {
        diagram.relationshipViews[relationship.id] = {
          vertices: [],
          hub: { x: hub.x + 54, y: hub.y + 26 },
        };
      }
    });

    for (const cell of cells.filter((cell) => cell.edge)) {
      const joineryKind = cell.styles["joineryKind"];
      if (joineryKind === "naryLeg" || joineryKind === "noteLink") continue;
      const source = resolveEntity(cell.source);
      const target = resolveEntity(cell.target);
      if (!source || !target) {
        skippedCells += 1;
        continue;
      }
      const styles = cell.styles;
      const kind =
        decodeStyleValue(styles["joineryRel"]) === "inheritance" ||
        styles["startArrow"] === "block"
          ? "inheritance"
          : "association";
      const roles: Record<string, string> = {};
      for (const child of cells.filter(
        (candidate) => candidate.parent === cell.id && !candidate.edge,
      )) {
        const roleKind = child.styles["joineryKind"];
        if (roleKind === "sourceRole") roles.sourceRole = child.value;
        if (roleKind === "targetRole") roles.targetRole = child.value;
      }
      const relationship: Relationship = {
        id: createId("relationship"),
        name: cell.value.trim(),
        description: decodeStyleValue(styles["joineryDescription"]),
        kind,
        sourceRole: roles.sourceRole ?? "",
        targetRole: roles.targetRole ?? "",
        sourceEntityId: source.entity.id,
        targetEntityId: target.entity.id,
        sourceAttributeId: source.attributeId,
        targetAttributeId: target.attributeId,
        sourceCardinality:
          kind === "inheritance"
            ? "exactly-one"
            : joineryCardinality(
                decodeStyleValue(styles["joineryCard"]).split("|")[0],
                ARROW_CARDINALITY[styles["startArrow"] ?? ""] ?? "exactly-one",
              ),
        targetCardinality:
          kind === "inheritance"
            ? "zero-or-one"
            : joineryCardinality(
                decodeStyleValue(styles["joineryCard"]).split("|")[1],
                ARROW_CARDINALITY[styles["endArrow"] ?? ""] ?? "zero-or-many",
              ),
        isIdentifying:
          kind === "association" && styles["joineryKind"] === "relationship"
            ? styles["dashed"] !== "1"
            : false,
      };
      project.model.relationships[relationship.id] = relationship;
      if (cell.points.length) {
        diagram.relationshipViews[relationship.id] = { vertices: cell.points };
      }
    }

    for (const cell of cells) {
      const kind = cell.styles["joineryKind"];
      if (kind === "note" || cell.styles["shape"] === "note") {
        const noteId = createId("note");
        const attachedCellId = decodeStyleValue(cell.styles["joineryEntity"]);
        const attachedEntity = attachedCellId
          ? entityByCellId.get(attachedCellId)
          : undefined;
        diagram.notes[noteId] = {
          id: noteId,
          text: cell.value,
          x: cell.x,
          y: cell.y,
          width: cell.width || 200,
          height: cell.height || 120,
          color: /^#[0-9a-f]{6}$/i.test(cell.styles["fillColor"] ?? "")
            ? cell.styles["fillColor"]
            : "#fff2a8",
          ...(attachedEntity ? { entityId: attachedEntity.id } : {}),
        };
      } else if (kind === "subjectArea") {
        const areaId = createId("subject_area");
        diagram.subjectAreas[areaId] = {
          id: areaId,
          name: cell.value || "Subject area",
          description: decodeStyleValue(cell.styles["joineryDescription"]),
          x: cell.x,
          y: cell.y,
          width: cell.width || 400,
          height: cell.height || 300,
          color: /^#[0-9a-f]{6}$/i.test(cell.styles["fillColor"] ?? "")
            ? cell.styles["fillColor"]
            : "#6d4bb9",
        };
      }
    }
  }

  const entityCount = Object.keys(project.model.entities).length;
  if (entityCount === 0) {
    throw new Error(
      "No entity shapes were found. drawio import recognizes ER table shapes and Joinery-exported files.",
    );
  }
  if (skippedCells > 0) {
    warnings.push(
      `${skippedCells} edge(s) were skipped because their endpoints were not entity shapes.`,
    );
  }

  if (Object.keys(diagrams).length) project.diagrams = diagrams;

  return { project, warnings };
}

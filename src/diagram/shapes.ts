import { Graph, Node, type Edge } from "@antv/x6";
import type {
  Cardinality,
  Diagram,
  Entity,
  EntityView,
  JoineryProject,
  Relationship,
  RelationshipId,
} from "../domain/model";
import type { Theme } from "../state/uiStore";

export const ENTITY_NODE_WIDTH = 272;
const ENTITY_HEADER_HEIGHT = 48;

Node.define({
  constructorName: "JoineryEntityNode",
  shape: "joinery-entity",
  markup: [],
  attrs: {},
  overwrite: true,
});
Node.define({
  constructorName: "JoineryNoteNode",
  shape: "joinery-note",
  markup: [],
  attrs: {},
  overwrite: true,
});
Node.define({
  constructorName: "JoinerySubjectAreaNode",
  shape: "joinery-subject-area",
  markup: [],
  attrs: {},
  overwrite: true,
});
const ATTRIBUTE_ROW_HEIGHT = 32;
const ENTITY_BOTTOM_PADDING = 8;
type PortSide = "top" | "right" | "bottom" | "left";
type AttributePortSide = "left" | "right";

export function attributePortId(attributeId: string, side: AttributePortSide): string {
  return `attribute:${encodeURIComponent(attributeId)}:${side}`;
}

export function attributeIdFromPort(portId: string | null | undefined): string | null {
  if (!portId?.startsWith("attribute:")) return null;
  const match = /^attribute:(.+):(left|right)$/.exec(portId);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export interface EntityNodeSize {
  width: number;
  height: number;
}

export function entityNodeSize(
  entity: Entity,
  view?: Pick<EntityView, "collapsed">,
): EntityNodeSize {
  return {
    width: ENTITY_NODE_WIDTH,
    height: view?.collapsed
      ? ENTITY_HEADER_HEIGHT
      : ENTITY_HEADER_HEIGHT +
        entity.attributes.length * ATTRIBUTE_ROW_HEIGHT +
        ENTITY_BOTTOM_PADDING,
  };
}

function truncate(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) return value;
  return `${value.slice(0, maximumLength - 1)}…`;
}

export function createEntityNodeMetadata(
  entity: Entity,
  view: EntityView,
  theme: Theme = "light",
): Node.Metadata {
  const size = entityNodeSize(entity, view);
  const dark = theme === "dark";
  const entityHeader = /^#[0-9a-f]{6}$/i.test(entity.color)
    ? entity.color
    : dark
      ? "#181520"
      : "#29243d";
  const palette = {
    shadow: dark ? "#08070d" : "#171328",
    body: dark ? "#292634" : "#ffffff",
    border: dark ? "#4a4558" : "#d9d6e5",
    header: entityHeader,
    row: dark ? "#292634" : "#ffffff",
    rowAlternate: dark ? "#2e2a39" : "#fbfaff",
    divider: dark ? "#403b4c" : "#eeecf3",
    text: dark ? "#eeeaf5" : "#383348",
    muted: dark ? "#aaa3b8" : "#898398",
  };
  const markup: NonNullable<Node.Metadata["markup"]> = [
    { tagName: "rect", selector: "shadow" },
    { tagName: "rect", selector: "body" },
    { tagName: "rect", selector: "header" },
    { tagName: "circle", selector: "entityDot" },
    { tagName: "text", selector: "entityName" },
    { tagName: "text", selector: "entityKind" },
    { tagName: "text", selector: "pinIndicator" },
  ];

  const attrs: NonNullable<Node.Metadata["attrs"]> = {
    shadow: {
      x: 0,
      y: 3,
      width: size.width,
      height: size.height,
      rx: 12,
      ry: 12,
      fill: palette.shadow,
      opacity: dark ? 0.28 : 0.1,
    },
    body: {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      rx: 12,
      ry: 12,
      fill: palette.body,
      stroke: palette.border,
      strokeWidth: 1,
    },
    header: {
      x: 0,
      y: 0,
      width: size.width,
      height: ENTITY_HEADER_HEIGHT,
      rx: 12,
      ry: 12,
      fill: palette.header,
      stroke: "none",
    },
    entityDot: {
      cx: 20,
      cy: 24,
      r: 5,
      fill: "#a78bfa",
    },
    entityName: {
      x: 34,
      y: 21,
      text: truncate(entity.name || "Untitled entity", 27),
      fill: "#ffffff",
      fontSize: 14,
      fontWeight: 650,
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      dominantBaseline: "middle",
    },
    entityKind: {
      x: 34,
      y: 36,
      text: "LOGICAL ENTITY",
      fill: "#aaa3c4",
      fontSize: 8,
      fontWeight: 650,
      letterSpacing: 1.2,
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      dominantBaseline: "middle",
    },
    pinIndicator: {
      x: size.width - 16,
      y: 25,
      text: view.pinned ? "PIN" : "",
      fill: "#cfc5e9",
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 0.7,
      textAnchor: "end",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      dominantBaseline: "middle",
    },
  };

  if (!view.collapsed) {
    entity.attributes.forEach((attribute, index) => {
      const rowY = ENTITY_HEADER_HEIGHT + index * ATTRIBUTE_ROW_HEIGHT;
      const suffix = index.toString();
      const backgroundSelector = `attributeBackground${suffix}`;
      const dividerSelector = `attributeDivider${suffix}`;
      const identifierSelector = `attributeIdentifier${suffix}`;
      const nameSelector = `attributeName${suffix}`;
      const typeSelector = `attributeType${suffix}`;
      const requiredSelector = `attributeRequired${suffix}`;

      markup.push(
        { tagName: "rect", selector: backgroundSelector },
        { tagName: "line", selector: dividerSelector },
        { tagName: "text", selector: identifierSelector },
        { tagName: "text", selector: nameSelector },
        { tagName: "text", selector: typeSelector },
        { tagName: "circle", selector: requiredSelector },
      );

      attrs[backgroundSelector] = {
        x: 1,
        y: rowY,
        width: size.width - 2,
        height: ATTRIBUTE_ROW_HEIGHT,
        fill: index % 2 === 0 ? palette.row : palette.rowAlternate,
      };
      attrs[dividerSelector] = {
        x1: 14,
        y1: rowY,
        x2: size.width - 14,
        y2: rowY,
        stroke: palette.divider,
        strokeWidth: 1,
      };
      attrs[identifierSelector] = {
        x: 18,
        y: rowY + ATTRIBUTE_ROW_HEIGHT / 2,
        text: attribute.isIdentifier ? "◆" : "·",
        fill: attribute.isIdentifier ? "#8b5cf6" : "#c6c2d2",
        fontSize: attribute.isIdentifier ? 9 : 15,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        textAnchor: "middle",
        dominantBaseline: "middle",
      };
      attrs[nameSelector] = {
        x: 32,
        y: rowY + ATTRIBUTE_ROW_HEIGHT / 2,
        text: truncate(attribute.name || "Untitled attribute", 22),
        fill: palette.text,
        fontSize: 11.5,
        fontWeight: attribute.isIdentifier ? 620 : 480,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        dominantBaseline: "middle",
      };
      attrs[typeSelector] = {
        x: size.width - 17,
        y: rowY + ATTRIBUTE_ROW_HEIGHT / 2,
        text: truncate(attribute.logicalType || "—", 13),
        fill: palette.muted,
        fontSize: 10,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        textAnchor: "end",
        dominantBaseline: "middle",
      };
      attrs[requiredSelector] = {
        cx: size.width - 8,
        cy: rowY + 8,
        r: attribute.isRequired ? 2 : 0,
        fill: "#f59e0b",
      };
    });
  }

  const portStyle = {
    r: 5,
    magnet: true,
    fill: dark ? "#292634" : "#ffffff",
    stroke: "#8b5cf6",
    strokeWidth: 2,
    class: "joinery-port",
  };
  const attributePortStyle = {
    r: 4,
    magnet: true,
    fill: dark ? "#292634" : "#ffffff",
    stroke: "#8b5cf6",
    strokeWidth: 1.75,
    class: "joinery-port joinery-attribute-port",
  };
  const attributePorts = view.collapsed
    ? []
    : entity.attributes.flatMap((attribute, index) => {
        const y =
          ENTITY_HEADER_HEIGHT +
          index * ATTRIBUTE_ROW_HEIGHT +
          ATTRIBUTE_ROW_HEIGHT / 2;
        return [
          {
            id: attributePortId(attribute.id, "left"),
            group: "attribute",
            args: { x: 0, y },
          },
          {
            id: attributePortId(attribute.id, "right"),
            group: "attribute",
            args: { x: size.width, y },
          },
        ];
      });

  return {
    id: entity.id,
    shape: "joinery-entity",
    x: view.x,
    y: view.y,
    width: size.width,
    height: size.height,
    markup,
    attrs,
    ports: {
      groups: {
        top: { position: "top", attrs: { circle: portStyle } },
        right: { position: "right", attrs: { circle: portStyle } },
        bottom: { position: "bottom", attrs: { circle: portStyle } },
        left: { position: "left", attrs: { circle: portStyle } },
        attribute: {
          position: "absolute",
          attrs: { circle: attributePortStyle },
        },
      },
      items: [
        { id: "top", group: "top" },
        { id: "right", group: "right" },
        { id: "bottom", group: "bottom" },
        { id: "left", group: "left" },
        ...attributePorts,
      ],
    },
    data: {
      kind: "entity",
      entityId: entity.id,
      renderKey:
        JSON.stringify(entity) +
        JSON.stringify({ collapsed: view.collapsed, pinned: view.pinned, theme }),
    },
    zIndex: 2,
  };
}

function colorWithAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

export function createNoteNodeMetadata(
  note: Diagram["notes"][string],
  theme: Theme = "light",
): Node.Metadata {
  const dark = theme === "dark";
  return {
    id: note.id,
    shape: "joinery-note",
    x: note.x,
    y: note.y,
    width: note.width,
    height: note.height,
    markup: [
      { tagName: "rect", selector: "body" },
      { tagName: "path", selector: "fold" },
      { tagName: "text", selector: "text" },
    ],
    attrs: {
      body: {
        width: note.width,
        height: note.height,
        rx: 8,
        ry: 8,
        fill: dark ? "#3a3328" : note.color,
        stroke: dark ? "#6a5d45" : "#dbc878",
        strokeWidth: 1,
      },
      fold: {
        d: `M ${note.width - 18} 0 L ${note.width} 18 L ${note.width - 18} 18 Z`,
        fill: dark ? "#524a39" : "#eadb98",
        stroke: "none",
      },
      text: {
        x: 12,
        y: 12,
        text: note.text || "Note",
        fill: dark ? "#f0e8d5" : "#554b35",
        fontSize: 11,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        textAnchor: "start",
        textVerticalAnchor: "top",
        textWrap: {
          width: Math.max(20, note.width - 24),
          height: Math.max(20, note.height - 24),
          ellipsis: true,
        },
      },
    },
    data: {
      kind: "note",
      noteId: note.id,
      renderKey: JSON.stringify({ note, theme }),
    },
    zIndex: 4,
  };
}

export function createSubjectAreaNodeMetadata(
  subjectArea: Diagram["subjectAreas"][string],
  theme: Theme = "light",
): Node.Metadata {
  const dark = theme === "dark";
  return {
    id: subjectArea.id,
    shape: "joinery-subject-area",
    x: subjectArea.x,
    y: subjectArea.y,
    width: subjectArea.width,
    height: subjectArea.height,
    markup: [
      { tagName: "rect", selector: "body" },
      { tagName: "text", selector: "title" },
    ],
    attrs: {
      body: {
        width: subjectArea.width,
        height: subjectArea.height,
        rx: 14,
        ry: 14,
        fill: colorWithAlpha(subjectArea.color, dark ? "18" : "0d"),
        stroke: subjectArea.color,
        strokeWidth: 1.2,
        strokeDasharray: "7 5",
      },
      title: {
        x: 14,
        y: 20,
        text: subjectArea.name || "Subject area",
        fill: dark ? "#d6cee2" : subjectArea.color,
        fontSize: 11,
        fontWeight: 700,
        textAnchor: "start",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      },
    },
    data: {
      kind: "subject-area",
      subjectAreaId: subjectArea.id,
      renderKey: JSON.stringify({ subjectArea, theme }),
    },
    zIndex: 0,
  };
}

const markerNames: Record<Cardinality, string> = {
  "zero-or-one": "joinery-zero-or-one",
  "exactly-one": "joinery-exactly-one",
  "zero-or-many": "joinery-zero-or-many",
  "one-or-many": "joinery-one-or-many",
};

let markersRegistered = false;

export function registerJoineryMarkers(): void {
  if (markersRegistered) return;

  const common = {
    tagName: "path",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.35,
    refX: 0,
    refY: 0,
  } as const;

  Graph.registerMarker(
    markerNames["exactly-one"],
    () => ({
      ...common,
      d: "M 3 -7 L 3 7 M 11 -7 L 11 7",
    }),
    true,
  );
  Graph.registerMarker(
    markerNames["zero-or-one"],
    () => ({
      ...common,
      d: "M 3 -7 L 3 7 M 8 0 A 4 4 0 1 0 16 0 A 4 4 0 1 0 8 0",
    }),
    true,
  );
  Graph.registerMarker(
    markerNames["one-or-many"],
    () => ({
      ...common,
      d: "M 2 0 L 10 -7 M 2 0 L 10 0 M 2 0 L 10 7 M 16 -7 L 16 7",
    }),
    true,
  );
  Graph.registerMarker(
    markerNames["zero-or-many"],
    () => ({
      ...common,
      d: "M 2 0 L 10 -7 M 2 0 L 10 0 M 2 0 L 10 7 M 13 0 A 4 4 0 1 0 21 0 A 4 4 0 1 0 13 0",
    }),
    true,
  );

  markersRegistered = true;
}

function preferredPorts(
  relationship: Relationship,
  diagram: Diagram,
  entities: JoineryProject["model"]["entities"],
): {
  sourcePort: string;
  targetPort: string;
  sourceSide: PortSide;
  targetSide: PortSide;
} {
  const sourceView = diagram.entityViews[relationship.sourceEntityId];
  const targetView = diagram.entityViews[relationship.targetEntityId];
  const sourceEntity = entities[relationship.sourceEntityId];
  const targetEntity = entities[relationship.targetEntityId];

  if (!sourceView || !targetView || !sourceEntity || !targetEntity) {
    return {
      sourcePort: "right",
      targetPort: "left",
      sourceSide: "right",
      targetSide: "left",
    };
  }

  if (relationship.sourceEntityId === relationship.targetEntityId) {
    return {
      sourceSide: "right",
      targetSide: "right",
      sourcePort:
        relationship.sourceAttributeId && !sourceView.collapsed
          ? attributePortId(relationship.sourceAttributeId, "right")
          : "right",
      targetPort:
        relationship.targetAttributeId && !targetView.collapsed
          ? attributePortId(relationship.targetAttributeId, "right")
          : "right",
    };
  }

  const sourceSize = entityNodeSize(sourceEntity, sourceView);
  const targetSize = entityNodeSize(targetEntity, targetView);
  const sourceCenter = {
    x: sourceView.x + sourceSize.width / 2,
    y: sourceView.y + sourceSize.height / 2,
  };
  const targetCenter = {
    x: targetView.x + targetSize.width / 2,
    y: targetView.y + targetSize.height / 2,
  };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  const sourceHasAttributePort = Boolean(
    relationship.sourceAttributeId &&
    !sourceView.collapsed &&
    sourceEntity.attributes.some(
      (attribute) => attribute.id === relationship.sourceAttributeId,
    ),
  );
  const targetHasAttributePort = Boolean(
    relationship.targetAttributeId &&
    !targetView.collapsed &&
    targetEntity.attributes.some(
      (attribute) => attribute.id === relationship.targetAttributeId,
    ),
  );

  let sourceSide: PortSide;
  let targetSide: PortSide;
  if (
    sourceHasAttributePort ||
    targetHasAttributePort ||
    Math.abs(dx) >= Math.abs(dy)
  ) {
    sourceSide = dx >= 0 ? "right" : "left";
    targetSide = dx >= 0 ? "left" : "right";
  } else {
    sourceSide = dy >= 0 ? "bottom" : "top";
    targetSide = dy >= 0 ? "top" : "bottom";
  }

  return {
    sourceSide,
    targetSide,
    sourcePort:
      sourceHasAttributePort && relationship.sourceAttributeId
        ? attributePortId(
            relationship.sourceAttributeId,
            sourceSide as AttributePortSide,
          )
        : sourceSide,
    targetPort:
      targetHasAttributePort && relationship.targetAttributeId
        ? attributePortId(
            relationship.targetAttributeId,
            targetSide as AttributePortSide,
          )
        : targetSide,
  };
}

export function createRelationshipEdgeMetadata(
  relationship: Relationship,
  project: JoineryProject,
  diagram: Diagram,
  theme: Theme = "light",
): Edge.Metadata {
  const { sourcePort, targetPort, sourceSide, targetSide } = preferredPorts(
    relationship,
    diagram,
    project.model.entities,
  );
  const recursive = relationship.sourceEntityId === relationship.targetEntityId;
  const denseDiagram = Object.keys(diagram.entityViews).length > 70;
  const dark = theme === "dark";
  const stroke = relationship.isIdentifying
    ? dark
      ? "#b8a0eb"
      : "#65558f"
    : dark
      ? "#aaa3b8"
      : "#777184";

  return {
    id: relationship.id,
    shape: "edge",
    source: { cell: relationship.sourceEntityId, port: sourcePort },
    target: { cell: relationship.targetEntityId, port: targetPort },
    router: recursive
      ? { name: "loop", args: { width: 90, height: 70, angle: 0 } }
      : denseDiagram
        ? { name: "orth", args: { padding: 18 } }
        : {
            name: "manhattan",
            args: {
              padding: 24,
              step: 12,
              excludeShapes: ["joinery-subject-area", "joinery-note"],
              startDirections: [sourceSide],
              endDirections: [targetSide],
            },
          },
    connector: { name: "rounded", args: { radius: 8 } },
    vertices: diagram.relationshipViews[relationship.id]?.vertices ?? [],
    attrs: {
      wrap: {
        class: "joinery-edge-hit-area",
        cursor: "pointer",
      },
      line: {
        class: "joinery-edge-line",
        stroke,
        strokeWidth: relationship.isIdentifying ? 1.8 : 1.45,
        strokeDasharray: relationship.isIdentifying ? "" : "0",
        sourceMarker:
          relationship.kind === "inheritance"
            ? null
            : { name: markerNames[relationship.sourceCardinality] },
        targetMarker:
          relationship.kind === "inheritance"
            ? { name: "block", width: 14, height: 12, open: true }
            : { name: markerNames[relationship.targetCardinality] },
      },
    },
    labels: relationship.name
      ? [
          {
            position: 0.5,
            attrs: {
              body: {
                fill: dark ? "#292634" : "#ffffff",
                stroke: dark ? "#514b60" : "#e3e0ea",
                strokeWidth: 1,
                rx: 7,
                ry: 7,
                refWidth: "120%",
                refHeight: "150%",
                refX: "-10%",
                refY: "-25%",
              },
              label: {
                text: truncate(relationship.name, 24),
                fill: dark ? "#ddd7e8" : "#625c70",
                fontSize: 10,
                fontWeight: 540,
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          },
        ]
      : [],
    data: {
      kind: "relationship",
      relationshipId: relationship.id,
      renderKey: JSON.stringify({ relationship, theme }),
    },
    zIndex: 1,
  };
}

export function visibleRelationshipIds(
  project: JoineryProject,
  diagram: Diagram,
): RelationshipId[] {
  const visibleEntities = new Set(Object.keys(diagram.entityViews));
  return Object.values(project.model.relationships)
    .filter(
      (relationship) =>
        visibleEntities.has(relationship.sourceEntityId) &&
        visibleEntities.has(relationship.targetEntityId),
    )
    .map((relationship) => relationship.id);
}

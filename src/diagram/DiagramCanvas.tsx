import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Graph, type Edge, type Node } from "@antv/x6";
import { MiniMap } from "@antv/x6-plugin-minimap";
import "@antv/x6-plugin-minimap/dist/index.css";
import { Selection } from "@antv/x6-plugin-selection";
import { Focus, Info, Map, Minus, Plus, X } from "lucide-react";
import { useProjectStore } from "../state/projectStore";
import { useUiStore, type Theme } from "../state/uiStore";
import type { ProjectSelection } from "../domain/model";
import { calculateAutoLayout } from "./autoLayout";
import {
  createDiagramSvg,
  type SvgExportOptions,
  type SvgExportResult,
} from "./exportSvg";
import {
  attributeIdFromPort,
  createEntityNodeMetadata,
  createNaryLegMetadata,
  createNoteLinkEdgeMetadata,
  createNoteNodeMetadata,
  createRelationshipEdgeMetadata,
  createRelationshipHubMetadata,
  createSubjectAreaNodeMetadata,
  registerJoineryMarkers,
  relationshipHubId,
  relationshipIdFromCellId,
  relationshipLegId,
} from "./shapes";
import { isNaryRelationship } from "../domain/model";

export interface DiagramCanvasHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusEntity: (entityId: string) => void;
  autoLayout: () => Promise<void>;
  createSvg: (options: SvgExportOptions) => SvgExportResult | null;
}

function selectionForCell(cell: Node | Edge): ProjectSelection {
  const data = cell.getData<{ kind?: string }>();
  if (cell.isNode() && data?.kind === "entity") {
    return { kind: "entity", id: cell.id };
  }
  if (cell.isNode() && data?.kind === "note") {
    return { kind: "note", id: cell.id };
  }
  if (cell.isNode() && data?.kind === "subject-area") {
    return { kind: "subject-area", id: cell.id };
  }
  if (cell.isNode() && data?.kind === "relationship-hub") {
    return { kind: "relationship", id: relationshipIdFromCellId(cell.id) };
  }
  if (cell.isEdge() && data?.kind === "relationship") {
    return { kind: "relationship", id: relationshipIdFromCellId(cell.id) };
  }
  return null;
}

function updateCanvasAccessibility(
  graph: Graph,
  project: ReturnType<typeof useProjectStore.getState>["project"],
  diagramId: string,
): void {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return;
  graph.container
    .querySelectorAll<SVGElement>(".x6-cell[data-cell-id]")
    .forEach((element) => {
      const cellId = element.dataset.cellId;
      if (!cellId) return;
      const entity = project.model.entities[cellId];
      const relationship =
        project.model.relationships[relationshipIdFromCellId(cellId)];
      const note = diagram.notes[cellId];
      const subjectArea = diagram.subjectAreas[cellId];
      element.setAttribute("tabindex", "0");
      element.setAttribute("role", "button");
      if (entity) {
        element.setAttribute("aria-label", `Entity ${entity.name || "Untitled"}`);
      } else if (relationship) {
        const source = project.model.entities[relationship.sourceEntityId]?.name;
        const target = project.model.entities[relationship.targetEntityId]?.name;
        const arity = relationship.participants?.length
          ? `, ${relationship.participants.length} participants`
          : "";
        element.setAttribute(
          "aria-label",
          `Relationship ${relationship.name || `${source} to ${target}`}${arity}`,
        );
      } else if (note) {
        const attached = note.entityId
          ? project.model.entities[note.entityId]?.name
          : undefined;
        element.setAttribute(
          "aria-label",
          attached
            ? `Comment on ${attached}: ${note.text.slice(0, 60)}`
            : `Diagram note ${note.text.slice(0, 60)}`,
        );
      } else if (subjectArea) {
        element.setAttribute("aria-label", `Subject area ${subjectArea.name}`);
      }
    });
}

function syncGraph(graph: Graph, theme: Theme): void {
  const { project, activeDiagramId } = useProjectStore.getState();
  const diagram = project.diagrams[activeDiagramId];
  if (!diagram) return;

  const visibleEntityIds = new Set(Object.keys(diagram.entityViews));
  const visibleRelationships = Object.values(project.model.relationships).filter(
    (relationship) =>
      isNaryRelationship(relationship)
        ? relationship.participants!.every((participant) =>
            visibleEntityIds.has(participant.entityId),
          )
        : visibleEntityIds.has(relationship.sourceEntityId) &&
          visibleEntityIds.has(relationship.targetEntityId),
  );
  const naryRelationships = visibleRelationships.filter(isNaryRelationship);
  const visibleNotes = Object.values(diagram.notes).filter(
    (note) => !note.entityId || visibleEntityIds.has(note.entityId),
  );
  const desiredNodeIds = new Set([
    ...visibleEntityIds,
    ...visibleNotes.map((note) => note.id),
    ...Object.keys(diagram.subjectAreas),
    ...naryRelationships.map((relationship) => relationshipHubId(relationship.id)),
  ]);
  const desiredEdgeIds = new Set([
    ...visibleRelationships.flatMap((relationship) =>
      isNaryRelationship(relationship)
        ? (relationship.participants ?? []).map((participant) =>
            relationshipLegId(relationship.id, participant.id),
          )
        : [relationship.id],
    ),
    ...visibleNotes.filter((note) => note.entityId).map((note) => `${note.id}__link`),
  ]);

  graph.batchUpdate("joinery-sync", () => {
    graph.getEdges().forEach((edge) => {
      if (!desiredEdgeIds.has(edge.id)) graph.removeCell(edge);
    });
    graph.getNodes().forEach((node) => {
      if (!desiredNodeIds.has(node.id)) graph.removeCell(node);
    });

    Object.values(diagram.subjectAreas).forEach((subjectArea) => {
      const metadata = createSubjectAreaNodeMetadata(subjectArea, theme);
      const existing = graph.getCellById(subjectArea.id);
      if (!existing || !existing.isNode()) {
        graph.addNode(metadata);
        return;
      }
      const node = existing as Node;
      const previousData = node.getData<{ renderKey?: string }>();
      const nextData = metadata.data as { renderKey?: string };
      if (previousData?.renderKey !== nextData.renderKey) {
        node.setMarkup(metadata.markup!);
        node.replaceAttrs(metadata.attrs!);
        node.resize(metadata.width as number, metadata.height as number);
        node.setData(metadata.data);
      }
      const position = node.position();
      if (position.x !== subjectArea.x || position.y !== subjectArea.y) {
        node.position(subjectArea.x, subjectArea.y);
      }
      node.toBack();
    });

    Object.entries(diagram.entityViews).forEach(([entityId, view]) => {
      const entity = project.model.entities[entityId];
      if (!entity) return;
      const metadata = createEntityNodeMetadata(entity, view, theme);
      const existing = graph.getCellById(entityId);

      if (!existing || !existing.isNode()) {
        graph.addNode(metadata);
        return;
      }

      const node = existing as Node;
      const previousData = node.getData<{ renderKey?: string }>();
      const nextData = metadata.data as { renderKey?: string };
      if (previousData?.renderKey !== nextData.renderKey) {
        node.setMarkup(metadata.markup!);
        node.replaceAttrs(metadata.attrs!);
        node.resize(metadata.width as number, metadata.height as number);
        node.setProp("ports", metadata.ports);
        node.setData(metadata.data);
      }

      const currentPosition = node.position();
      if (currentPosition.x !== view.x || currentPosition.y !== view.y) {
        node.position(view.x, view.y);
      }
    });

    visibleNotes.forEach((note) => {
      const metadata = createNoteNodeMetadata(note, theme);
      const existing = graph.getCellById(note.id);
      if (!existing || !existing.isNode()) {
        graph.addNode(metadata);
        return;
      }
      const node = existing as Node;
      const previousData = node.getData<{ renderKey?: string }>();
      const nextData = metadata.data as { renderKey?: string };
      if (previousData?.renderKey !== nextData.renderKey) {
        node.setMarkup(metadata.markup!);
        node.replaceAttrs(metadata.attrs!);
        node.resize(metadata.width as number, metadata.height as number);
        node.setData(metadata.data);
      }
      const position = node.position();
      if (position.x !== note.x || position.y !== note.y) {
        node.position(note.x, note.y);
      }
    });

    visibleNotes.forEach((note) => {
      if (!note.entityId) return;
      const linkId = `${note.id}__link`;
      if (!graph.getCellById(linkId)) {
        graph.addEdge(
          createNoteLinkEdgeMetadata(note as typeof note & { entityId: string }),
        );
      }
    });

    visibleRelationships.forEach((relationship) => {
      if (isNaryRelationship(relationship)) {
        const hubMetadata = createRelationshipHubMetadata(
          relationship,
          diagram,
          project.model.entities,
          theme,
        );
        const hubId = hubMetadata.id as string;
        const existingHub = graph.getCellById(hubId);
        if (!existingHub || !existingHub.isNode()) {
          graph.addNode(hubMetadata);
        } else {
          const hub = existingHub as Node;
          const previousData = hub.getData<{ renderKey?: string }>();
          const nextData = hubMetadata.data as { renderKey?: string };
          if (previousData?.renderKey !== nextData.renderKey) {
            hub.replaceAttrs(hubMetadata.attrs!);
            hub.setData(hubMetadata.data);
          }
          const storedHub = diagram.relationshipViews[relationship.id]?.hub;
          if (
            storedHub &&
            (hub.position().x !== storedHub.x - (hubMetadata.width as number) / 2 ||
              hub.position().y !== storedHub.y - (hubMetadata.height as number) / 2)
          ) {
            hub.position(
              storedHub.x - (hubMetadata.width as number) / 2,
              storedHub.y - (hubMetadata.height as number) / 2,
            );
          }
        }
        (relationship.participants ?? []).forEach((participant) => {
          const legMetadata = createNaryLegMetadata(
            relationship,
            participant,
            project,
            diagram,
            theme,
          );
          const existingLeg = graph.getCellById(legMetadata.id as string);
          if (!existingLeg || !existingLeg.isEdge()) {
            graph.addEdge(legMetadata);
            return;
          }
          const leg = existingLeg as Edge;
          leg.setSource(legMetadata.source as Edge.TerminalData);
          leg.setTarget(legMetadata.target as Edge.TerminalData);
          leg.setRouter(legMetadata.router!);
          leg.setConnector(legMetadata.connector!);
          const previousData = leg.getData<{ renderKey?: string }>();
          const nextData = legMetadata.data as { renderKey?: string };
          if (previousData?.renderKey !== nextData.renderKey) {
            leg.replaceAttrs(legMetadata.attrs!);
            leg.setLabels(legMetadata.labels ?? []);
            leg.setData(legMetadata.data);
          }
        });
        return;
      }

      const metadata = createRelationshipEdgeMetadata(
        relationship,
        project,
        diagram,
        theme,
      );
      const existing = graph.getCellById(relationship.id);

      if (!existing || !existing.isEdge()) {
        graph.addEdge(metadata);
        return;
      }

      const edge = existing as Edge;
      edge.setSource(metadata.source as Edge.TerminalData);
      edge.setTarget(metadata.target as Edge.TerminalData);
      edge.setRouter(metadata.router!);
      edge.setConnector(metadata.connector!);
      const vertices = metadata.vertices ?? [];
      if (JSON.stringify(edge.getVertices()) !== JSON.stringify(vertices)) {
        edge.setVertices(vertices, { joinerySync: true });
      }

      const previousData = edge.getData<{ renderKey?: string }>();
      const nextData = metadata.data as { renderKey?: string };
      if (previousData?.renderKey !== nextData.renderKey) {
        edge.replaceAttrs(metadata.attrs!);
        edge.setLabels(metadata.labels ?? []);
        edge.setData(metadata.data);
      }
    });
  });
  updateCanvasAccessibility(graph, project, activeDiagramId);
}

export const DiagramCanvas = forwardRef<DiagramCanvasHandle>(
  function DiagramCanvas(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const minimapRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);
    const suppressSelectionEvent = useRef(false);
    const initialFitComplete = useRef(false);
    const project = useProjectStore((state) => state.project);
    const activeDiagramId = useProjectStore((state) => state.activeDiagramId);
    const selection = useProjectStore((state) => state.selection);
    const theme = useUiStore((state) => state.theme);
    const [zoom, setZoom] = useState(1);
    const [legendOpen, setLegendOpen] = useState(false);
    const [minimapOpen, setMinimapOpen] = useState(false);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      registerJoineryMarkers();

      const graph = new Graph({
        container,
        autoResize: false,
        async: false,
        background: { color: theme === "dark" ? "#17151d" : "#f8f7fb" },
        grid: {
          visible: true,
          size: 16,
          type: "doubleMesh",
          args: [
            {
              color: theme === "dark" ? "#25222d" : "#ece9f2",
              thickness: 1,
            },
            {
              color: theme === "dark" ? "#302c39" : "#ded9e8",
              thickness: 1,
              factor: 4,
            },
          ],
        },
        panning: {
          enabled: true,
          eventTypes: ["leftMouseDown", "mouseWheelDown"],
        },
        mousewheel: {
          enabled: true,
          minScale: 0.25,
          maxScale: 1.8,
          factor: 1.08,
          zoomAtMousePosition: true,
        },
        interacting: {
          edgeLabelMovable: false,
        },
        connecting: {
          snap: { radius: 28 },
          allowBlank: false,
          allowLoop: true,
          allowNode: false,
          allowEdge: false,
          allowPort: true,
          allowMulti: "withPort",
          highlight: true,
          anchor: "center",
          connectionPoint: "boundary",
          router: {
            name: "manhattan",
            args: {
              padding: 24,
              step: 12,
              excludeShapes: ["joinery-subject-area", "joinery-note"],
            },
          },
          connector: { name: "rounded", args: { radius: 8 } },
          validateConnection({ sourceCell, targetCell }) {
            return Boolean(
              sourceCell &&
              targetCell &&
              sourceCell.getData<{ kind?: string }>()?.kind === "entity" &&
              targetCell.getData<{ kind?: string }>()?.kind === "entity",
            );
          },
          createEdge() {
            return this.createEdge({
              shape: "edge",
              router: {
                name: "manhattan",
                args: {
                  padding: 24,
                  step: 12,
                  excludeShapes: ["joinery-subject-area", "joinery-note"],
                },
              },
              connector: { name: "rounded", args: { radius: 8 } },
              attrs: {
                line: {
                  stroke: "#8b5cf6",
                  strokeWidth: 1.6,
                  strokeDasharray: "5 4",
                  targetMarker: null,
                },
              },
              zIndex: 1,
            });
          },
        },
      });

      graph.use(
        new Selection({
          enabled: true,
          multiple: false,
          rubberband: false,
          showNodeSelectionBox: true,
          showEdgeSelectionBox: false,
          movable: true,
          following: true,
        }),
      );

      graph.on("node:click", ({ node }) => {
        useProjectStore.getState().setSelection(selectionForCell(node));
      });

      graph.on("edge:click", ({ edge }) => {
        const relationshipId = relationshipIdFromCellId(edge.id);
        if (useProjectStore.getState().project.model.relationships[relationshipId]) {
          useProjectStore
            .getState()
            .setSelection({ kind: "relationship", id: relationshipId });
        }
      });

      graph.on("node:moved", ({ node }) => {
        const position = node.position();
        const data = node.getData<{ kind?: string; relationshipId?: string }>();
        const state = useProjectStore.getState();
        if (data?.kind === "entity") {
          state.updateEntityPosition(state.activeDiagramId, node.id, position);
        } else if (data?.kind === "note") {
          state.updateDiagramNote(state.activeDiagramId, node.id, position);
        } else if (data?.kind === "subject-area") {
          state.updateSubjectArea(state.activeDiagramId, node.id, position);
        } else if (data?.kind === "relationship-hub" && data.relationshipId) {
          // Hub positions are stored as the node center, not the top-left.
          state.updateRelationshipHub(state.activeDiagramId, data.relationshipId, {
            x: position.x + node.size().width / 2,
            y: position.y + node.size().height / 2,
          });
        }
      });

      graph.on("edge:connected", ({ edge, isNew }) => {
        const edgeData = edge.getData<{ participantId?: string }>();
        if (edgeData?.participantId) {
          // N-ary legs are derived from participants — never reconnectable.
          syncGraph(graph, useUiStore.getState().theme);
          return;
        }
        const sourceId = edge.getSourceCellId();
        const targetId = edge.getTargetCellId();
        if (!sourceId || !targetId) return;

        const sourceAttributeId = attributeIdFromPort(edge.getSourcePortId());
        const targetAttributeId = attributeIdFromPort(edge.getTargetPortId());
        const state = useProjectStore.getState();
        if (isNew) {
          const relationshipId = state.addRelationship(
            sourceId,
            targetId,
            edge.id,
            sourceAttributeId,
            targetAttributeId,
          );
          if (relationshipId !== edge.id) {
            graph.removeCell(edge);
            if (relationshipId) {
              state.setSelection({ kind: "relationship", id: relationshipId });
            }
          }
        } else if (state.project.model.relationships[edge.id]) {
          const updated = state.updateRelationship(edge.id, {
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            sourceAttributeId,
            targetAttributeId,
          });
          if (!updated) syncGraph(graph, useUiStore.getState().theme);
        }
      });

      graph.on("edge:change:vertices", ({ edge, current, options }) => {
        if ((options as { joinerySync?: boolean }).joinerySync) return;
        if (!useProjectStore.getState().project.model.relationships[edge.id]) return;
        const state = useProjectStore.getState();
        state.updateRelationshipVertices(
          state.activeDiagramId,
          edge.id,
          (current ?? []).map((vertex) => ({ x: vertex.x, y: vertex.y })),
        );
      });

      graph.on("selection:changed", ({ selected }) => {
        graph.getEdges().forEach((edge) => edge.removeTools());
        const cell = selected[selected.length - 1];
        if (cell?.isEdge()) {
          cell.addTools(
            [
              {
                name: "vertices",
                args: {
                  attrs: { fill: "#7b58c4", stroke: "#ffffff" },
                },
              },
            ],
            { reset: true },
          );
        }
        if (suppressSelectionEvent.current) return;
        useProjectStore
          .getState()
          .setSelection(cell ? selectionForCell(cell as Node | Edge) : null);
      });

      graph.on("scale", ({ sx }) => setZoom(sx));

      const handleAccessibleSelection = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target as Element | null;
        const cellElement = target?.closest<SVGElement>("[data-cell-id]");
        if (!cellElement?.dataset.cellId) return;
        const cell = graph.getCellById(cellElement.dataset.cellId);
        if (!cell) return;
        event.preventDefault();
        useProjectStore.getState().setSelection(selectionForCell(cell as Node | Edge));
      };
      container.addEventListener("keydown", handleAccessibleSelection);

      const resizeObserver = new ResizeObserver(() => {
        graph.resize(container.clientWidth, container.clientHeight);
      });
      resizeObserver.observe(container);
      graph.resize(container.clientWidth, container.clientHeight);
      graphRef.current = graph;
      syncGraph(graph, theme);

      requestAnimationFrame(() => {
        graph.zoomToFit({ padding: 72, maxScale: 1 });
        initialFitComplete.current = true;
      });

      return () => {
        resizeObserver.disconnect();
        container.removeEventListener("keydown", handleAccessibleSelection);
        graph.dispose();
        graphRef.current = null;
      };
    }, [theme]);

    useEffect(() => {
      const graph = graphRef.current;
      if (!graph) return;
      graph.drawBackground({
        color: theme === "dark" ? "#17151d" : "#f8f7fb",
      });
      graph.drawGrid({
        type: "doubleMesh",
        args: [
          {
            color: theme === "dark" ? "#25222d" : "#ece9f2",
            thickness: 1,
          },
          {
            color: theme === "dark" ? "#302c39" : "#ded9e8",
            thickness: 1,
            factor: 4,
          },
        ],
      });
      syncGraph(graph, theme);
    }, [project, activeDiagramId, theme]);

    useEffect(() => {
      const graph = graphRef.current;
      const container = minimapRef.current;
      if (!graph || !container) return;
      if (minimapOpen && !graph.getPlugin("minimap")) {
        graph.use(
          new MiniMap({
            container,
            width: 190,
            height: 126,
            padding: 10,
            scalable: false,
          }),
        );
      } else if (!minimapOpen && graph.getPlugin("minimap")) {
        graph.disposePlugins("minimap");
      }
    }, [minimapOpen, theme]);

    useEffect(() => {
      const graph = graphRef.current;
      if (!graph) return;

      suppressSelectionEvent.current = true;
      graph.cleanSelection();
      if (selection) {
        const cell =
          graph.getCellById(selection.id) ??
          graph.getCellById(relationshipHubId(selection.id));
        if (cell) graph.select(cell);
      }
      suppressSelectionEvent.current = false;
    }, [selection, project, activeDiagramId]);

    useEffect(() => {
      if (!initialFitComplete.current) return;
      const graph = graphRef.current;
      if (!graph) return;
      requestAnimationFrame(() => graph.zoomToFit({ padding: 72, maxScale: 1 }));
    }, [activeDiagramId]);

    useImperativeHandle(
      ref,
      () => ({
        fit: () => {
          graphRef.current?.zoomToFit({ padding: 72, maxScale: 1 });
        },
        zoomIn: () => {
          graphRef.current?.zoom(0.12, { maxScale: 1.8 });
        },
        zoomOut: () => {
          graphRef.current?.zoom(-0.12, { minScale: 0.25 });
        },
        focusEntity: (entityId) => {
          const graph = graphRef.current;
          const cell = graph?.getCellById(entityId);
          if (!graph || !cell) return;
          graph.centerCell(cell);
          graph.select(cell);
        },
        autoLayout: async () => {
          const state = useProjectStore.getState();
          const diagram = state.project.diagrams[state.activeDiagramId];
          if (!diagram) return;
          const positions = await calculateAutoLayout(state.project, diagram);
          state.updateEntityPositions(state.activeDiagramId, positions);
          requestAnimationFrame(() => {
            graphRef.current?.zoomToFit({ padding: 72, maxScale: 1 });
          });
        },
        createSvg: (options) => {
          const graph = graphRef.current;
          return graph ? createDiagramSvg(graph, options) : null;
        },
      }),
      [],
    );

    const zoomLabel = `${Math.round(zoom * 100)}%`;

    return (
      <section className="diagram-stage" aria-label="Entity relationship canvas">
        <div ref={containerRef} className="diagram-canvas" />
        <div
          ref={minimapRef}
          className={`canvas-minimap ${minimapOpen ? "open" : ""}`}
          aria-hidden={!minimapOpen}
        />
        <button
          type="button"
          className="minimap-toggle"
          aria-label="Toggle minimap"
          title="Toggle minimap"
          onClick={() => setMinimapOpen((current) => !current)}
        >
          <Map size={14} />
        </button>
        <div className="canvas-hint">
          Drag from a column port to link attributes, or use an entity port
        </div>
        {legendOpen && (
          <aside className="notation-legend" aria-label="Crow's Foot legend">
            <header>
              <strong>Crow&apos;s Foot notation</strong>
              <button
                type="button"
                aria-label="Close notation legend"
                onClick={() => setLegendOpen(false)}
              >
                <X size={12} />
              </button>
            </header>
            <dl>
              <div>
                <dt>○│</dt>
                <dd>Zero or one</dd>
              </div>
              <div>
                <dt>││</dt>
                <dd>Exactly one</dd>
              </div>
              <div>
                <dt>○≺</dt>
                <dd>Zero or many</dd>
              </div>
              <div>
                <dt>│≺</dt>
                <dd>One or many</dd>
              </div>
            </dl>
          </aside>
        )}
        <button
          type="button"
          className="legend-toggle"
          aria-label="Show Crow's Foot legend"
          title="Crow's Foot notation legend"
          onClick={() => setLegendOpen((current) => !current)}
        >
          <Info size={14} />
        </button>
        <div className="zoom-controls" aria-label="Canvas zoom controls">
          <button
            type="button"
            title="Zoom out"
            onClick={() => graphRef.current?.zoom(-0.12)}
          >
            <Minus size={15} />
          </button>
          <span>{zoomLabel}</span>
          <button
            type="button"
            title="Zoom in"
            onClick={() => graphRef.current?.zoom(0.12)}
          >
            <Plus size={15} />
          </button>
          <div className="zoom-divider" />
          <button
            type="button"
            title="Fit diagram"
            onClick={() => graphRef.current?.zoomToFit({ padding: 72, maxScale: 1 })}
          >
            <Focus size={15} />
          </button>
        </div>
      </section>
    );
  },
);

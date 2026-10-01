import type { ELK, ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import type { Diagram, EntityId, JoineryProject, Point } from "../domain/model";
import { entityNodeSize } from "./shapes";

let elkPromise: Promise<ELK> | null = null;

async function getElk(): Promise<ELK> {
  if (!elkPromise) {
    elkPromise = (async () => {
      if (typeof Worker === "undefined") {
        const bundledModule = "elkjs/lib/elk.bundled.js";
        const { default: ELKConstructor } = await import(
          /* @vite-ignore */ bundledModule
        );
        return new ELKConstructor();
      }

      const [{ default: ELKConstructor }, { default: ELKWorker }] = await Promise.all([
        import("elkjs/lib/elk-api.js"),
        import("elkjs/lib/elk-worker.min.js?worker"),
      ]);
      return new ELKConstructor({
        workerFactory: () => new ELKWorker(),
      });
    })();
  }
  return elkPromise;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(left: Rectangle, right: Rectangle, gap = 38): boolean {
  return !(
    left.x + left.width + gap <= right.x ||
    right.x + right.width + gap <= left.x ||
    left.y + left.height + gap <= right.y ||
    right.y + right.height + gap <= left.y
  );
}

function avoidPinnedCollisions(
  project: JoineryProject,
  diagram: Diagram,
  positions: Record<EntityId, Point>,
): Record<EntityId, Point> {
  const occupied: Rectangle[] = Object.entries(diagram.entityViews)
    .filter(([, view]) => view.pinned)
    .map(([entityId, view]) => {
      const size = entityNodeSize(project.model.entities[entityId], view);
      return { x: view.x, y: view.y, ...size };
    });
  const resolved: Record<EntityId, Point> = {};

  Object.entries(positions).forEach(([entityId, position]) => {
    const view = diagram.entityViews[entityId];
    const size = entityNodeSize(project.model.entities[entityId], view);
    const candidate: Rectangle = { ...position, ...size };
    let attempts = 0;
    while (attempts < 100) {
      const collision = occupied.find((rectangle) => overlaps(candidate, rectangle));
      if (!collision) break;
      candidate.y = collision.y + collision.height + 64;
      attempts += 1;
    }
    occupied.push(candidate);
    resolved[entityId] = { x: candidate.x, y: candidate.y };
  });

  return resolved;
}

export async function calculateAutoLayout(
  project: JoineryProject,
  diagram: Diagram,
): Promise<Record<EntityId, Point>> {
  const movableEntries = Object.entries(diagram.entityViews).filter(
    ([, view]) => !view.pinned,
  );
  const movableEntityIds = new Set(movableEntries.map(([entityId]) => entityId));
  if (movableEntries.length === 0) return {};

  const children: ElkNode[] = movableEntries.map(([entityId, view]) => {
    const entity = project.model.entities[entityId];
    const size = entityNodeSize(entity, view);
    return {
      id: entityId,
      width: size.width,
      height: size.height,
    };
  });

  // N-ary relationships feed ELK a star of binary edges toward the first
  // participant so all involved entities stay clustered.
  const edges: ElkExtendedEdge[] = Object.values(project.model.relationships).flatMap(
    (relationship) => {
      if (relationship.participants?.length) {
        const [first, ...rest] = relationship.participants;
        return rest
          .filter(
            (participant) =>
              movableEntityIds.has(participant.entityId) &&
              movableEntityIds.has(first.entityId),
          )
          .map((participant, index) => ({
            id: `${relationship.id}#${index}`,
            sources: [participant.entityId],
            targets: [first.entityId],
          }));
      }
      return movableEntityIds.has(relationship.sourceEntityId) &&
        movableEntityIds.has(relationship.targetEntityId)
        ? [
            {
              id: relationship.id,
              sources: [relationship.sourceEntityId],
              targets: [relationship.targetEntityId],
            },
          ]
        : [];
    },
  );

  const elk = await getElk();
  const result = await elk.layout({
    id: "joinery-layout",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.alignment": "CENTER",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "64",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.layered.spacing.edgeNodeBetweenLayers": "42",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.padding": "[top=64,left=64,bottom=64,right=64]",
    },
    children,
    edges,
  });

  const positions = Object.fromEntries(
    (result.children ?? []).map((node) => [
      node.id,
      { x: node.x ?? 0, y: node.y ?? 0 },
    ]),
  );
  return avoidPinnedCollisions(project, diagram, positions);
}

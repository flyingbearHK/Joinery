import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AttributeImportDraft } from "../domain/attributeImport";
import type { ModelDifference } from "../domain/compare";
import { mergeDifferences, type MergeResult } from "../domain/merge";
import type {
  Attribute,
  AttributeId,
  Cardinality,
  DiagramId,
  Entity,
  EntityId,
  EntityIdentifier,
  IdentifierId,
  IdentifierKind,
  InversionEntry,
  InversionEntryId,
  JoineryProject,
  Point,
  ProjectSelection,
  Relationship,
  RelationshipId,
  RelationshipKind,
  RelationshipParticipant,
} from "../domain/model";
import {
  createAttribute,
  createBlankProject,
  createEntity,
  createId,
  createSampleProject,
  nextEntityPosition,
} from "../domain/project";

interface HistorySnapshot {
  project: JoineryProject;
  activeDiagramId: DiagramId;
  selection: ProjectSelection;
  label: string;
}

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  lastMergeKey: string | null;
  lastMergeAt: number;
}

interface EntityClipboard {
  entity: Entity;
  pasteCount: number;
}

export interface ProjectStore {
  project: JoineryProject;
  activeDiagramId: DiagramId;
  selection: ProjectSelection;
  isDirty: boolean;
  history: HistoryState;
  clipboard: EntityClipboard | null;

  loadProject: (project: JoineryProject, isDirty?: boolean) => void;
  createNewProject: () => void;
  markSaved: () => void;
  updateProject: (
    changes: Partial<Pick<JoineryProject, "name" | "description">>,
  ) => void;
  updateProjectSettings: (changes: Partial<JoineryProject["settings"]>) => void;
  addLogicalType: () => string;
  updateLogicalType: (
    logicalTypeId: string,
    changes: Partial<
      Pick<
        JoineryProject["model"]["logicalTypes"][string],
        "name" | "baseType" | "description" | "format"
      >
    >,
  ) => void;
  deleteLogicalType: (logicalTypeId: string) => void;

  undo: () => boolean;
  redo: () => boolean;
  clearHistory: () => void;

  setSelection: (selection: ProjectSelection) => void;
  setActiveDiagram: (diagramId: DiagramId) => void;
  addDiagram: () => DiagramId;
  updateDiagram: (
    diagramId: DiagramId,
    changes: Partial<Pick<JoineryProject["diagrams"][string], "name" | "description">>,
  ) => void;
  duplicateDiagram: (diagramId: DiagramId) => DiagramId | null;
  deleteDiagram: (diagramId: DiagramId) => boolean;
  setEntityVisibility: (
    diagramId: DiagramId,
    entityId: EntityId,
    visible: boolean,
  ) => void;
  setVisibleEntityIds: (diagramId: DiagramId, entityIds: EntityId[]) => void;
  ensureEntityVisible: (entityId: EntityId, diagramId?: DiagramId) => void;

  addEntity: (position?: Point) => EntityId;
  updateEntity: (
    entityId: EntityId,
    changes: Partial<
      Pick<
        JoineryProject["model"]["entities"][string],
        "name" | "description" | "color"
      >
    >,
  ) => void;
  deleteEntity: (entityId: EntityId) => void;
  copySelection: () => boolean;
  pasteEntity: () => EntityId | null;
  duplicateEntity: (entityId: EntityId) => EntityId | null;

  addAttribute: (entityId: EntityId, afterAttributeId?: AttributeId) => AttributeId;
  addAttributes: (
    entityId: EntityId,
    drafts: AttributeImportDraft[],
    afterAttributeId?: AttributeId,
  ) => AttributeId[];
  addEntityWithAttributes: (name: string, drafts: AttributeImportDraft[]) => EntityId;
  updateAttribute: (
    entityId: EntityId,
    attributeId: AttributeId,
    changes: Partial<
      Pick<
        JoineryProject["model"]["entities"][string]["attributes"][number],
        "name" | "logicalType" | "description" | "isRequired" | "isIdentifier"
      >
    >,
  ) => void;
  moveAttribute: (
    entityId: EntityId,
    attributeId: AttributeId,
    targetIndex: number,
  ) => void;
  reorderAttributes: (entityId: EntityId, attributeIds: string[]) => void;
  deleteAttribute: (entityId: EntityId, attributeId: AttributeId) => void;

  addIdentifier: (entityId: EntityId, kind?: IdentifierKind) => IdentifierId | null;
  updateIdentifier: (
    entityId: EntityId,
    identifierId: IdentifierId,
    changes: Partial<Pick<EntityIdentifier, "name" | "kind" | "attributeIds">>,
  ) => void;
  deleteIdentifier: (entityId: EntityId, identifierId: IdentifierId) => void;

  addInversionEntry: (entityId: EntityId) => InversionEntryId | null;
  updateInversionEntry: (
    entityId: EntityId,
    entryId: InversionEntryId,
    changes: Partial<Pick<InversionEntry, "name" | "description" | "attributeIds">>,
  ) => void;
  deleteInversionEntry: (entityId: EntityId, entryId: InversionEntryId) => void;

  addRelationship: (
    sourceEntityId: EntityId,
    targetEntityId: EntityId,
    relationshipId?: RelationshipId,
    sourceAttributeId?: AttributeId | null,
    targetAttributeId?: AttributeId | null,
    initial?: Partial<{
      name: string;
      description: string;
      kind: RelationshipKind;
      sourceRole: string;
      targetRole: string;
      sourceCardinality: Cardinality;
      targetCardinality: Cardinality;
      isIdentifying: boolean;
      participants: Array<
        Pick<RelationshipParticipant, "entityId"> &
          Partial<Pick<RelationshipParticipant, "attributeId" | "role" | "cardinality">>
      >;
    }>,
  ) => RelationshipId | null;
  updateRelationship: (
    relationshipId: RelationshipId,
    changes: Partial<{
      name: string;
      description: string;
      kind: RelationshipKind;
      sourceRole: string;
      targetRole: string;
      sourceEntityId: EntityId;
      targetEntityId: EntityId;
      sourceAttributeId: AttributeId | null;
      targetAttributeId: AttributeId | null;
      sourceCardinality: Cardinality;
      targetCardinality: Cardinality;
      isIdentifying: boolean;
    }>,
  ) => boolean;
  deleteRelationship: (relationshipId: RelationshipId) => void;
  setRelationshipParticipants: (
    relationshipId: RelationshipId,
    participants: Array<
      Pick<RelationshipParticipant, "entityId"> &
        Partial<
          Pick<RelationshipParticipant, "id" | "attributeId" | "role" | "cardinality">
        >
    >,
  ) => boolean;
  updateRelationshipHub: (
    diagramId: DiagramId,
    relationshipId: RelationshipId,
    position: Point | null,
  ) => void;

  updateEntityPosition: (
    diagramId: DiagramId,
    entityId: EntityId,
    position: Point,
  ) => void;
  updateEntityPositions: (
    diagramId: DiagramId,
    positions: Record<EntityId, Point>,
  ) => void;
  toggleEntityCollapsed: (diagramId: DiagramId, entityId: EntityId) => void;
  toggleEntityPinned: (diagramId: DiagramId, entityId: EntityId) => void;
  updateRelationshipVertices: (
    diagramId: DiagramId,
    relationshipId: RelationshipId,
    vertices: Point[],
  ) => void;
  addDiagramNote: (
    diagramId: DiagramId,
    position?: Point,
    entityId?: EntityId,
  ) => string;
  updateDiagramNote: (
    diagramId: DiagramId,
    noteId: string,
    changes: Partial<
      Pick<
        JoineryProject["diagrams"][string]["notes"][string],
        "text" | "x" | "y" | "width" | "height" | "color" | "entityId"
      >
    >,
  ) => void;
  deleteDiagramNote: (diagramId: DiagramId, noteId: string) => void;
  addSubjectArea: (diagramId: DiagramId, position?: Point) => string;
  updateSubjectArea: (
    diagramId: DiagramId,
    subjectAreaId: string,
    changes: Partial<
      Pick<
        JoineryProject["diagrams"][string]["subjectAreas"][string],
        "name" | "description" | "x" | "y" | "width" | "height" | "color"
      >
    >,
  ) => void;
  deleteSubjectArea: (diagramId: DiagramId, subjectAreaId: string) => void;
  deleteSelection: () => void;
  applyComparisonMerge: (
    comparison: JoineryProject,
    differences: ModelDifference[],
  ) => MergeResult;
  resetSampleProject: () => void;
}

const HISTORY_LIMIT = 100;
const MERGE_WINDOW_MS = 900;
const initialProject = createSampleProject();
const initialDiagramId = Object.keys(initialProject.diagrams)[0];
let savedProjectSignature = JSON.stringify(initialProject);

function emptyHistory(): HistoryState {
  return {
    past: [],
    future: [],
    lastMergeKey: null,
    lastMergeAt: 0,
  };
}

function touchProject(state: ProjectStore): void {
  state.project.updatedAt = new Date().toISOString();
  state.isDirty = true;
}

/** Mirrors the first two participants into the binary fields (compat). */
function syncBinaryProjection(relationship: Relationship): void {
  const [first, second] = relationship.participants ?? [];
  if (!first || !second) return;
  relationship.sourceEntityId = first.entityId;
  relationship.sourceAttributeId = first.attributeId;
  relationship.sourceRole = first.role;
  relationship.sourceCardinality = first.cardinality;
  relationship.targetEntityId = second.entityId;
  relationship.targetAttributeId = second.attributeId;
  relationship.targetRole = second.role;
  relationship.targetCardinality = second.cardinality;
}

/** Turns a participants list of exactly two back into binary endpoint fields. */
function collapseToBinary(relationship: Relationship): void {
  syncBinaryProjection(relationship);
  delete relationship.participants;
}

function recordHistory(
  state: ProjectStore,
  before: ProjectStore,
  label: string,
  mergeKey?: string,
): void {
  const now = Date.now();
  const canMerge = Boolean(
    mergeKey &&
    state.history.lastMergeKey === mergeKey &&
    now - state.history.lastMergeAt <= MERGE_WINDOW_MS,
  );

  if (!canMerge) {
    state.history.past.push({
      project: before.project,
      activeDiagramId: before.activeDiagramId,
      selection: before.selection,
      label,
    });
    if (state.history.past.length > HISTORY_LIMIT) {
      state.history.past.shift();
    }
  }

  state.history.future = [];
  state.history.lastMergeKey = mergeKey ?? null;
  state.history.lastMergeAt = now;
}

function syncIdentifierFlags(entity: Entity): void {
  const identifierAttributeIds = new Set(
    entity.identifiers.flatMap((identifier) => identifier.attributeIds),
  );
  entity.attributes.forEach((attribute) => {
    attribute.isIdentifier = identifierAttributeIds.has(attribute.id);
  });
}

function cloneEntity(entity: Entity, copyNumber = 1): Entity {
  const attributeIds = new Map<AttributeId, AttributeId>();
  const attributes = entity.attributes.map((attribute) => {
    const id = createId("attribute");
    attributeIds.set(attribute.id, id);
    return { ...attribute, id };
  });

  return {
    ...entity,
    id: createId("entity"),
    name: `${entity.name || "Untitled entity"} copy${
      copyNumber > 1 ? ` ${copyNumber}` : ""
    }`,
    attributes,
    identifiers: entity.identifiers.map((identifier) => ({
      ...identifier,
      id: createId("identifier"),
      attributeIds: identifier.attributeIds
        .map((attributeId) => attributeIds.get(attributeId))
        .filter((attributeId): attributeId is string => Boolean(attributeId)),
    })),
    inversionEntries: entity.inversionEntries.map((entry) => ({
      ...entry,
      id: createId("inversion_entry"),
      attributeIds: entry.attributeIds
        .map((attributeId) => attributeIds.get(attributeId))
        .filter((attributeId): attributeId is string => Boolean(attributeId)),
    })),
  };
}

function buildDraftAttributes(drafts: AttributeImportDraft[]): Attribute[] {
  return drafts.map((draft) => ({
    id: createId("attribute"),
    name: draft.name,
    logicalType: draft.logicalType,
    description: draft.description,
    isRequired: draft.isRequired,
    isIdentifier: false,
  }));
}

function applyIdentifierDrafts(
  entity: Entity,
  attributes: Attribute[],
  drafts: AttributeImportDraft[],
): void {
  const keyAttributeIds = drafts.flatMap((draft, index) =>
    draft.isIdentifier ? [attributes[index].id] : [],
  );
  if (keyAttributeIds.length === 0) return;
  let primary = entity.identifiers.find((identifier) => identifier.kind === "primary");
  if (!primary) {
    primary = {
      id: createId("identifier"),
      name: "Primary identifier",
      kind: "primary",
      attributeIds: [],
    };
    entity.identifiers.push(primary);
  }
  keyAttributeIds.forEach((attributeId) => {
    if (!primary.attributeIds.includes(attributeId)) {
      primary.attributeIds.push(attributeId);
    }
  });
}

/** Creates identifying relationships for import drafts whose "references"
 * target another entity — each new attribute is mapped to the referenced
 * entity's first identifier attribute (the classic FK-column workflow). */
function applyRelationshipDrafts(
  state: { project: JoineryProject },
  targetEntityId: EntityId,
  attributes: Attribute[],
  drafts: AttributeImportDraft[],
): void {
  drafts.forEach((draft, index) => {
    if (!draft.referencesEntityId) return;
    const sourceEntity = state.project.model.entities[draft.referencesEntityId];
    const sourceAttributeId = sourceEntity?.identifiers[0]?.attributeIds[0] ?? null;
    if (!sourceEntity) return;
    const id = createId("relationship");
    const relationship: Relationship = {
      id,
      name: "",
      description: "",
      kind: "association",
      sourceRole: "",
      targetRole: "",
      sourceEntityId: sourceEntity.id,
      targetEntityId,
      sourceAttributeId,
      targetAttributeId: attributes[index].id,
      sourceCardinality: "exactly-one",
      targetCardinality: "zero-or-many",
      isIdentifying: draft.isIdentifier,
    };
    state.project.model.relationships[id] = relationship;
  });
}

function selectionExists(
  project: JoineryProject,
  selection: ProjectSelection,
  diagramId?: DiagramId,
): boolean {
  if (!selection) return true;
  if (selection.kind === "entity") {
    return Boolean(project.model.entities[selection.id]);
  }
  if (selection.kind === "relationship") {
    return Boolean(project.model.relationships[selection.id]);
  }
  const diagram = diagramId ? project.diagrams[diagramId] : undefined;
  return selection.kind === "note"
    ? Boolean(diagram?.notes[selection.id])
    : Boolean(diagram?.subjectAreas[selection.id]);
}

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    project: initialProject,
    activeDiagramId: initialDiagramId,
    selection: null,
    isDirty: false,
    history: emptyHistory(),
    clipboard: null,

    loadProject: (project, isDirty = false) => {
      savedProjectSignature = isDirty ? "" : JSON.stringify(project);
      const firstDiagramId = Object.keys(project.diagrams)[0];
      set((state) => {
        state.project = project;
        state.activeDiagramId = firstDiagramId;
        state.selection = null;
        state.isDirty = isDirty;
        state.history = emptyHistory();
        state.clipboard = null;
      });
    },

    createNewProject: () => {
      const project = createBlankProject();
      savedProjectSignature = JSON.stringify(project);
      set((state) => {
        state.project = project;
        state.activeDiagramId = Object.keys(project.diagrams)[0];
        state.selection = null;
        state.isDirty = false;
        state.history = emptyHistory();
        state.clipboard = null;
      });
    },

    markSaved: () => {
      savedProjectSignature = JSON.stringify(get().project);
      set((state) => {
        state.isDirty = false;
      });
    },

    updateProject: (changes) => {
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit project",
          `project:${Object.keys(changes).sort().join(",")}`,
        );
        Object.assign(state.project, changes);
        touchProject(state);
      });
    },

    updateProjectSettings: (changes) => {
      const before = get();
      set((state) => {
        recordHistory(state, before, "Edit model standards");
        Object.assign(state.project.settings, changes);
        touchProject(state);
      });
    },

    addLogicalType: () => {
      const logicalTypeId = createId("logical_type");
      const before = get();
      set((state) => {
        recordHistory(state, before, "Add logical type");
        state.project.model.logicalTypes[logicalTypeId] = {
          id: logicalTypeId,
          name: "New logical type",
          baseType: "Text",
          description: "",
          format: "",
        };
        touchProject(state);
      });
      return logicalTypeId;
    },

    updateLogicalType: (logicalTypeId, changes) => {
      if (!get().project.model.logicalTypes[logicalTypeId]) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit logical type",
          `logical-type:${logicalTypeId}:${Object.keys(changes).sort().join(",")}`,
        );
        Object.assign(state.project.model.logicalTypes[logicalTypeId], changes);
        touchProject(state);
      });
    },

    deleteLogicalType: (logicalTypeId) => {
      if (!get().project.model.logicalTypes[logicalTypeId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete logical type");
        delete state.project.model.logicalTypes[logicalTypeId];
        touchProject(state);
      });
    },

    undo: () => {
      const before = get();
      const snapshot = before.history.past[before.history.past.length - 1];
      if (!snapshot) return false;

      set((state) => {
        state.history.past.pop();
        state.history.future.push({
          project: before.project,
          activeDiagramId: before.activeDiagramId,
          selection: before.selection,
          label: snapshot.label,
        });
        state.project = snapshot.project;
        state.activeDiagramId = state.project.diagrams[snapshot.activeDiagramId]
          ? snapshot.activeDiagramId
          : Object.keys(state.project.diagrams)[0];
        state.selection = selectionExists(
          state.project,
          snapshot.selection,
          state.activeDiagramId,
        )
          ? snapshot.selection
          : null;
        state.isDirty = JSON.stringify(state.project) !== savedProjectSignature;
        state.history.lastMergeKey = null;
        state.history.lastMergeAt = 0;
      });
      return true;
    },

    redo: () => {
      const before = get();
      const snapshot = before.history.future[before.history.future.length - 1];
      if (!snapshot) return false;

      set((state) => {
        state.history.future.pop();
        state.history.past.push({
          project: before.project,
          activeDiagramId: before.activeDiagramId,
          selection: before.selection,
          label: snapshot.label,
        });
        state.project = snapshot.project;
        state.activeDiagramId = state.project.diagrams[snapshot.activeDiagramId]
          ? snapshot.activeDiagramId
          : Object.keys(state.project.diagrams)[0];
        state.selection = selectionExists(
          state.project,
          snapshot.selection,
          state.activeDiagramId,
        )
          ? snapshot.selection
          : null;
        state.isDirty = JSON.stringify(state.project) !== savedProjectSignature;
        state.history.lastMergeKey = null;
        state.history.lastMergeAt = 0;
      });
      return true;
    },

    clearHistory: () => {
      set((state) => {
        state.history = emptyHistory();
      });
    },

    setSelection: (selection) => {
      set((state) => {
        if (
          state.selection?.kind === selection?.kind &&
          state.selection?.id === selection?.id &&
          (state.selection?.kind !== "entity" ||
            selection?.kind !== "entity" ||
            state.selection.attributeId === selection.attributeId)
        ) {
          return;
        }
        state.selection = selection;
      });
    },

    setActiveDiagram: (diagramId) => {
      if (!get().project.diagrams[diagramId]) return;
      set((state) => {
        state.activeDiagramId = diagramId;
        state.selection = null;
      });
    },

    addDiagram: () => {
      const diagramId = createId("diagram");
      const before = get();
      set((state) => {
        recordHistory(state, before, "Add diagram");
        const diagramNumber = Object.keys(state.project.diagrams).length + 1;
        state.project.diagrams[diagramId] = {
          id: diagramId,
          name: `Diagram ${diagramNumber}`,
          description: "",
          entityViews: {},
          relationshipViews: {},
          notes: {},
          subjectAreas: {},
        };
        state.activeDiagramId = diagramId;
        state.selection = null;
        touchProject(state);
      });
      return diagramId;
    },

    updateDiagram: (diagramId, changes) => {
      if (!get().project.diagrams[diagramId]) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit diagram",
          `diagram:${diagramId}:${Object.keys(changes).sort().join(",")}`,
        );
        Object.assign(state.project.diagrams[diagramId], changes);
        touchProject(state);
      });
    },

    duplicateDiagram: (diagramId) => {
      const source = get().project.diagrams[diagramId];
      if (!source) return null;
      const duplicateId = createId("diagram");
      const before = get();
      set((state) => {
        recordHistory(state, before, "Duplicate diagram");
        state.project.diagrams[duplicateId] = {
          ...source,
          id: duplicateId,
          name: `${source.name} copy`,
          entityViews: Object.fromEntries(
            Object.entries(source.entityViews).map(([entityId, view]) => [
              entityId,
              { ...view, x: view.x + 24, y: view.y + 24 },
            ]),
          ),
          relationshipViews: Object.fromEntries(
            Object.entries(source.relationshipViews).map(([relationshipId, view]) => [
              relationshipId,
              {
                vertices: view.vertices.map((vertex) => ({
                  x: vertex.x + 24,
                  y: vertex.y + 24,
                })),
              },
            ]),
          ),
          notes: Object.fromEntries(
            Object.values(source.notes).map((note) => {
              const noteId = createId("note");
              return [noteId, { ...note, id: noteId, x: note.x + 24, y: note.y + 24 }];
            }),
          ),
          subjectAreas: Object.fromEntries(
            Object.values(source.subjectAreas).map((area) => {
              const areaId = createId("subject");
              return [areaId, { ...area, id: areaId, x: area.x + 24, y: area.y + 24 }];
            }),
          ),
        };
        state.activeDiagramId = duplicateId;
        state.selection = null;
        touchProject(state);
      });
      return duplicateId;
    },

    deleteDiagram: (diagramId) => {
      const current = get();
      const diagramIds = Object.keys(current.project.diagrams);
      if (!current.project.diagrams[diagramId] || diagramIds.length <= 1) {
        return false;
      }
      const before = current;
      set((state) => {
        recordHistory(state, before, "Delete diagram");
        delete state.project.diagrams[diagramId];
        if (state.activeDiagramId === diagramId) {
          state.activeDiagramId = Object.keys(state.project.diagrams)[0];
          state.selection = null;
        }
        touchProject(state);
      });
      return true;
    },

    setEntityVisibility: (diagramId, entityId, visible) => {
      const current = get();
      const diagram = current.project.diagrams[diagramId];
      if (!diagram || !current.project.model.entities[entityId]) return;
      if (visible === Boolean(diagram.entityViews[entityId])) return;
      const before = current;
      set((state) => {
        recordHistory(state, before, visible ? "Show entity" : "Hide entity");
        const targetDiagram = state.project.diagrams[diagramId];
        if (visible) {
          targetDiagram.entityViews[entityId] = {
            ...nextEntityPosition(targetDiagram),
            collapsed: false,
            pinned: false,
          };
        } else {
          delete targetDiagram.entityViews[entityId];
          if (state.selection?.kind === "entity" && state.selection.id === entityId) {
            state.selection = null;
          }
          if (state.selection?.kind === "relationship") {
            const relationship = state.project.model.relationships[state.selection.id];
            if (
              relationship?.sourceEntityId === entityId ||
              relationship?.targetEntityId === entityId
            ) {
              state.selection = null;
            }
          }
        }
        touchProject(state);
      });
    },

    setVisibleEntityIds: (diagramId, entityIds) => {
      const current = get();
      const diagram = current.project.diagrams[diagramId];
      if (!diagram) return;
      const validIds = Array.from(new Set(entityIds)).filter((entityId) =>
        Boolean(current.project.model.entities[entityId]),
      );
      const before = current;
      set((state) => {
        recordHistory(state, before, "Change diagram visibility");
        const target = state.project.diagrams[diagramId];
        const nextViews: typeof target.entityViews = {};
        validIds.forEach((entityId) => {
          nextViews[entityId] = target.entityViews[entityId] ?? {
            ...nextEntityPosition({ ...target, entityViews: nextViews }),
            collapsed: false,
            pinned: false,
          };
        });
        target.entityViews = nextViews;
        if (state.selection?.kind === "entity" && !nextViews[state.selection.id]) {
          state.selection = null;
        }
        if (state.selection?.kind === "relationship") {
          const relationship = state.project.model.relationships[state.selection.id];
          if (
            relationship &&
            (!nextViews[relationship.sourceEntityId] ||
              !nextViews[relationship.targetEntityId])
          ) {
            state.selection = null;
          }
        }
        touchProject(state);
      });
    },

    ensureEntityVisible: (entityId, requestedDiagramId) => {
      const current = get();
      const diagramId = requestedDiagramId ?? current.activeDiagramId;
      const diagram = current.project.diagrams[diagramId];
      if (!diagram || !current.project.model.entities[entityId]) return;
      if (diagram.entityViews[entityId]) return;
      current.setEntityVisibility(diagramId, entityId, true);
    },

    addEntity: (position) => {
      const entity = createEntity();
      const before = get();
      set((state) => {
        recordHistory(state, before, "Add entity");
        const diagram = state.project.diagrams[state.activeDiagramId];
        const entityPosition = position ?? nextEntityPosition(diagram);
        state.project.model.entities[entity.id] = entity;
        diagram.entityViews[entity.id] = {
          ...entityPosition,
          collapsed: false,
          pinned: false,
        };
        state.selection = { kind: "entity", id: entity.id };
        touchProject(state);
      });
      return entity.id;
    },

    updateEntity: (entityId, changes) => {
      if (!get().project.model.entities[entityId]) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit entity",
          `entity:${entityId}:${Object.keys(changes).sort().join(",")}`,
        );
        Object.assign(state.project.model.entities[entityId], changes);
        touchProject(state);
      });
    },

    deleteEntity: (entityId) => {
      if (!get().project.model.entities[entityId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete entity");
        delete state.project.model.entities[entityId];
        Object.values(state.project.diagrams).forEach((diagram) => {
          delete diagram.entityViews[entityId];
          // Attached comments belong to the entity on this diagram.
          Object.values(diagram.notes).forEach((note) => {
            if (note.entityId === entityId) delete diagram.notes[note.id];
          });
        });
        Object.values(state.project.model.relationships).forEach((relationship) => {
          if (relationship.participants) {
            relationship.participants = relationship.participants.filter(
              (participant) => participant.entityId !== entityId,
            );
            if (relationship.participants.length < 2) {
              delete state.project.model.relationships[relationship.id];
              Object.values(state.project.diagrams).forEach((diagram) => {
                delete diagram.relationshipViews[relationship.id];
              });
              return;
            }
            if (relationship.participants.length === 2) {
              collapseToBinary(relationship);
              return;
            }
            syncBinaryProjection(relationship);
            return;
          }
          if (
            relationship.sourceEntityId === entityId ||
            relationship.targetEntityId === entityId
          ) {
            delete state.project.model.relationships[relationship.id];
            Object.values(state.project.diagrams).forEach((diagram) => {
              delete diagram.relationshipViews[relationship.id];
            });
          }
        });
        if (state.selection?.id === entityId) state.selection = null;
        touchProject(state);
      });
    },

    copySelection: () => {
      const current = get();
      if (current.selection?.kind !== "entity") return false;
      const entity = current.project.model.entities[current.selection.id];
      if (!entity) return false;
      set((state) => {
        state.clipboard = {
          entity,
          pasteCount: 0,
        };
      });
      return true;
    },

    pasteEntity: () => {
      const current = get();
      if (!current.clipboard) return null;
      const copyNumber = current.clipboard.pasteCount + 1;
      const entity = cloneEntity(current.clipboard.entity, copyNumber);
      const before = current;
      set((state) => {
        recordHistory(state, before, "Paste entity");
        const diagram = state.project.diagrams[state.activeDiagramId];
        const basePosition = nextEntityPosition(diagram);
        state.project.model.entities[entity.id] = entity;
        diagram.entityViews[entity.id] = {
          x: basePosition.x + copyNumber * 20,
          y: basePosition.y + copyNumber * 20,
          collapsed: false,
          pinned: false,
        };
        if (state.clipboard) state.clipboard.pasteCount = copyNumber;
        state.selection = { kind: "entity", id: entity.id };
        touchProject(state);
      });
      return entity.id;
    },

    duplicateEntity: (entityId) => {
      const source = get().project.model.entities[entityId];
      if (!source) return null;
      const entity = cloneEntity(source);
      const before = get();
      set((state) => {
        recordHistory(state, before, "Duplicate entity");
        const diagram = state.project.diagrams[state.activeDiagramId];
        const sourceView = diagram.entityViews[entityId];
        state.project.model.entities[entity.id] = entity;
        diagram.entityViews[entity.id] = sourceView
          ? {
              ...sourceView,
              x: sourceView.x + 36,
              y: sourceView.y + 36,
              pinned: false,
            }
          : {
              ...nextEntityPosition(diagram),
              collapsed: false,
              pinned: false,
            };
        state.selection = { kind: "entity", id: entity.id };
        touchProject(state);
      });
      return entity.id;
    },

    addAttribute: (entityId, afterAttributeId) => {
      const attribute = createAttribute();
      const entity = get().project.model.entities[entityId];
      if (!entity) return attribute.id;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Add attribute");
        const target = state.project.model.entities[entityId];
        const afterIndex = afterAttributeId
          ? target.attributes.findIndex(
              (candidate) => candidate.id === afterAttributeId,
            )
          : -1;
        if (afterIndex >= 0) target.attributes.splice(afterIndex + 1, 0, attribute);
        else target.attributes.push(attribute);
        touchProject(state);
      });
      return attribute.id;
    },

    addAttributes: (entityId, drafts, afterAttributeId) => {
      const entity = get().project.model.entities[entityId];
      if (!entity || drafts.length === 0) return [];
      const attributes = buildDraftAttributes(drafts);
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          attributes.length === 1
            ? "Add attribute"
            : `Add ${attributes.length} attributes`,
        );
        const target = state.project.model.entities[entityId];
        const afterIndex = afterAttributeId
          ? target.attributes.findIndex(
              (candidate) => candidate.id === afterAttributeId,
            )
          : -1;
        if (afterIndex >= 0) {
          target.attributes.splice(afterIndex + 1, 0, ...attributes);
        } else {
          target.attributes.push(...attributes);
        }
        applyIdentifierDrafts(target, attributes, drafts);
        applyRelationshipDrafts(state, entityId, attributes, drafts);
        syncIdentifierFlags(target);
        touchProject(state);
      });
      return attributes.map((attribute) => attribute.id);
    },

    addEntityWithAttributes: (name, drafts) => {
      const entity = createEntity(name.trim() || undefined);
      const attributes = buildDraftAttributes(drafts);
      const before = get();
      set((state) => {
        recordHistory(state, before, "Add entity");
        const diagram = state.project.diagrams[state.activeDiagramId];
        const entityPosition = nextEntityPosition(diagram);
        entity.attributes.push(...attributes);
        applyIdentifierDrafts(entity, attributes, drafts);
        syncIdentifierFlags(entity);
        state.project.model.entities[entity.id] = entity;
        applyRelationshipDrafts(state, entity.id, attributes, drafts);
        diagram.entityViews[entity.id] = {
          ...entityPosition,
          collapsed: false,
          pinned: false,
        };
        state.selection = { kind: "entity", id: entity.id };
        touchProject(state);
      });
      return entity.id;
    },

    updateAttribute: (entityId, attributeId, changes) => {
      const entity = get().project.model.entities[entityId];
      const attribute = entity?.attributes.find(
        (candidate) => candidate.id === attributeId,
      );
      if (!entity || !attribute) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit attribute",
          `attribute:${attributeId}:${Object.keys(changes).sort().join(",")}`,
        );
        const targetEntity = state.project.model.entities[entityId];
        const targetAttribute = targetEntity.attributes.find(
          (candidate) => candidate.id === attributeId,
        );
        if (!targetAttribute) return;

        const { isIdentifier, ...attributeChanges } = changes;
        Object.assign(targetAttribute, attributeChanges);
        if (typeof isIdentifier === "boolean") {
          const primary = targetEntity.identifiers.find(
            (identifier) => identifier.kind === "primary",
          );
          if (isIdentifier) {
            if (primary) {
              if (!primary.attributeIds.includes(attributeId)) {
                primary.attributeIds.push(attributeId);
              }
            } else {
              targetEntity.identifiers.push({
                id: createId("identifier"),
                name: "Primary identifier",
                kind: "primary",
                attributeIds: [attributeId],
              });
            }
          } else {
            targetEntity.identifiers.forEach((identifier) => {
              identifier.attributeIds = identifier.attributeIds.filter(
                (candidate) => candidate !== attributeId,
              );
            });
            targetEntity.identifiers = targetEntity.identifiers.filter(
              (identifier) => identifier.attributeIds.length > 0,
            );
          }
        }
        syncIdentifierFlags(targetEntity);
        touchProject(state);
      });
    },

    moveAttribute: (entityId, attributeId, targetIndex) => {
      const entity = get().project.model.entities[entityId];
      if (!entity) return;
      const sourceIndex = entity.attributes.findIndex(
        (attribute) => attribute.id === attributeId,
      );
      const boundedTarget = Math.max(
        0,
        Math.min(targetIndex, entity.attributes.length - 1),
      );
      if (sourceIndex < 0 || sourceIndex === boundedTarget) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Reorder attribute",
          `attr-move:${entityId}:${attributeId}`,
        );
        const attributes = state.project.model.entities[entityId].attributes;
        const [attribute] = attributes.splice(sourceIndex, 1);
        attributes.splice(boundedTarget, 0, attribute);
        touchProject(state);
      });
    },

    reorderAttributes: (entityId, attributeIds) => {
      const entity = get().project.model.entities[entityId];
      if (!entity) return;
      const current = new Set(entity.attributes.map((attribute) => attribute.id));
      const next = new Set(attributeIds);
      if (
        attributeIds.length !== entity.attributes.length ||
        next.size !== attributeIds.length ||
        current.size !== next.size
      )
        return;
      for (const id of attributeIds) if (!current.has(id)) return;
      const unchanged = entity.attributes.every(
        (attribute, index) => attribute.id === attributeIds[index],
      );
      if (unchanged) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Reorder attributes");
        const target = state.project.model.entities[entityId];
        const byId = new Map(
          target.attributes.map((attribute) => [attribute.id, attribute]),
        );
        target.attributes = attributeIds.map((id) => byId.get(id)!);
        touchProject(state);
      });
    },

    deleteAttribute: (entityId, attributeId) => {
      const entity = get().project.model.entities[entityId];
      if (!entity?.attributes.some((attribute) => attribute.id === attributeId)) {
        return;
      }
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete attribute");
        const targetEntity = state.project.model.entities[entityId];
        targetEntity.attributes = targetEntity.attributes.filter(
          (attribute) => attribute.id !== attributeId,
        );
        targetEntity.identifiers.forEach((identifier) => {
          identifier.attributeIds = identifier.attributeIds.filter(
            (candidate) => candidate !== attributeId,
          );
        });
        targetEntity.identifiers = targetEntity.identifiers.filter(
          (identifier) => identifier.attributeIds.length > 0,
        );
        targetEntity.inversionEntries.forEach((entry) => {
          entry.attributeIds = entry.attributeIds.filter(
            (candidate) => candidate !== attributeId,
          );
        });
        targetEntity.inversionEntries = targetEntity.inversionEntries.filter(
          (entry) => entry.attributeIds.length > 0,
        );
        syncIdentifierFlags(targetEntity);
        Object.values(state.project.model.relationships).forEach((relationship) => {
          if (relationship.sourceAttributeId === attributeId) {
            relationship.sourceAttributeId = null;
          }
          if (relationship.targetAttributeId === attributeId) {
            relationship.targetAttributeId = null;
          }
        });
        touchProject(state);
      });
    },

    addIdentifier: (entityId, kind = "alternate") => {
      const entity = get().project.model.entities[entityId];
      if (!entity || entity.attributes.length === 0) return null;
      const actualKind =
        kind === "primary" && entity.identifiers.some((item) => item.kind === "primary")
          ? "alternate"
          : kind;
      const identifierId = createId("identifier");
      const before = get();
      set((state) => {
        recordHistory(state, before, "Add identifier");
        const target = state.project.model.entities[entityId];
        target.identifiers.push({
          id: identifierId,
          name:
            actualKind === "primary"
              ? "Primary identifier"
              : `Alternate identifier ${
                  target.identifiers.filter((item) => item.kind === "alternate")
                    .length + 1
                }`,
          kind: actualKind,
          attributeIds: [target.attributes[0].id],
        });
        syncIdentifierFlags(target);
        touchProject(state);
      });
      return identifierId;
    },

    updateIdentifier: (entityId, identifierId, changes) => {
      const entity = get().project.model.entities[entityId];
      const identifier = entity?.identifiers.find((item) => item.id === identifierId);
      if (!entity || !identifier) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit identifier",
          `identifier:${identifierId}:${Object.keys(changes).sort().join(",")}`,
        );
        const target = state.project.model.entities[entityId];
        const targetIdentifier = target.identifiers.find(
          (item) => item.id === identifierId,
        );
        if (!targetIdentifier) return;
        if (
          changes.kind === "primary" &&
          target.identifiers.some(
            (item) => item.id !== identifierId && item.kind === "primary",
          )
        ) {
          changes = { ...changes, kind: "alternate" };
        }
        if (changes.attributeIds) {
          const validIds = new Set(target.attributes.map((attribute) => attribute.id));
          const attributeIds = Array.from(new Set(changes.attributeIds)).filter((id) =>
            validIds.has(id),
          );
          if (attributeIds.length === 0) return;
          changes = { ...changes, attributeIds };
        }
        Object.assign(targetIdentifier, changes);
        syncIdentifierFlags(target);
        touchProject(state);
      });
    },

    deleteIdentifier: (entityId, identifierId) => {
      const entity = get().project.model.entities[entityId];
      if (!entity?.identifiers.some((item) => item.id === identifierId)) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete identifier");
        const target = state.project.model.entities[entityId];
        target.identifiers = target.identifiers.filter(
          (identifier) => identifier.id !== identifierId,
        );
        syncIdentifierFlags(target);
        touchProject(state);
      });
    },

    addInversionEntry: (entityId) => {
      const entity = get().project.model.entities[entityId];
      if (!entity || entity.attributes.length === 0) return null;
      const entryId = createId("inversion_entry");
      const before = get();
      set((state) => {
        recordHistory(state, before, "Add inversion entry");
        const target = state.project.model.entities[entityId];
        target.inversionEntries.push({
          id: entryId,
          name: `Inversion entry ${target.inversionEntries.length + 1}`,
          description: "",
          attributeIds: [target.attributes[0].id],
        });
        touchProject(state);
      });
      return entryId;
    },

    updateInversionEntry: (entityId, entryId, changes) => {
      const entity = get().project.model.entities[entityId];
      const entry = entity?.inversionEntries.find((item) => item.id === entryId);
      if (!entity || !entry) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit inversion entry",
          `inversion-entry:${entryId}:${Object.keys(changes).sort().join(",")}`,
        );
        const target = state.project.model.entities[entityId];
        const targetEntry = target.inversionEntries.find((item) => item.id === entryId);
        if (!targetEntry) return;
        if (changes.attributeIds) {
          const validIds = new Set(target.attributes.map((attribute) => attribute.id));
          const attributeIds = Array.from(new Set(changes.attributeIds)).filter((id) =>
            validIds.has(id),
          );
          if (attributeIds.length === 0) return;
          changes = { ...changes, attributeIds };
        }
        Object.assign(targetEntry, changes);
        touchProject(state);
      });
    },

    deleteInversionEntry: (entityId, entryId) => {
      const entity = get().project.model.entities[entityId];
      if (!entity?.inversionEntries.some((item) => item.id === entryId)) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete inversion entry");
        const target = state.project.model.entities[entityId];
        target.inversionEntries = target.inversionEntries.filter(
          (entry) => entry.id !== entryId,
        );
        touchProject(state);
      });
    },

    addRelationship: (
      sourceEntityId,
      targetEntityId,
      relationshipId,
      sourceAttributeId = null,
      targetAttributeId = null,
      initial = {},
    ) => {
      const project = get().project;
      if (sourceEntityId === targetEntityId && initial.kind === "inheritance") {
        return null;
      }
      if (
        !project.model.entities[sourceEntityId] ||
        !project.model.entities[targetEntityId]
      ) {
        return null;
      }

      const participantSpecs =
        (initial.participants?.length ?? 0) >= 3 ? initial.participants : undefined;
      if (
        participantSpecs?.some(
          (spec) =>
            !project.model.entities[spec.entityId] ||
            (spec.attributeId &&
              !project.model.entities[spec.entityId].attributes.some(
                (attribute) => attribute.id === spec.attributeId,
              )),
        )
      ) {
        return null;
      }

      const sourceAttributeExists = sourceAttributeId
        ? project.model.entities[sourceEntityId].attributes.some(
            (attribute) => attribute.id === sourceAttributeId,
          )
        : true;
      const targetAttributeExists = targetAttributeId
        ? project.model.entities[targetEntityId].attributes.some(
            (attribute) => attribute.id === targetAttributeId,
          )
        : true;
      if (!sourceAttributeExists || !targetAttributeExists) return null;

      // N-ary relationships are identified by their participant set, not the
      // binary pair — skip pair-based duplicate/unmapped reuse for them.
      const duplicate = participantSpecs
        ? undefined
        : Object.values(project.model.relationships).find(
            (relationship) =>
              (relationship.sourceEntityId === sourceEntityId &&
                relationship.targetEntityId === targetEntityId &&
                relationship.sourceAttributeId === sourceAttributeId &&
                relationship.targetAttributeId === targetAttributeId) ||
              (relationship.sourceEntityId === targetEntityId &&
                relationship.targetEntityId === sourceEntityId &&
                relationship.sourceAttributeId === targetAttributeId &&
                relationship.targetAttributeId === sourceAttributeId),
          );
      if (duplicate) {
        set((state) => {
          state.selection = { kind: "relationship", id: duplicate.id };
        });
        return duplicate.id;
      }

      const unmappedRelationship =
        !participantSpecs && (sourceAttributeId || targetAttributeId)
          ? Object.values(project.model.relationships).find(
              (relationship) =>
                relationship.sourceAttributeId === null &&
                relationship.targetAttributeId === null &&
                ((relationship.sourceEntityId === sourceEntityId &&
                  relationship.targetEntityId === targetEntityId) ||
                  (relationship.sourceEntityId === targetEntityId &&
                    relationship.targetEntityId === sourceEntityId)),
            )
          : undefined;
      const before = get();
      if (unmappedRelationship) {
        set((state) => {
          recordHistory(state, before, "Map relationship attributes");
          const relationship =
            state.project.model.relationships[unmappedRelationship.id];
          const sameDirection = relationship.sourceEntityId === sourceEntityId;
          relationship.sourceAttributeId = sameDirection
            ? sourceAttributeId
            : targetAttributeId;
          relationship.targetAttributeId = sameDirection
            ? targetAttributeId
            : sourceAttributeId;
          state.selection = { kind: "relationship", id: relationship.id };
          touchProject(state);
        });
        return unmappedRelationship.id;
      }

      const id = relationshipId ?? createId("relationship");
      const participants = participantSpecs?.map((spec) => ({
        id: createId("participant"),
        entityId: spec.entityId,
        attributeId: spec.attributeId ?? null,
        role: spec.role ?? "",
        cardinality: spec.cardinality ?? "zero-or-many",
      }));
      set((state) => {
        recordHistory(state, before, "Add relationship");
        const relationship: Relationship = {
          id,
          name: initial.name ?? "",
          description: initial.description ?? "",
          kind: initial.kind ?? "association",
          sourceRole: initial.sourceRole ?? "",
          targetRole: initial.targetRole ?? "",
          sourceEntityId,
          targetEntityId,
          sourceAttributeId,
          targetAttributeId,
          sourceCardinality: initial.sourceCardinality ?? "exactly-one",
          targetCardinality: initial.targetCardinality ?? "zero-or-many",
          isIdentifying: initial.isIdentifying ?? false,
        };
        if (participants) {
          relationship.participants = participants;
          // Keep the binary projection consistent for name-based lookups.
          const [first, second] = participants;
          relationship.sourceEntityId = first.entityId;
          relationship.sourceAttributeId = first.attributeId;
          relationship.sourceRole = first.role;
          relationship.sourceCardinality = first.cardinality;
          relationship.targetEntityId = second.entityId;
          relationship.targetAttributeId = second.attributeId;
          relationship.targetRole = second.role;
          relationship.targetCardinality = second.cardinality;
        }
        state.project.model.relationships[id] = relationship;
        state.selection = { kind: "relationship", id };
        touchProject(state);
      });
      return id;
    },

    updateRelationship: (relationshipId, changes) => {
      const currentState = get();
      const current = currentState.project.model.relationships[relationshipId];
      if (!current) return false;
      const nextSourceEntityId = changes.sourceEntityId ?? current.sourceEntityId;
      const nextTargetEntityId = changes.targetEntityId ?? current.targetEntityId;
      const nextSourceAttributeId =
        changes.sourceAttributeId !== undefined
          ? changes.sourceAttributeId
          : current.sourceAttributeId;
      const nextTargetAttributeId =
        changes.targetAttributeId !== undefined
          ? changes.targetAttributeId
          : current.targetAttributeId;
      const nextKind = changes.kind ?? current.kind;
      if (
        (nextKind === "inheritance" && nextSourceEntityId === nextTargetEntityId) ||
        !currentState.project.model.entities[nextSourceEntityId] ||
        !currentState.project.model.entities[nextTargetEntityId]
      ) {
        return false;
      }
      const duplicate = Object.values(currentState.project.model.relationships).some(
        (relationship) =>
          relationship.id !== relationshipId &&
          ((relationship.sourceEntityId === nextSourceEntityId &&
            relationship.targetEntityId === nextTargetEntityId &&
            relationship.sourceAttributeId === nextSourceAttributeId &&
            relationship.targetAttributeId === nextTargetAttributeId) ||
            (relationship.sourceEntityId === nextTargetEntityId &&
              relationship.targetEntityId === nextSourceEntityId &&
              relationship.sourceAttributeId === nextTargetAttributeId &&
              relationship.targetAttributeId === nextSourceAttributeId)),
      );
      if (duplicate) return false;

      const before = currentState;
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit relationship",
          `relationship:${relationshipId}:${Object.keys(changes).sort().join(",")}`,
        );
        const relationship = state.project.model.relationships[relationshipId];
        Object.assign(relationship, changes);
        // For n-ary relationships the binary fields are a projection of the
        // first two participants — route edits back onto them.
        if (relationship.participants?.length && relationship.participants[0]) {
          const [first, second] = relationship.participants;
          if (changes.sourceEntityId !== undefined)
            first.entityId = changes.sourceEntityId;
          if (changes.sourceAttributeId !== undefined)
            first.attributeId = changes.sourceAttributeId;
          if (changes.sourceRole !== undefined) first.role = changes.sourceRole;
          if (changes.sourceCardinality !== undefined)
            first.cardinality = changes.sourceCardinality;
          if (second) {
            if (changes.targetEntityId !== undefined)
              second.entityId = changes.targetEntityId;
            if (changes.targetAttributeId !== undefined)
              second.attributeId = changes.targetAttributeId;
            if (changes.targetRole !== undefined) second.role = changes.targetRole;
            if (changes.targetCardinality !== undefined)
              second.cardinality = changes.targetCardinality;
          }
        }
        const sourceEntity = state.project.model.entities[relationship.sourceEntityId];
        const targetEntity = state.project.model.entities[relationship.targetEntityId];
        if (
          relationship.sourceAttributeId &&
          !sourceEntity?.attributes.some(
            (attribute) => attribute.id === relationship.sourceAttributeId,
          )
        ) {
          relationship.sourceAttributeId = null;
        }
        if (
          relationship.targetAttributeId &&
          !targetEntity?.attributes.some(
            (attribute) => attribute.id === relationship.targetAttributeId,
          )
        ) {
          relationship.targetAttributeId = null;
        }
        touchProject(state);
      });
      return true;
    },

    deleteRelationship: (relationshipId) => {
      if (!get().project.model.relationships[relationshipId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete relationship");
        delete state.project.model.relationships[relationshipId];
        Object.values(state.project.diagrams).forEach((diagram) => {
          delete diagram.relationshipViews[relationshipId];
        });
        if (state.selection?.id === relationshipId) state.selection = null;
        touchProject(state);
      });
    },

    setRelationshipParticipants: (relationshipId, participantSpecs) => {
      const project = get().project;
      const relationship = project.model.relationships[relationshipId];
      if (!relationship || relationship.kind !== "association") return false;
      const specs = participantSpecs ?? [];
      if (
        specs.some(
          (spec) =>
            !project.model.entities[spec.entityId] ||
            (spec.attributeId &&
              !project.model.entities[spec.entityId].attributes.some(
                (attribute) => attribute.id === spec.attributeId,
              )),
        )
      ) {
        return false;
      }
      const before = get();
      set((state) => {
        recordHistory(state, before, "Edit participants");
        const target = state.project.model.relationships[relationshipId];
        if (!target) return;
        const resolved = specs.map((spec) => ({
          id: spec.id ?? createId("participant"),
          entityId: spec.entityId,
          attributeId: spec.attributeId ?? null,
          role: spec.role ?? "",
          cardinality: spec.cardinality ?? "zero-or-many",
        }));
        if (resolved.length >= 3) {
          target.participants = resolved;
          syncBinaryProjection(target);
        } else if (resolved.length === 2) {
          target.participants = resolved;
          collapseToBinary(target);
        } else {
          delete target.participants;
        }
        touchProject(state);
      });
      return true;
    },

    updateRelationshipHub: (diagramId, relationshipId, position) => {
      const diagram = get().project.diagrams[diagramId];
      if (!diagram || !get().project.model.relationships[relationshipId]) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Move relationship hub",
          `move-hub:${diagramId}:${relationshipId}`,
        );
        const view =
          state.project.diagrams[diagramId].relationshipViews[relationshipId] ??
          (state.project.diagrams[diagramId].relationshipViews[relationshipId] = {
            vertices: [],
          });
        if (position) {
          view.hub = { x: Math.round(position.x), y: Math.round(position.y) };
        } else {
          delete view.hub;
        }
        touchProject(state);
      });
    },

    updateEntityPosition: (diagramId, entityId, position) => {
      const current = get();
      const view = current.project.diagrams[diagramId]?.entityViews[entityId];
      if (!view || (view.x === position.x && view.y === position.y)) return;
      const before = current;
      set((state) => {
        recordHistory(state, before, "Move entity", `move:${diagramId}:${entityId}`);
        const target = state.project.diagrams[diagramId].entityViews[entityId];
        const dx = Math.round(position.x) - target.x;
        const dy = Math.round(position.y) - target.y;
        target.x = Math.round(position.x);
        target.y = Math.round(position.y);
        if (dx !== 0 || dy !== 0) {
          Object.values(state.project.diagrams[diagramId].notes).forEach((note) => {
            if (note.entityId === entityId) {
              note.x += dx;
              note.y += dy;
            }
          });
        }
        touchProject(state);
      });
    },

    updateEntityPositions: (diagramId, positions) => {
      if (!get().project.diagrams[diagramId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Auto arrange diagram");
        const diagram = state.project.diagrams[diagramId];
        Object.entries(positions).forEach(([entityId, position]) => {
          const view = diagram.entityViews[entityId];
          if (!view || view.pinned) return;
          const dx = Math.round(position.x) - view.x;
          const dy = Math.round(position.y) - view.y;
          view.x = Math.round(position.x);
          view.y = Math.round(position.y);
          if (dx !== 0 || dy !== 0) {
            Object.values(diagram.notes).forEach((note) => {
              if (note.entityId === entityId) {
                note.x += dx;
                note.y += dy;
              }
            });
          }
        });
        touchProject(state);
      });
    },

    toggleEntityCollapsed: (diagramId, entityId) => {
      if (!get().project.diagrams[diagramId]?.entityViews[entityId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Toggle entity collapse");
        const view = state.project.diagrams[diagramId].entityViews[entityId];
        view.collapsed = !view.collapsed;
        touchProject(state);
      });
    },

    toggleEntityPinned: (diagramId, entityId) => {
      if (!get().project.diagrams[diagramId]?.entityViews[entityId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Toggle entity pin");
        const view = state.project.diagrams[diagramId].entityViews[entityId];
        view.pinned = !view.pinned;
        touchProject(state);
      });
    },

    updateRelationshipVertices: (diagramId, relationshipId, vertices) => {
      const diagram = get().project.diagrams[diagramId];
      if (!diagram || !get().project.model.relationships[relationshipId]) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Route relationship",
          `vertices:${diagramId}:${relationshipId}`,
        );
        if (vertices.length === 0) {
          delete state.project.diagrams[diagramId].relationshipViews[relationshipId];
        } else {
          state.project.diagrams[diagramId].relationshipViews[relationshipId] = {
            vertices: vertices.map((vertex) => ({
              x: Math.round(vertex.x),
              y: Math.round(vertex.y),
            })),
          };
        }
        touchProject(state);
      });
    },

    addDiagramNote: (diagramId, position, entityId) => {
      const noteId = createId("note");
      const before = get();
      set((state) => {
        const diagram = state.project.diagrams[diagramId];
        if (!diagram) return;
        recordHistory(state, before, entityId ? "Add comment" : "Add note");
        const view = entityId ? diagram.entityViews[entityId] : undefined;
        diagram.notes[noteId] = {
          id: noteId,
          text: "",
          x: position?.x ?? (view ? view.x + 300 : 120),
          y: position?.y ?? (view ? view.y - 24 : 100),
          width: 200,
          height: 90,
          color: "#fff4c2",
          ...(entityId && state.project.model.entities[entityId] ? { entityId } : {}),
        };
        state.selection = { kind: "note", id: noteId };
        touchProject(state);
      });
      return noteId;
    },

    updateDiagramNote: (diagramId, noteId, changes) => {
      if (!get().project.diagrams[diagramId]?.notes[noteId]) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit note",
          `note:${noteId}:${Object.keys(changes).sort().join(",")}`,
        );
        Object.assign(state.project.diagrams[diagramId].notes[noteId], changes);
        touchProject(state);
      });
    },

    deleteDiagramNote: (diagramId, noteId) => {
      if (!get().project.diagrams[diagramId]?.notes[noteId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete note");
        delete state.project.diagrams[diagramId].notes[noteId];
        if (state.selection?.kind === "note" && state.selection.id === noteId) {
          state.selection = null;
        }
        touchProject(state);
      });
    },

    addSubjectArea: (diagramId, position) => {
      const subjectAreaId = createId("subject");
      const before = get();
      set((state) => {
        const diagram = state.project.diagrams[diagramId];
        if (!diagram) return;
        recordHistory(state, before, "Add subject area");
        diagram.subjectAreas[subjectAreaId] = {
          id: subjectAreaId,
          name: "Subject area",
          description: "",
          x: position?.x ?? 80,
          y: position?.y ?? 70,
          width: 720,
          height: 430,
          color: "#8b6dc7",
        };
        state.selection = { kind: "subject-area", id: subjectAreaId };
        touchProject(state);
      });
      return subjectAreaId;
    },

    updateSubjectArea: (diagramId, subjectAreaId, changes) => {
      if (!get().project.diagrams[diagramId]?.subjectAreas[subjectAreaId]) return;
      const before = get();
      set((state) => {
        recordHistory(
          state,
          before,
          "Edit subject area",
          `subject:${subjectAreaId}:${Object.keys(changes).sort().join(",")}`,
        );
        Object.assign(
          state.project.diagrams[diagramId].subjectAreas[subjectAreaId],
          changes,
        );
        touchProject(state);
      });
    },

    deleteSubjectArea: (diagramId, subjectAreaId) => {
      if (!get().project.diagrams[diagramId]?.subjectAreas[subjectAreaId]) return;
      const before = get();
      set((state) => {
        recordHistory(state, before, "Delete subject area");
        delete state.project.diagrams[diagramId].subjectAreas[subjectAreaId];
        if (
          state.selection?.kind === "subject-area" &&
          state.selection.id === subjectAreaId
        ) {
          state.selection = null;
        }
        touchProject(state);
      });
    },

    applyComparisonMerge: (comparison, differences) => {
      const before = get();
      const result = mergeDifferences(
        before.project,
        comparison,
        differences,
        before.activeDiagramId,
      );
      if (result.applied === 0) return result;
      set((state) => {
        recordHistory(
          state,
          before,
          `Merge ${result.applied} change${result.applied === 1 ? "" : "s"}`,
        );
        state.project = result.project;
        const selection = state.selection;
        if (
          selection?.kind === "entity" &&
          !state.project.model.entities[selection.id]
        ) {
          state.selection = null;
        }
        if (
          selection?.kind === "relationship" &&
          !state.project.model.relationships[selection.id]
        ) {
          state.selection = null;
        }
        touchProject(state);
      });
      return result;
    },

    deleteSelection: () => {
      const selection = get().selection;
      if (!selection) return;
      if (selection.kind === "entity") {
        if (selection.attributeId) {
          get().deleteAttribute(selection.id, selection.attributeId);
          set((state) => {
            if (state.selection?.kind === "entity") {
              delete state.selection.attributeId;
            }
          });
        } else {
          get().deleteEntity(selection.id);
        }
      } else if (selection.kind === "relationship") {
        get().deleteRelationship(selection.id);
      } else if (selection.kind === "note") {
        get().deleteDiagramNote(get().activeDiagramId, selection.id);
      } else {
        get().deleteSubjectArea(get().activeDiagramId, selection.id);
      }
    },

    resetSampleProject: () => {
      const project = createSampleProject();
      savedProjectSignature = JSON.stringify(project);
      set((state) => {
        state.project = project;
        state.activeDiagramId = Object.keys(project.diagrams)[0];
        state.selection = null;
        state.isDirty = false;
        state.history = emptyHistory();
        state.clipboard = null;
      });
    },
  })),
);

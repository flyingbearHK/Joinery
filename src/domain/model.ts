export const PROJECT_FILE_TYPE = "joinery" as const;
export const PROJECT_FORMAT_VERSION = 1;

export type EntityId = string;
export type AttributeId = string;
export type IdentifierId = string;
export type RelationshipId = string;
export type DiagramId = string;
export type DiagramNoteId = string;
export type SubjectAreaId = string;

export type RelationshipKind = "association" | "inheritance";

export type Cardinality =
  "zero-or-one" | "exactly-one" | "zero-or-many" | "one-or-many";

export interface Attribute {
  id: AttributeId;
  name: string;
  logicalType: string;
  description: string;
  isRequired: boolean;
  isIdentifier: boolean;
}

export type IdentifierKind = "primary" | "alternate";

export interface EntityIdentifier {
  id: IdentifierId;
  name: string;
  kind: IdentifierKind;
  attributeIds: AttributeId[];
}

export interface Entity {
  id: EntityId;
  name: string;
  description: string;
  color: string;
  attributes: Attribute[];
  identifiers: EntityIdentifier[];
}

export interface Relationship {
  id: RelationshipId;
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
}

export interface EntityView {
  x: number;
  y: number;
  collapsed: boolean;
  pinned: boolean;
}

export interface RelationshipView {
  vertices: Point[];
}

export interface DiagramNote {
  id: DiagramNoteId;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface SubjectArea {
  id: SubjectAreaId;
  name: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Diagram {
  id: DiagramId;
  name: string;
  description: string;
  entityViews: Record<EntityId, EntityView>;
  relationshipViews: Record<RelationshipId, RelationshipView>;
  notes: Record<DiagramNoteId, DiagramNote>;
  subjectAreas: Record<SubjectAreaId, SubjectArea>;
}

export interface LogicalTypeDefinition {
  id: string;
  name: string;
  baseType: string;
  description: string;
  format: string;
}

export interface LogicalModel {
  entities: Record<EntityId, Entity>;
  relationships: Record<RelationshipId, Relationship>;
  logicalTypes: Record<string, LogicalTypeDefinition>;
}

export type NamingConvention = "none" | "pascal" | "camel" | "snake";

export interface ProjectSettings {
  namingConvention: NamingConvention;
  requireDescriptions: boolean;
}

export interface JoineryProject {
  fileType: typeof PROJECT_FILE_TYPE;
  formatVersion: typeof PROJECT_FORMAT_VERSION;
  id: string;
  name: string;
  description: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
  model: LogicalModel;
  diagrams: Record<DiagramId, Diagram>;
}

export type ProjectSelection =
  | { kind: "entity"; id: EntityId }
  | { kind: "relationship"; id: RelationshipId }
  | { kind: "note"; id: DiagramNoteId }
  | { kind: "subject-area"; id: SubjectAreaId }
  | null;

export interface Point {
  x: number;
  y: number;
}

export const CARDINALITY_OPTIONS: ReadonlyArray<{
  value: Cardinality;
  label: string;
  shortLabel: string;
}> = [
  { value: "zero-or-one", label: "Zero or one", shortLabel: "0..1" },
  { value: "exactly-one", label: "Exactly one", shortLabel: "1" },
  { value: "zero-or-many", label: "Zero or many", shortLabel: "0..*" },
  { value: "one-or-many", label: "One or many", shortLabel: "1..*" },
];

export const COMMON_LOGICAL_TYPES = [
  "Text",
  "Number",
  "Decimal",
  "Boolean",
  "Date",
  "Date & time",
  "Identifier",
  "Email",
  "URL",
  "JSON",
] as const;

export function cardinalityLabel(cardinality: Cardinality): string {
  return (
    CARDINALITY_OPTIONS.find((option) => option.value === cardinality)?.label ??
    cardinality
  );
}

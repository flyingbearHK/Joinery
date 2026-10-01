export const PROJECT_FILE_TYPE = "joinery" as const;
export const PROJECT_FORMAT_VERSION = 1;

export type EntityId = string;
export type AttributeId = string;
export type IdentifierId = string;
export type InversionEntryId = string;
export type RelationshipId = string;
export type DiagramId = string;
export type DiagramNoteId = string;
export type SubjectAreaId = string;

export type RelationshipKind = "association" | "inheritance";

export type Cardinality =
  "zero-or-one" | "exactly-one" | "zero-or-many" | "one-or-many" | `exactly-${number}`;

export function exactCardinalityCount(cardinality: Cardinality): number | null {
  const match = /^exactly-(\d+)$/.exec(cardinality);
  return match ? Number(match[1]) : null;
}

export function isExactCardinality(cardinality: Cardinality): boolean {
  return exactCardinalityCount(cardinality) !== null;
}

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

// A named, non-identifying access path over an entity's attributes — the
// erwin-style "inversion entry". Unlike an identifier it asserts no uniqueness;
// it records that the attribute set is a meaningful way to reach occurrences.
export interface InversionEntry {
  id: InversionEntryId;
  name: string;
  description: string;
  attributeIds: AttributeId[];
}

export interface Entity {
  id: EntityId;
  name: string;
  description: string;
  color: string;
  attributes: Attribute[];
  identifiers: EntityIdentifier[];
  inversionEntries: InversionEntry[];
}

// One entity's participation in an n-ary relationship. `cardinality` is the
// number of this entity's occurrences per relationship instance; `role` and
// `attributeId` mirror the binary endpoint semantics.
export interface RelationshipParticipant {
  id: string;
  entityId: EntityId;
  attributeId: AttributeId | null;
  role: string;
  cardinality: Cardinality;
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
  /**
   * Present only when the relationship is n-ary (three or more participants).
   * Binary relationships keep using the source- and target-prefixed fields.
   * For n-ary relationships those binary fields mirror participants[0] and
   * participants[1] as a compatibility projection for name-based lookups.
   */
  participants?: RelationshipParticipant[];
}

export function isNaryRelationship(relationship: Relationship): boolean {
  return (
    relationship.kind === "association" && (relationship.participants?.length ?? 0) >= 3
  );
}

/** Canonical participant list — synthesizes the two endpoints for binaries. */
export function relationshipParticipants(
  relationship: Relationship,
): RelationshipParticipant[] {
  if (isNaryRelationship(relationship) && relationship.participants) {
    return relationship.participants;
  }
  return [
    {
      id: `${relationship.id}-source`,
      entityId: relationship.sourceEntityId,
      attributeId: relationship.sourceAttributeId,
      role: relationship.sourceRole,
      cardinality: relationship.sourceCardinality,
    },
    {
      id: `${relationship.id}-target`,
      entityId: relationship.targetEntityId,
      attributeId: relationship.targetAttributeId,
      role: relationship.targetRole,
      cardinality: relationship.targetCardinality,
    },
  ];
}

export interface EntityView {
  x: number;
  y: number;
  collapsed: boolean;
  pinned: boolean;
}

export interface RelationshipView {
  vertices: Point[];
  /** Position of the n-ary relationship hub node, when the user moved it. */
  hub?: Point;
}

export interface DiagramNote {
  id: DiagramNoteId;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  /** When set, the note is a comment anchored to that entity: it follows the
   * entity when it moves, hides while the entity is hidden, and is removed if
   * the entity is deleted. */
  entityId?: EntityId;
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
  | { kind: "entity"; id: EntityId; attributeId?: AttributeId }
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
  const exact = exactCardinalityCount(cardinality);
  if (exact !== null) return `Exactly ${exact}`;
  return (
    CARDINALITY_OPTIONS.find((option) => option.value === cardinality)?.label ??
    cardinality
  );
}

import { z } from "zod";
import {
  PROJECT_FILE_TYPE,
  PROJECT_FORMAT_VERSION,
  type JoineryProject,
} from "./model";

const idSchema = z.string().trim().min(1).max(240);
const textSchema = z.string().max(100_000);
const dateTimeSchema = z.iso.datetime({ offset: true });
const cardinalitySchema = z.enum([
  "zero-or-one",
  "exactly-one",
  "zero-or-many",
  "one-or-many",
]);

const attributeSchema = z
  .object({
    id: idSchema,
    name: z.string().max(500),
    logicalType: z.string().max(500),
    description: textSchema,
    isRequired: z.boolean(),
    isIdentifier: z.boolean(),
  })
  .strict();

const identifierSchema = z
  .object({
    id: idSchema,
    name: z.string().max(500),
    kind: z.enum(["primary", "alternate"]),
    attributeIds: z.array(idSchema).min(1).max(1_000),
  })
  .strict();

const entitySchema = z
  .object({
    id: idSchema,
    name: z.string().max(500),
    description: textSchema,
    color: z.string().max(100).optional().default("#29243d"),
    attributes: z.array(attributeSchema).max(10_000),
    identifiers: z.array(identifierSchema).max(1_000).optional().default([]),
  })
  .strict();

const relationshipSchema = z
  .object({
    id: idSchema,
    name: z.string().max(500),
    description: textSchema,
    kind: z.enum(["association", "inheritance"]).optional().default("association"),
    sourceRole: z.string().max(500).optional().default(""),
    targetRole: z.string().max(500).optional().default(""),
    sourceEntityId: idSchema,
    targetEntityId: idSchema,
    sourceAttributeId: idSchema.nullable().optional().default(null),
    targetAttributeId: idSchema.nullable().optional().default(null),
    sourceCardinality: cardinalitySchema,
    targetCardinality: cardinalitySchema,
    isIdentifying: z.boolean(),
  })
  .strict();

const entityViewSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    collapsed: z.boolean(),
    pinned: z.boolean(),
  })
  .strict();

const pointSchema = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .strict();
const relationshipViewSchema = z
  .object({ vertices: z.array(pointSchema).max(10_000) })
  .strict();
const diagramNoteSchema = z
  .object({
    id: idSchema,
    text: textSchema,
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().max(10_000),
    height: z.number().positive().max(10_000),
    color: z.string().max(100),
  })
  .strict();
const subjectAreaSchema = z
  .object({
    id: idSchema,
    name: z.string().max(500),
    description: textSchema,
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().max(50_000),
    height: z.number().positive().max(50_000),
    color: z.string().max(100),
  })
  .strict();

const diagramSchema = z
  .object({
    id: idSchema,
    name: z.string().max(500),
    description: textSchema,
    entityViews: z.record(idSchema, entityViewSchema),
    relationshipViews: z
      .record(idSchema, relationshipViewSchema)
      .optional()
      .default({}),
    notes: z.record(idSchema, diagramNoteSchema).optional().default({}),
    subjectAreas: z.record(idSchema, subjectAreaSchema).optional().default({}),
  })
  .strict();

const logicalTypeDefinitionSchema = z
  .object({
    id: idSchema,
    name: z.string().max(500),
    baseType: z.string().max(500),
    description: textSchema,
    format: z.string().max(500),
  })
  .strict();

const projectV1Schema = z
  .object({
    fileType: z.literal(PROJECT_FILE_TYPE),
    formatVersion: z.literal(PROJECT_FORMAT_VERSION),
    id: idSchema,
    name: z.string().max(500),
    description: textSchema,
    settings: z
      .object({
        namingConvention: z.enum(["none", "pascal", "camel", "snake"]),
        requireDescriptions: z.boolean(),
      })
      .strict()
      .optional()
      .default({ namingConvention: "none", requireDescriptions: false }),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    model: z
      .object({
        entities: z.record(idSchema, entitySchema),
        relationships: z.record(idSchema, relationshipSchema),
        logicalTypes: z
          .record(idSchema, logicalTypeDefinitionSchema)
          .optional()
          .default({}),
      })
      .strict(),
    diagrams: z.record(idSchema, diagramSchema),
  })
  .strict();

const recoverySnapshotSchema = z
  .object({
    recoveryFormatVersion: z.literal(1),
    savedAt: dateTimeSchema,
    sourcePath: z.string().nullable(),
    project: projectV1Schema,
  })
  .strict();

export interface RecoverySnapshot {
  recoveryFormatVersion: 1;
  savedAt: string;
  sourcePath: string | null;
  project: JoineryProject;
}

export type ProjectDocumentErrorCode =
  "invalid-json" | "invalid-document" | "unsupported-version";

export class ProjectDocumentError extends Error {
  readonly code: ProjectDocumentErrorCode;

  constructor(code: ProjectDocumentErrorCode, message: string) {
    super(message);
    this.name = "ProjectDocumentError";
    this.code = code;
  }
}

type DocumentMigration = (document: Record<string, unknown>) => unknown;

// A migration registered under N converts format N to N + 1. This remains
// intentionally empty until the first on-disk format change.
const migrations: Partial<Record<number, DocumentMigration>> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrateDocument(input: unknown): unknown {
  if (!isRecord(input)) {
    throw new ProjectDocumentError(
      "invalid-document",
      "The selected file does not contain a Joinery project.",
    );
  }

  // Compatibility for development drafts created before the file type marker
  // was introduced. No released .joinery files used this representation.
  let document: Record<string, unknown> =
    input.fileType === undefined && input.formatVersion === 1
      ? { ...input, fileType: PROJECT_FILE_TYPE }
      : { ...input };

  const rawVersion = document.formatVersion;
  if (!Number.isInteger(rawVersion)) {
    throw new ProjectDocumentError(
      "invalid-document",
      "The project is missing a valid format version.",
    );
  }

  let version = rawVersion as number;
  if (version > PROJECT_FORMAT_VERSION) {
    throw new ProjectDocumentError(
      "unsupported-version",
      `This project uses Joinery format v${version}. This version of Joinery supports up to v${PROJECT_FORMAT_VERSION}.`,
    );
  }

  while (version < PROJECT_FORMAT_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      throw new ProjectDocumentError(
        "unsupported-version",
        `Joinery cannot migrate project format v${version}.`,
      );
    }
    const migrated = migration(document);
    if (!isRecord(migrated)) {
      throw new ProjectDocumentError(
        "invalid-document",
        `The migration from project format v${version} failed.`,
      );
    }
    document = migrated;
    version += 1;
  }

  return document;
}

function formatValidationIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "project";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function normalizeIdentifiers(project: JoineryProject): void {
  Object.values(project.model.entities).forEach((entity) => {
    if (entity.identifiers.length === 0) {
      const legacyAttributeIds = entity.attributes
        .filter((attribute) => attribute.isIdentifier)
        .map((attribute) => attribute.id);
      if (legacyAttributeIds.length > 0) {
        entity.identifiers.push({
          id: `identifier_${entity.id}_primary`,
          name: "Primary identifier",
          kind: "primary",
          attributeIds: legacyAttributeIds,
        });
      }
    }

    const identifierAttributeIds = new Set(
      entity.identifiers.flatMap((identifier) => identifier.attributeIds),
    );
    entity.attributes.forEach((attribute) => {
      attribute.isIdentifier = identifierAttributeIds.has(attribute.id);
    });
  });
}

function assertSemanticIntegrity(project: JoineryProject): void {
  const entityIds = new Set(Object.keys(project.model.entities));
  const diagramIds = Object.keys(project.diagrams);

  if (diagramIds.length === 0) {
    throw new ProjectDocumentError(
      "invalid-document",
      "A Joinery project must contain at least one diagram.",
    );
  }

  for (const [entityId, entity] of Object.entries(project.model.entities)) {
    if (entity.id !== entityId) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Entity record “${entityId}” has the mismatched ID “${entity.id}”.`,
      );
    }

    const attributeIds = new Set<string>();
    for (const attribute of entity.attributes) {
      if (attributeIds.has(attribute.id)) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Entity “${entity.name || entity.id}” contains duplicate attribute ID “${attribute.id}”.`,
        );
      }
      attributeIds.add(attribute.id);
    }

    const identifierIds = new Set<string>();
    let primaryCount = 0;
    for (const identifier of entity.identifiers) {
      if (identifierIds.has(identifier.id)) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Entity “${entity.name || entity.id}” contains duplicate identifier ID “${identifier.id}”.`,
        );
      }
      identifierIds.add(identifier.id);
      if (identifier.kind === "primary") primaryCount += 1;
      if (
        identifier.attributeIds.some((attributeId) => !attributeIds.has(attributeId))
      ) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Identifier “${identifier.name || identifier.id}” references a missing attribute.`,
        );
      }
      if (new Set(identifier.attributeIds).size !== identifier.attributeIds.length) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Identifier “${identifier.name || identifier.id}” contains a duplicate attribute.`,
        );
      }
    }
    if (primaryCount > 1) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Entity “${entity.name || entity.id}” has more than one primary identifier.`,
      );
    }
  }

  for (const [logicalTypeId, logicalType] of Object.entries(
    project.model.logicalTypes,
  )) {
    if (logicalType.id !== logicalTypeId) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Logical type record “${logicalTypeId}” has the mismatched ID “${logicalType.id}”.`,
      );
    }
  }

  for (const [relationshipId, relationship] of Object.entries(
    project.model.relationships,
  )) {
    if (relationship.id !== relationshipId) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Relationship record “${relationshipId}” has the mismatched ID “${relationship.id}”.`,
      );
    }
    if (
      !entityIds.has(relationship.sourceEntityId) ||
      !entityIds.has(relationship.targetEntityId)
    ) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Relationship “${relationship.name || relationship.id}” references a missing entity.`,
      );
    }
    const sourceEntity = project.model.entities[relationship.sourceEntityId];
    const targetEntity = project.model.entities[relationship.targetEntityId];
    if (
      relationship.sourceAttributeId &&
      !sourceEntity.attributes.some(
        (attribute) => attribute.id === relationship.sourceAttributeId,
      )
    ) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Relationship “${relationship.name || relationship.id}” references a missing source attribute.`,
      );
    }
    if (
      relationship.targetAttributeId &&
      !targetEntity.attributes.some(
        (attribute) => attribute.id === relationship.targetAttributeId,
      )
    ) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Relationship “${relationship.name || relationship.id}” references a missing target attribute.`,
      );
    }
  }

  for (const [diagramId, diagram] of Object.entries(project.diagrams)) {
    if (diagram.id !== diagramId) {
      throw new ProjectDocumentError(
        "invalid-document",
        `Diagram record “${diagramId}” has the mismatched ID “${diagram.id}”.`,
      );
    }
    for (const relationshipId of Object.keys(diagram.relationshipViews)) {
      if (!project.model.relationships[relationshipId]) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Diagram “${diagram.name || diagram.id}” contains routing for missing relationship “${relationshipId}”.`,
        );
      }
    }
    for (const [noteId, note] of Object.entries(diagram.notes)) {
      if (note.id !== noteId) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Diagram note record “${noteId}” has a mismatched ID.`,
        );
      }
    }
    for (const [subjectAreaId, subjectArea] of Object.entries(diagram.subjectAreas)) {
      if (subjectArea.id !== subjectAreaId) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Subject area record “${subjectAreaId}” has a mismatched ID.`,
        );
      }
    }
    for (const entityId of Object.keys(diagram.entityViews)) {
      if (!entityIds.has(entityId)) {
        throw new ProjectDocumentError(
          "invalid-document",
          `Diagram “${diagram.name || diagram.id}” references missing entity “${entityId}”.`,
        );
      }
    }
  }
}

export function validateProject(input: unknown): JoineryProject {
  const migrated = migrateDocument(input);
  const result = projectV1Schema.safeParse(migrated);
  if (!result.success) {
    throw new ProjectDocumentError(
      "invalid-document",
      `The project is not valid. ${formatValidationIssues(result.error)}`,
    );
  }

  const project = result.data as JoineryProject;
  normalizeIdentifiers(project);
  assertSemanticIntegrity(project);
  return project;
}

export function deserializeProject(contents: string): JoineryProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new ProjectDocumentError(
      "invalid-json",
      "The selected file is not valid JSON and cannot be opened.",
    );
  }
  return validateProject(parsed);
}

export function serializeProject(project: JoineryProject): string {
  const validated = validateProject(project);
  return `${JSON.stringify(validated, null, 2)}\n`;
}

export function createRecoverySnapshot(
  project: JoineryProject,
  sourcePath: string | null,
): RecoverySnapshot {
  return {
    recoveryFormatVersion: 1,
    savedAt: new Date().toISOString(),
    sourcePath,
    project: validateProject(project),
  };
}

export function serializeRecoverySnapshot(snapshot: RecoverySnapshot): string {
  const result = recoverySnapshotSchema.safeParse(snapshot);
  if (!result.success) {
    throw new ProjectDocumentError(
      "invalid-document",
      `The recovery snapshot is not valid. ${formatValidationIssues(result.error)}`,
    );
  }
  return JSON.stringify(result.data);
}

export function deserializeRecoverySnapshot(contents: string): RecoverySnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new ProjectDocumentError(
      "invalid-json",
      "The recovery snapshot is not valid JSON.",
    );
  }

  const result = recoverySnapshotSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProjectDocumentError(
      "invalid-document",
      `The recovery snapshot is not valid. ${formatValidationIssues(result.error)}`,
    );
  }

  const snapshot = result.data as RecoverySnapshot;
  normalizeIdentifiers(snapshot.project);
  assertSemanticIntegrity(snapshot.project);
  return snapshot;
}

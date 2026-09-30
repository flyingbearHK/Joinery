import { describe, expect, it } from "vitest";
import {
  ProjectDocumentError,
  createRecoverySnapshot,
  deserializeProject,
  deserializeRecoverySnapshot,
  serializeProject,
  serializeRecoverySnapshot,
  validateProject,
} from "./document";
import { createSampleProject } from "./project";

describe(".joinery document format", () => {
  it("round-trips a valid version-one project", () => {
    const project = createSampleProject();
    const serialized = serializeProject(project);
    const restored = deserializeProject(serialized);

    expect(restored).toEqual(project);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it("accepts development drafts created before the file type marker", () => {
    const project = createSampleProject();
    const legacy = structuredClone(project) as Partial<typeof project>;
    delete legacy.fileType;
    delete legacy.settings;
    if (legacy.model) {
      delete (legacy.model as unknown as Record<string, unknown>).logicalTypes;
      Object.values(legacy.model.entities).forEach((entity) => {
        delete (entity as unknown as Record<string, unknown>).identifiers;
        delete (entity as unknown as Record<string, unknown>).color;
      });
    }
    Object.values(legacy.diagrams ?? {}).forEach((diagram) => {
      delete (diagram as unknown as Record<string, unknown>).relationshipViews;
      delete (diagram as unknown as Record<string, unknown>).notes;
      delete (diagram as unknown as Record<string, unknown>).subjectAreas;
    });
    const legacyRelationship = Object.values(
      legacy.model?.relationships ?? {},
    )[0] as unknown as Record<string, unknown>;
    delete legacyRelationship.sourceAttributeId;
    delete legacyRelationship.targetAttributeId;
    delete legacyRelationship.kind;
    delete legacyRelationship.sourceRole;
    delete legacyRelationship.targetRole;

    const restored = validateProject(legacy);
    expect(restored.fileType).toBe("joinery");
    expect(restored.settings.namingConvention).toBe("none");
    expect(Object.values(restored.model.relationships)[0].sourceAttributeId).toBeNull();
    expect(Object.values(restored.model.relationships)[0].kind).toBe("association");
    expect(
      Object.values(restored.model.entities)[0].identifiers.length,
    ).toBeGreaterThan(0);
    expect(Object.values(restored.diagrams)[0].notes).toEqual({});
  });

  it("rejects relationships that reference a missing entity", () => {
    const project = structuredClone(createSampleProject());
    const relationship = Object.values(project.model.relationships)[0];
    relationship.targetEntityId = "entity_missing";

    expect(() => validateProject(project)).toThrow(/references a missing entity/i);
  });

  it("rejects relationships that reference a missing attribute", () => {
    const project = structuredClone(createSampleProject());
    const relationship = Object.values(project.model.relationships)[0];
    relationship.sourceAttributeId = "attribute_missing";

    expect(() => validateProject(project)).toThrow(/missing source attribute/i);
  });

  it("reports documents from newer Joinery versions", () => {
    const project = { ...createSampleProject(), formatVersion: 99 };

    expect(() => validateProject(project)).toThrow(ProjectDocumentError);
    expect(() => validateProject(project)).toThrow(/supports up to v1/i);
  });

  it("reports invalid JSON", () => {
    expect(() => deserializeProject("{not-json")).toThrow(/not valid JSON/i);
  });

  it("round-trips a recovery snapshot with its source path", () => {
    const project = createSampleProject();
    const snapshot = createRecoverySnapshot(project, "/tmp/model.joinery");
    const restored = deserializeRecoverySnapshot(serializeRecoverySnapshot(snapshot));

    expect(restored.project).toEqual(project);
    expect(restored.sourcePath).toBe("/tmp/model.joinery");
    expect(Date.parse(restored.savedAt)).not.toBeNaN();
  });
});

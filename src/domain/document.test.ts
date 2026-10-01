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

  it("round-trips exact-N cardinality and rejects malformed values", () => {
    const project = structuredClone(createSampleProject());
    const relationship = Object.values(project.model.relationships)[0];
    relationship.sourceCardinality = "exactly-3";

    const restored = deserializeProject(serializeProject(project));
    expect(Object.values(restored.model.relationships)[0].sourceCardinality).toBe(
      "exactly-3",
    );

    relationship.sourceCardinality = "exactly-0" as never;
    expect(() => validateProject(project)).toThrow();
    relationship.sourceCardinality = "exactly-1.5" as never;
    expect(() => validateProject(project)).toThrow();
  });

  it("round-trips n-ary relationships and validates participant references", () => {
    const project = structuredClone(createSampleProject());
    const entities = Object.values(project.model.entities);
    const [customer, order, product] = [
      entities.find((entity) => entity.name === "Customer")!,
      entities.find((entity) => entity.name === "Order")!,
      entities.find((entity) => entity.name === "Product")!,
    ];
    project.model.relationships.relationship_nary = {
      id: "relationship_nary",
      name: "fulfills",
      description: "A ternary supply fact.",
      kind: "association",
      sourceRole: "",
      targetRole: "",
      sourceEntityId: customer.id,
      targetEntityId: order.id,
      sourceAttributeId: null,
      targetAttributeId: null,
      sourceCardinality: "exactly-one",
      targetCardinality: "zero-or-many",
      isIdentifying: false,
      participants: [
        {
          id: "p1",
          entityId: customer.id,
          attributeId: null,
          role: "buyer",
          cardinality: "exactly-one",
        },
        {
          id: "p2",
          entityId: order.id,
          attributeId: null,
          role: "",
          cardinality: "exactly-4",
        },
        {
          id: "p3",
          entityId: product.id,
          attributeId: null,
          role: "",
          cardinality: "one-or-many",
        },
      ],
    };

    const restored = deserializeProject(serializeProject(project));
    const nary = restored.model.relationships.relationship_nary;
    expect(nary.participants).toHaveLength(3);
    expect(nary.participants?.[1].cardinality).toBe("exactly-4");
    expect(nary.participants?.[0].role).toBe("buyer");

    // Two participants is a binary relationship — the field must not be used.
    project.model.relationships.relationship_nary.participants =
      project.model.relationships.relationship_nary.participants!.slice(0, 2);
    expect(() => validateProject(project)).toThrow();

    // Missing entity references must be rejected.
    project.model.relationships.relationship_nary.participants = [
      {
        id: "p1",
        entityId: customer.id,
        attributeId: null,
        role: "",
        cardinality: "exactly-one",
      },
      {
        id: "p2",
        entityId: order.id,
        attributeId: null,
        role: "",
        cardinality: "zero-or-many",
      },
      {
        id: "p3",
        entityId: "entity_missing",
        attributeId: null,
        role: "",
        cardinality: "zero-or-many",
      },
    ];
    expect(() => validateProject(project)).toThrow(/missing entity/i);

    // Participants are not allowed on inheritance relationships.
    project.model.relationships.relationship_nary.participants![2].entityId =
      product.id;
    project.model.relationships.relationship_nary.kind = "inheritance";
    expect(() => validateProject(project)).toThrow(/participant/i);
  });

  it("round-trips attached comments and rejects notes pointing at missing entities", () => {
    const project = createSampleProject();
    const diagram = Object.values(project.diagrams)[0];
    const entity = Object.values(project.model.entities)[0];
    diagram.notes["note-1"] = {
      id: "note-1",
      text: "Rename after review",
      x: 40,
      y: 40,
      width: 200,
      height: 90,
      color: "#fff4c2",
      entityId: entity.id,
    };

    const restored = deserializeProject(serializeProject(project));
    expect(Object.values(Object.values(restored.diagrams)[0].notes)[0].entityId).toBe(
      entity.id,
    );

    project.diagrams[diagram.id].notes["note-1"].entityId = "entity_missing";
    expect(() => validateProject(project)).toThrow();
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

import { describe, expect, it } from "vitest";
import { foreignKeyIds, sortAttributes } from "./attributeOrder";
import { createEntity } from "./project";
import type { Attribute, Entity, Relationship } from "./model";

function entityWith(names: string[], keyNames: string[] = []): Entity {
  const entity = createEntity("Test");
  entity.attributes = names.map((name): Attribute => ({
    id: `attr_${name}`,
    name,
    logicalType: "Text",
    description: "",
    isRequired: false,
    isIdentifier: false,
  }));
  if (keyNames.length) {
    entity.identifiers = [
      {
        id: "id_primary",
        name: "Primary",
        kind: "primary",
        attributeIds: keyNames.map((name) => `attr_${name}`),
      },
    ];
  }
  return entity;
}

describe("sortAttributes", () => {
  it("floats identifier attributes to the top preserving order", () => {
    const entity = entityWith(
      ["name", "id", "email", "tenant id"],
      ["id", "tenant id"],
    );
    expect(
      sortAttributes(entity, "keys-first").map((attribute) => attribute.name),
    ).toEqual(["id", "tenant id", "name", "email"]);
  });

  it("sorts by name case-insensitively", () => {
    const entity = entityWith(["Zulu", "alpha", "Beta"]);
    expect(sortAttributes(entity, "name").map((attribute) => attribute.name)).toEqual([
      "alpha",
      "Beta",
      "Zulu",
    ]);
  });

  it("floats foreign-key attributes just below identifier keys", () => {
    const entity = entityWith(["name", "id", "customer id", "email"], ["id"]);
    const parent = createEntity("Parent");
    const relationship = {
      id: "rel_1",
      name: "",
      description: "",
      kind: "association",
      sourceRole: "",
      targetRole: "",
      sourceEntityId: parent.id,
      targetEntityId: entity.id,
      sourceAttributeId: null,
      targetAttributeId: "attr_customer id",
      sourceCardinality: "exactly-one" as const,
      targetCardinality: "zero-or-many" as const,
      isIdentifying: false,
    } satisfies Relationship;

    expect(foreignKeyIds(entity, [relationship])).toEqual(
      new Set(["attr_customer id"]),
    );
    expect(
      sortAttributes(entity, "keys-first", [relationship]).map(
        (attribute) => attribute.name,
      ),
    ).toEqual(["id", "customer id", "name", "email"]);
  });

  it("orders keys first then alphabetically within each group", () => {
    const entity = entityWith(["zeta", "key b", "alpha", "key a"], ["key a", "key b"]);
    expect(
      sortAttributes(entity, "keys-then-name").map((attribute) => attribute.name),
    ).toEqual(["key a", "key b", "alpha", "zeta"]);
  });
});

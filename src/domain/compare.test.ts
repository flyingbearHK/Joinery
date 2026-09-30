import { describe, expect, it } from "vitest";
import { compareProjects } from "./compare";
import { createSampleProject } from "./project";

describe("logical model comparison", () => {
  it("reports no differences for an equivalent project", () => {
    const project = createSampleProject();
    expect(compareProjects(project, structuredClone(project))).toEqual([]);
  });

  it("finds added, removed, and changed model objects by logical name", () => {
    const current = createSampleProject();
    const comparison = structuredClone(current);
    const customer = Object.values(comparison.model.entities).find(
      (entity) => entity.name === "Customer",
    )!;
    customer.attributes[0].logicalType = "Text";
    const product = Object.values(comparison.model.entities).find(
      (entity) => entity.name === "Product",
    )!;
    delete comparison.model.entities[product.id];
    Object.values(comparison.model.relationships).forEach((relationship) => {
      if (
        relationship.sourceEntityId === product.id ||
        relationship.targetEntityId === product.id
      ) {
        delete comparison.model.relationships[relationship.id];
      }
    });

    const differences = compareProjects(current, comparison);
    expect(differences.some((item) => item.kind === "changed")).toBe(true);
    expect(differences.some((item) => item.kind === "removed")).toBe(true);
  });
});

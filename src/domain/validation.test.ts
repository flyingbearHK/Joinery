import { describe, expect, it } from "vitest";
import { createBlankProject, createSampleProject } from "./project";
import { validateLogicalModel } from "./validation";

describe("logical model validation", () => {
  it("returns useful issues for incomplete entities", () => {
    const project = createBlankProject();
    const diagram = Object.values(project.diagrams)[0];
    project.model.entities.entity_one = {
      id: "entity_one",
      name: "",
      description: "",
      color: "#29243d",
      attributes: [],
      identifiers: [],
      inversionEntries: [],
    };
    diagram.entityViews.entity_one = {
      x: 0,
      y: 0,
      collapsed: false,
      pinned: false,
    };

    const issues = validateLogicalModel(project);
    expect(issues.some((issue) => issue.severity === "error")).toBe(true);
    expect(issues.some((issue) => /no attributes/i.test(issue.title))).toBe(true);
    expect(issues.some((issue) => /no primary identifier/i.test(issue.title))).toBe(
      true,
    );
  });

  it("applies project naming and documentation standards", () => {
    const project = createSampleProject();
    project.settings.namingConvention = "pascal";
    project.settings.requireDescriptions = true;
    const customer = project.model.entities.entity_customer;
    customer.attributes[0].name = "customer_id";
    customer.attributes[0].description = "";

    const issues = validateLogicalModel(project);
    expect(issues.some((issue) => /naming standard/i.test(issue.title))).toBe(true);
    expect(issues.some((issue) => /no definition/i.test(issue.title))).toBe(true);
  });

  it("does not report identifier warnings for sample entities", () => {
    const issues = validateLogicalModel(createSampleProject());
    expect(issues.some((issue) => /no primary identifier/i.test(issue.title))).toBe(
      false,
    );
  });
});

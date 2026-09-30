import { describe, expect, it } from "vitest";
import { createSampleProject } from "./project";
import { createModelCsv, createModelHtmlReport } from "./report";

describe("model reports", () => {
  it("creates a printable HTML report", () => {
    const report = createModelHtmlReport(createSampleProject());
    expect(report).toContain("<!doctype html>");
    expect(report).toContain("Commerce model");
    expect(report).toContain("Customer");
    expect(report).toContain("Relationships");
  });

  it("creates a quoted CSV data dictionary", () => {
    const report = createModelCsv(createSampleProject());
    expect(report).toContain('"Entity","Entity description","Attribute"');
    expect(report).toContain('"Customer"');
    expect(report).toContain('"customer id"');
  });
});

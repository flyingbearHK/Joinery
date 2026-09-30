import { describe, expect, it } from "vitest";
import { calculateAutoLayout } from "../diagram/autoLayout";
import { validateProject } from "./document";
import { createPerformanceFixture } from "./performanceFixture";

describe("performance fixture", () => {
  it("contains a deterministic 100-entity/200-relationship valid model", () => {
    const project = validateProject(createPerformanceFixture());
    expect(Object.keys(project.model.entities)).toHaveLength(100);
    expect(Object.keys(project.model.relationships)).toHaveLength(200);
  });

  it("lays out the full fixture", async () => {
    const project = createPerformanceFixture();
    const diagram = project.diagrams.performance_diagram;
    const startedAt = performance.now();
    const positions = await calculateAutoLayout(project, diagram);
    const elapsed = performance.now() - startedAt;

    expect(Object.keys(positions)).toHaveLength(100);
    // A generous CI guard: catches pathological regressions without treating
    // local hardware variation as a failure.
    expect(elapsed).toBeLessThan(20_000);
  }, 30_000);
});

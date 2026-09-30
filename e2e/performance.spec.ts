import { expect, test } from "@playwright/test";
import {
  createRecoverySnapshot,
  serializeRecoverySnapshot,
} from "../src/domain/document";
import { createPerformanceFixture } from "../src/domain/performanceFixture";

test("renders and arranges the 100-entity fixture", async ({ page }) => {
  test.setTimeout(60_000);
  const snapshot = serializeRecoverySnapshot(
    createRecoverySnapshot(createPerformanceFixture(), null),
  );
  await page.addInitScript((recovery) => {
    localStorage.setItem("joinery-recovery-v1", recovery);
    window.confirm = () => true;
  }, snapshot);
  await page.goto("/");
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(
    100,
    { timeout: 20_000 },
  );

  const startedAt = Date.now();
  await page.getByRole("button", { name: "Auto arrange" }).click();
  await expect(page.getByRole("button", { name: /Arranging/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Auto arrange" })).toBeEnabled({
    timeout: 20_000,
  });
  expect(Date.now() - startedAt).toBeLessThan(20_000);

  const viewport = page.locator(
    ".diagram-canvas > .x6-graph-svg > .x6-graph-svg-viewport",
  );
  const before = await viewport.getAttribute("transform");
  const canvas = page.locator(".diagram-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no bounds");
  await page.mouse.move(box.x + 150, box.y + 150);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + 230, box.y + 210, { steps: 5 });
  await page.mouse.up({ button: "middle" });
  await expect(viewport).not.toHaveAttribute("transform", before ?? "");
}, 60_000);

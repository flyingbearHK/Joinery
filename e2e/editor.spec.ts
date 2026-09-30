import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createSampleProject } from "../src/domain/project";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    window.confirm = () => false;
    window.prompt = (_message, defaultValue) => defaultValue ?? null;
  });
  await page.goto("/");
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(4);
});

test("shows FlyingBear branding, version, and entity color controls", async ({
  page,
}) => {
  await expect(page.getByText("BY FLYINGBEAR", { exact: true })).toBeVisible();
  await expect(page.getByText("v0.1.0", { exact: true })).toBeVisible();

  await page.locator(".entity-item").filter({ hasText: "Customer" }).click();
  const blue = page.getByRole("button", { name: "Use Blue entity color" });
  await blue.click();
  await expect(blue).toHaveAttribute("aria-pressed", "true");
  await expect(
    page
      .locator(
        '.diagram-canvas > .x6-graph-svg .x6-node[data-cell-id="entity_customer"] > rect',
      )
      .nth(2),
  ).toHaveAttribute("fill", "#356e9f");
});

test("creates, edits, duplicates, and undoes an entity", async ({ page }) => {
  await page.getByRole("button", { name: "Entity", exact: true }).click();
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(5);
  await page.getByLabel("Name").fill("Invoice");
  await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate entity" }).click();
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(6);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(5);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(6);
});

test("creates and selects a relationship through explicit controls", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Relationship", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create relationship" })).toBeVisible();
  await page.getByLabel("Optional label").fill("references");
  await page.getByRole("button", { name: "Create relationship" }).click();
  await expect(page.getByRole("heading", { name: "references" })).toBeVisible();
  await expect(page.locator(".relationship-item.selected")).toContainText("references");
  await expect(page.locator(".x6-edge-tool-vertices")).toBeVisible();
});

test("renders all Crow's Foot endpoint variants", async ({ page }) => {
  await page.locator(".relationship-item").filter({ hasText: "places" }).click();
  await page.getByLabel("Source cardinality").selectOption("zero-or-one");
  expect(
    await page.locator(".diagram-canvas > .x6-graph-svg defs marker").count(),
  ).toBeGreaterThanOrEqual(4);
  await expect(
    page.locator(
      '.diagram-canvas > .x6-graph-svg .x6-edge[data-cell-id="relationship_customer_orders"] .joinery-edge-line',
    ),
  ).toHaveAttribute("marker-start", /url/);
});

test("manages diagram visibility and validates the model", async ({ page }) => {
  await page.getByRole("button", { name: "Manage active diagram" }).click();
  await expect(page.getByRole("dialog", { name: /Manage Overview/ })).toBeVisible();
  await page.getByRole("button", { name: "Hide all" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(0);

  await page.getByRole("button", { name: "Validate model" }).click();
  await expect(page.getByRole("dialog", { name: "Validation results" })).toBeVisible();
});

test("adds diagram documentation and exposes it to the inspector", async ({ page }) => {
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("heading", { name: "Note" })).toBeVisible();
  await page.getByLabel("Text").fill("Customer ordering context");

  await page.getByRole("button", { name: "Add subject area" }).click();
  await expect(page.getByRole("heading", { name: "Subject area" })).toBeVisible();
  await page.getByLabel("Name").fill("Sales domain");
  await expect(
    page.locator('.x6-cell[aria-label="Subject area Sales domain"]'),
  ).toBeVisible();
});

test("manages identifiers and reusable logical types", async ({ page }) => {
  await page.locator(".entity-item").filter({ hasText: "Customer" }).click();
  const identifierSection = page.locator(".identifier-section");
  await identifierSection.getByRole("button", { name: "Add" }).click();
  await expect(identifierSection.locator(".identifier-editor")).toHaveCount(2);

  await page.getByRole("button", { name: "Logical type library" }).click();
  await expect(
    page.getByRole("dialog", { name: "Logical type library" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add type" }).click();
  await expect(page.locator(".type-editor")).toHaveCount(2);
});

test("compares the current model with another Joinery document", async ({ page }) => {
  const comparison = createSampleProject();
  comparison.model.entities.entity_customer.name = "Client";
  await page.getByRole("button", { name: "Compare model" }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose .joinery file" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "comparison.joinery",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(comparison)),
  });
  await expect(page.locator(".comparison-item")).not.toHaveCount(0);
});

test("exports clean SVG without editor tools", async ({ page }) => {
  await page.locator(".relationship-item").first().click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.locator(".format-option").filter({ hasText: "SVG" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Export download has no path");
  const svg = await readFile(path, "utf8");
  expect(svg).toContain("joinery-edge-line");
  expect(svg).not.toContain("x6-cell-tool");
  expect(svg).not.toContain("joinery-edge-hit-area");
});

test("exports a model data dictionary report", async ({ page }) => {
  await page.getByRole("button", { name: "Export model report" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /CSV data dictionary/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("report.csv");
});

test("switches theme, shows minimap, and opens export preview", async ({ page }) => {
  await page.getByRole("button", { name: "Toggle minimap" }).click();
  await expect(page.locator(".canvas-minimap")).toHaveClass(/open/);
  await expect(page.locator(".canvas-minimap .x6-node")).toHaveCount(4);
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Export Overview/ })).toBeVisible();
  await expect(page.locator(".export-preview img")).toBeVisible();
});

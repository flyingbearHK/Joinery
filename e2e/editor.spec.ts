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

test("creates an n-ary relationship with a hub and participant legs", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Relationship", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create relationship" });
  await expect(dialog).toBeVisible();

  await page.getByLabel("Optional label").fill("fulfills");
  await dialog.getByRole("button", { name: "Add participant" }).click();
  await expect(dialog.getByRole("group", { name: "Participant 3" })).toBeVisible();
  await page.getByRole("button", { name: "Create relationship" }).click();

  // One hub node plus one leg edge per participant.
  await expect(page.locator('.x6-node[data-cell-id$="__hub"]')).toHaveCount(1);
  await expect(page.locator('.x6-edge[data-cell-id*="__leg__"]')).toHaveCount(3);
  await expect(page.locator(".relationship-item.selected")).toContainText("fulfills");
  await expect(page.getByText("Participants & cardinality")).toBeVisible();
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

test("bulk-pastes spreadsheet rows into an entity", async ({ page }) => {
  await page.locator(".entity-item").filter({ hasText: "Customer" }).click();
  await page.getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste attributes" });
  await expect(dialog).toBeVisible();

  await page
    .getByLabel(/one attribute per line/i)
    .fill(
      "Attribute\tType\tDescription\nregion\tText\tSales region\njoined at\tDate & time\tWhen they joined",
    );
  await page.getByRole("button", { name: "Add 2 attributes" }).click();

  await expect(page.getByLabel("Attribute 4 name")).toHaveValue("region");
  await expect(page.getByLabel("Attribute 5 name")).toHaveValue("joined at");
  await expect(page.getByLabel("Attribute 4 logical type")).toHaveValue("Text");
});

test("edits staged attributes and links references before committing", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Order", exact: true }).click();
  await page.getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste attributes" });
  await expect(dialog).toBeVisible();

  await page.getByLabel(/one attribute per line/i).fill("customer ref\npaid at");
  await page.getByLabel("Name for row 1").fill("customer id");
  await page.getByLabel("Type for customer id").selectOption("Identifier");
  await page.getByLabel("References for customer id").selectOption({
    label: "Customer",
  });
  await page.getByLabel("Type for paid at").selectOption("Date & time");
  await page.getByRole("button", { name: "Add 2 attributes" }).click();

  await expect(page.getByLabel("Attribute 4 name")).toHaveValue("customer id");
  await expect(page.getByLabel("Attribute 4 logical type")).toHaveValue("Identifier");
  // The references pick created a Customer → Order relationship.
  await expect(
    page.locator(".relationship-item").filter({ hasText: "Customer → Order" }),
  ).toHaveCount(1);
});

test("arranges attributes alphabetically and shift-clicks one to the top", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Order", exact: true }).click();

  const nameFields = page.locator("[data-attribute-name]");
  const names = await nameFields.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
  const sorted = [...names].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  await page.getByLabel("Arrange attributes").selectOption("name");
  await expect(nameFields.first()).toHaveValue(sorted[0]);
  const ordered = await nameFields.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
  expect(ordered).toEqual(sorted);

  const lastName = sorted[sorted.length - 1];
  await page.getByLabel(`Move ${lastName} up`).click({ modifiers: ["Shift"] });
  await expect(nameFields.first()).toHaveValue(lastName);
});

test("selects, context-menus, and drags attribute rows on the canvas", async ({
  page,
}) => {
  // Attribute rows render as rect backgrounds — shadow/body/header come first,
  // so the first attribute row is the 4th rect in the entity node.
  const firstRow = page.locator('.x6-node[data-cell-id="entity_order"] rect').nth(3);
  await expect(firstRow).toBeVisible();
  const rowBox = await firstRow.boundingBox();
  if (!rowBox) throw new Error("Attribute row not found");
  const rowCenter = {
    x: rowBox.x + rowBox.width / 2,
    y: rowBox.y + rowBox.height / 2,
  };
  await page.mouse.click(rowCenter.x, rowCenter.y);
  const focusedName = page.locator(
    ".attribute-editor.focused input[data-attribute-name]",
  );
  await expect(focusedName).toBeFocused();

  // Right-click the same row → context menu with row actions.
  await page.mouse.click(rowCenter.x, rowCenter.y, { button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Move to top" })).toBeVisible();

  // Delete via the menu.
  const nameBefore = await focusedName.inputValue();
  await menu.getByRole("menuitem", { name: "Delete attribute" }).click();
  const remaining = await page
    .locator("input[data-attribute-name]")
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  expect(remaining).not.toContain(nameBefore);

  // Drag row 0 down onto row 1 — the canvas drag reorders the model.
  const rowZero = page.locator(
    '.x6-node[data-cell-id="entity_order"] rect[data-attribute-index="0"]',
  );
  const rowOne = page.locator(
    '.x6-node[data-cell-id="entity_order"] rect[data-attribute-index="1"]',
  );
  const fromBox = await rowZero.boundingBox();
  const toBox = await rowOne.boundingBox();
  if (!fromBox || !toBox) throw new Error("Attribute rows not found");
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + 5, { steps: 6 });
  await page.mouse.up();
  const reordered = await page
    .locator("input[data-attribute-name]")
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  expect(reordered[1]).toBe(remaining[0]);
  expect(reordered[0]).toBe(remaining[1]);
});

test("attaches a comment to an entity that follows it", async ({ page }) => {
  await page.locator(".entity-item").filter({ hasText: "Customer" }).click();
  await page.getByRole("button", { name: "Add comment" }).click();

  const note = page.locator('.x6-node[data-cell-id^="note_"]');
  await expect(note).toHaveCount(1);
  await expect(page.locator('.x6-edge[data-cell-id$="__link"]')).toHaveCount(1);

  // The comment is selected — type review feedback into it.
  await page.getByLabel("Text").fill("Split into billing + shipping?");

  // Reselect the entity — the comment is listed under its Comments section.
  await page.getByRole("button", { name: "Customer", exact: true }).click();
  await expect(
    page.locator(".comment-item").filter({ hasText: "Split into billing" }),
  ).toBeVisible();
});

test("opens bulk import when spreadsheet text is pasted", async ({ page }) => {
  await page.locator(".entity-item").filter({ hasText: "Customer" }).click();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "loyalty tier\tText\nmarketing opt in\tBoolean");
    window.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
    );
  });

  const dialog = page.getByRole("dialog", { name: "Paste attributes" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Add 2 attributes" }).click();
  await expect(page.getByLabel("Attribute 4 name")).toHaveValue("loyalty tier");
  await expect(page.getByLabel("Attribute 5 name")).toHaveValue("marketing opt in");
});

test("previews Mermaid and drawio exports in the export dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Export/ });
  await expect(dialog).toBeVisible();

  await dialog.locator(".format-option", { hasText: "Mermaid" }).click();
  const preview = page.getByLabel("Mermaid preview");
  await expect(preview).toContainText("erDiagram");
  await expect(preview).toContainText("Customer {");
  await expect(preview).toContainText("Customer ||..o{ Order : places");

  await dialog.locator(".format-option", { hasText: "drawio" }).click();
  const drawioPreview = page.getByLabel("drawio preview");
  await expect(drawioPreview).toContainText("<mxfile");
  await expect(drawioPreview).toContainText("shape=table");
  await expect(drawioPreview).toContainText("entityRelationEdgeStyle");

  await page.getByRole("button", { name: "Cancel" }).click();
});

test("imports a Mermaid erDiagram file", async ({ page }) => {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import model" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "crm.mmd",
    mimeType: "text/plain",
    buffer: Buffer.from(
      [
        "erDiagram",
        "  TEAM ||--o{ MEMBER : has",
        "  TEAM {",
        "    int id PK",
        '    string name "[required] display name"',
        "  }",
      ].join("\n"),
    ),
  });

  await expect(page.locator(".notice")).toContainText(
    "Imported 2 entities and 1 relationship",
  );
  await expect(page.locator(".entity-item").filter({ hasText: "TEAM" })).toBeVisible();
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(2);
});

test("imports a drawio file", async ({ page }) => {
  const drawioXml = `<mxfile host="app.diagrams.net"><diagram name="Page-1"><mxGraphModel><root>
    <mxCell id="0"/><mxCell id="1" parent="0"/>
    <mxCell id="t1" value="accounts" style="shape=table;startSize=30;container=1;collapsible=0;childLayout=tableLayout;" vertex="1" parent="1">
      <mxGeometry x="40" y="50" width="200" height="90" as="geometry"/>
    </mxCell>
    <mxCell id="r1" value="PK, id int" style="shape=partialRectangle;connectable=0;" vertex="1" parent="t1">
      <mxGeometry width="200" height="30" as="geometry"/>
    </mxCell>
  </root></mxGraphModel></diagram></mxfile>`;

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import model" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "accounts.drawio",
    mimeType: "text/xml",
    buffer: Buffer.from(drawioXml),
  });

  await expect(page.locator(".notice")).toContainText("Imported 1 entity");
  await expect(
    page.locator(".entity-item").filter({ hasText: "accounts" }),
  ).toBeVisible();
  await expect(page.locator(".diagram-canvas > .x6-graph-svg .x6-node")).toHaveCount(1);
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

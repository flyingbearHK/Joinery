// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";
import { BulkAttributesDialog } from "./BulkAttributesDialog";

function firstEntityId(): string {
  return Object.values(useProjectStore.getState().project.model.entities)[0].id;
}

describe("BulkAttributesDialog", () => {
  beforeEach(() => {
    useProjectStore.getState().resetSampleProject();
    useUiStore.getState().closeBulkImport();
  });

  it("stays closed until an import is requested", () => {
    render(<BulkAttributesDialog />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("imports pasted spreadsheet rows into the target entity", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore
      .getState()
      .openBulkImport(
        entityId,
        "region\tText\tSales region\njoined at\tDate & time\tWhen they joined",
      );
    render(<BulkAttributesDialog />);

    expect(
      screen.getByRole("dialog", { name: "Paste attributes" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Include region")).toBeChecked();
    expect(screen.getByLabelText("Include joined at")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Add 2 attributes" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    expect(entity.attributes).toHaveLength(before + 2);
    expect(entity.attributes[before]).toMatchObject({
      name: "region",
      logicalType: "Text",
      description: "Sales region",
    });
    expect(useUiStore.getState().bulkImport).toBeNull();
  });

  it("detects a header row and imports only data rows", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore
      .getState()
      .openBulkImport(
        entityId,
        "Attribute\tType\tDescription\nsku\tIdentifier\tProduct key",
      );
    render(<BulkAttributesDialog />);

    expect(screen.getByLabelText("Include sku")).toBeChecked();
    expect(screen.queryByLabelText("Include Attribute")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 attribute" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    expect(entity.attributes).toHaveLength(before + 1);
    expect(entity.attributes[before].name).toBe("sku");
  });

  it("accepts a typed plain list of attribute names", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore.getState().openBulkImport(entityId, "");
    render(<BulkAttributesDialog />);

    fireEvent.change(screen.getByLabelText(/one attribute per line/i), {
      target: { value: "alpha\nbeta\ngamma" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add 3 attributes" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    expect(entity.attributes).toHaveLength(before + 3);
    expect(entity.attributes[before + 2].name).toBe("gamma");
  });

  it("excludes unchecked preview rows", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore.getState().openBulkImport(entityId, "keep me\nskip me");
    render(<BulkAttributesDialog />);

    fireEvent.click(screen.getByLabelText("Include skip me"));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 attribute" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    expect(entity.attributes).toHaveLength(before + 1);
    expect(entity.attributes[before].name).toBe("keep me");
  });

  it("can create a new entity from pasted rows", () => {
    const entityCount = Object.keys(
      useProjectStore.getState().project.model.entities,
    ).length;
    useUiStore.getState().openBulkImport(null, "invoice id\ntotal");
    render(<BulkAttributesDialog />);

    fireEvent.change(screen.getByLabelText("New entity name"), {
      target: { value: "Invoice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create entity (2)" }));

    const state = useProjectStore.getState();
    expect(Object.keys(state.project.model.entities)).toHaveLength(entityCount + 1);
    const created = Object.values(state.project.model.entities).find(
      (entity) => entity.name === "Invoice",
    )!;
    expect(created.attributes.map((attribute) => attribute.name)).toEqual([
      "invoice id",
      "total",
    ]);
  });

  it("lets you edit name, type, and key flags in the staging grid", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore.getState().openBulkImport(entityId, "region code\nloyalty tier");
    render(<BulkAttributesDialog />);

    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "region" },
    });
    fireEvent.change(screen.getByLabelText("Type for region"), {
      target: { value: "Identifier" },
    });
    fireEvent.click(screen.getByLabelText("Primary key for region"));
    fireEvent.click(screen.getByLabelText("Required for loyalty tier"));
    fireEvent.click(screen.getByRole("button", { name: "Add 2 attributes" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    const [region, loyalty] = entity.attributes.slice(before);
    expect(region).toMatchObject({ name: "region", logicalType: "Identifier" });
    expect(
      entity.identifiers.some((identifier) =>
        identifier.attributeIds.includes(region.id),
      ),
    ).toBe(true);
    expect(loyalty.isRequired).toBe(true);
  });

  it("applies a type to every included row", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore.getState().openBulkImport(entityId, "a\tNumber\nb\nskip me");
    render(<BulkAttributesDialog />);

    fireEvent.click(screen.getByLabelText("Include skip me"));
    fireEvent.change(screen.getByLabelText("Type for all"), {
      target: { value: "Date" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 2 attributes" }));

    const added = useProjectStore
      .getState()
      .project.model.entities[entityId].attributes.slice(before);
    expect(added.map((attribute) => attribute.logicalType)).toEqual(["Date", "Date"]);
  });

  it("supports manually added and removed rows without source text", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore.getState().openBulkImport(entityId, "");
    render(<BulkAttributesDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Add rows manually" }));
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.change(screen.getByLabelText("Name for row 1"), {
      target: { value: "extra field" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove row 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 attribute" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    expect(entity.attributes).toHaveLength(before + 1);
    expect(entity.attributes[before].name).toBe("extra field");
  });

  it("creates identifying relationships for rows with a references target", () => {
    const state = useProjectStore.getState();
    const customer = Object.values(state.project.model.entities).find(
      (entity) => entity.name === "Customer",
    )!;
    const entityId = Object.values(state.project.model.entities).find(
      (entity) => entity.name === "Order",
    )!.id;
    const relationshipsBefore = Object.keys(state.project.model.relationships);

    useUiStore.getState().openBulkImport(entityId, "customer ref");
    render(<BulkAttributesDialog />);

    fireEvent.change(screen.getByLabelText("References for customer ref"), {
      target: { value: customer.id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add 1 attribute" }));

    const after = useProjectStore.getState().project.model.relationships;
    const created = Object.values(after).find(
      (relationship) => !relationshipsBefore.includes(relationship.id),
    )!;
    expect(created.sourceEntityId).toBe(customer.id);
    expect(created.targetEntityId).toBe(entityId);
    expect(created.sourceAttributeId).toBe(customer.identifiers[0].attributeIds[0]);
    expect(created.targetAttributeId).not.toBeNull();
  });

  it("flags duplicate and existing names as warnings", () => {
    const entityId = firstEntityId();
    const existing =
      useProjectStore.getState().project.model.entities[entityId].attributes[0].name;
    useUiStore.getState().openBulkImport(entityId, `${existing}\ndupe\ndupe`);
    render(<BulkAttributesDialog />);

    expect(screen.getByText("3 warnings")).toBeInTheDocument();
  });

  it("reorders staged rows and commits in the new order", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore.getState().openBulkImport(entityId, "alpha\nbeta\ngamma");
    render(<BulkAttributesDialog />);

    fireEvent.click(screen.getByLabelText("Move gamma up"));
    fireEvent.click(screen.getByLabelText("Move gamma up"));
    fireEvent.click(screen.getByRole("button", { name: "Add 3 attributes" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    expect(entity.attributes.slice(before).map((attribute) => attribute.name)).toEqual([
      "gamma",
      "alpha",
      "beta",
    ]);
  });

  it("shift-click moves a staged row straight to the top", () => {
    const entityId = firstEntityId();
    const before =
      useProjectStore.getState().project.model.entities[entityId].attributes.length;
    useUiStore.getState().openBulkImport(entityId, "alpha\nbeta\ngamma");
    render(<BulkAttributesDialog />);

    fireEvent.click(screen.getByLabelText("Move gamma up"), { shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Add 3 attributes" }));

    const entity = useProjectStore.getState().project.model.entities[entityId];
    expect(entity.attributes[before].name).toBe("gamma");
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../state/projectStore";
import { Inspector } from "./Inspector";

describe("Inspector", () => {
  beforeEach(() => {
    useProjectStore.getState().resetSampleProject();
  });

  it("edits the selected entity and adds keyboard-first attributes", () => {
    const entity = Object.values(useProjectStore.getState().project.model.entities)[0];
    useProjectStore.getState().setSelection({ kind: "entity", id: entity.id });
    render(<Inspector />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Account" },
    });
    expect(useProjectStore.getState().project.model.entities[entity.id].name).toBe(
      "Account",
    );

    const initialCount = entity.attributes.length;
    const lastName = screen.getByLabelText(`Attribute ${initialCount} name`);
    fireEvent.keyDown(lastName, { key: "Enter" });
    expect(
      useProjectStore.getState().project.model.entities[entity.id].attributes,
    ).toHaveLength(initialCount + 1);
  });

  it("edits relationship endpoint mappings and cardinality", () => {
    const relationship = Object.values(
      useProjectStore.getState().project.model.relationships,
    )[0];
    const source =
      useProjectStore.getState().project.model.entities[relationship.sourceEntityId];
    useProjectStore
      .getState()
      .setSelection({ kind: "relationship", id: relationship.id });
    render(<Inspector />);

    const sourceAttributeSelect = screen.getByLabelText("Source connected attribute");
    fireEvent.change(sourceAttributeSelect, {
      target: { value: source.attributes[0].id },
    });

    expect(
      useProjectStore.getState().project.model.relationships[relationship.id]
        .sourceAttributeId,
    ).toBe(source.attributes[0].id);
  });

  it("shows editable project properties when no object is selected", () => {
    useProjectStore.getState().setSelection(null);
    render(<Inspector />);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Enterprise model" },
    });
    expect(useProjectStore.getState().project.name).toBe("Enterprise model");
  });
});

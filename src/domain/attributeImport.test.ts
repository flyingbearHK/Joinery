import { describe, expect, it } from "vitest";
import {
  buildAttributeDrafts,
  detectHeaderRow,
  parseAttributeSourceText,
  suggestColumnRoles,
} from "./attributeImport";

const KNOWN_TYPES = ["Text", "Number", "Decimal", "Identifier", "Email"];

describe("parseAttributeSourceText", () => {
  it("splits tab-separated spreadsheet rows", () => {
    const rows = parseAttributeSourceText(
      "customer id\tIdentifier\tStable key\nname\tText\tDisplay name",
    );
    expect(rows).toEqual([
      ["customer id", "Identifier", "Stable key"],
      ["name", "Text", "Display name"],
    ]);
  });

  it("splits comma-separated rows and respects quoted cells", () => {
    const rows = parseAttributeSourceText(
      'name,Text,"Display name, shown publicly"\nemail,Email,',
    );
    expect(rows).toEqual([
      ["name", "Text", "Display name, shown publicly"],
      ["email", "Email", ""],
    ]);
  });

  it("unescapes doubled quotes inside quoted cells", () => {
    const rows = parseAttributeSourceText('note,Text,"say ""hi"""');
    expect(rows[0][2]).toBe('say "hi"');
  });

  it("treats plain newline text as a single name column", () => {
    expect(parseAttributeSourceText("alpha\n beta \n\n gamma")).toEqual([
      ["alpha"],
      ["beta"],
      ["gamma"],
    ]);
  });

  it("ignores empty lines and trims cells", () => {
    const rows = parseAttributeSourceText("\n  \t \nname\n");
    expect(rows).toEqual([["name"]]);
  });
});

describe("detectHeaderRow", () => {
  it("detects a header row from common spreadsheet headers", () => {
    const rows = parseAttributeSourceText(
      "Attribute Name\tData Type\tDescription\nid\tIdentifier\tKey",
    );
    expect(detectHeaderRow(rows)).toBe(true);
  });

  it("rejects data-only rows", () => {
    const rows = parseAttributeSourceText("id\tIdentifier\nname\tText");
    expect(detectHeaderRow(rows)).toBe(false);
  });

  it("never treats a single row as a header", () => {
    expect(detectHeaderRow([["name", "type"]])).toBe(false);
  });
});

describe("suggestColumnRoles", () => {
  it("maps columns from header names", () => {
    const rows = parseAttributeSourceText(
      "Attribute\tType\tDefinition\nid\tIdentifier\tKey",
    );
    expect(suggestColumnRoles(rows, true, KNOWN_TYPES)).toEqual([
      "name",
      "type",
      "description",
    ]);
  });

  it("guesses type and description columns without a header", () => {
    const rows = parseAttributeSourceText(
      "id\tIdentifier\tStable key\nname\tText\tDisplay name",
    );
    expect(suggestColumnRoles(rows, false, KNOWN_TYPES)).toEqual([
      "name",
      "type",
      "description",
    ]);
  });

  it("treats the second column as description when it is not type-like", () => {
    const rows = parseAttributeSourceText("id\tStable key\nname\tDisplay name");
    expect(suggestColumnRoles(rows, false, KNOWN_TYPES)).toEqual([
      "name",
      "description",
    ]);
  });

  it("recognizes physical-looking type names as a type column", () => {
    const rows = parseAttributeSourceText("id\tvarchar(32)\nname\tint\nflag\tboolean");
    expect(suggestColumnRoles(rows, false, KNOWN_TYPES)).toEqual(["name", "type"]);
  });

  it("keeps only the last non-type column as description", () => {
    const rows = parseAttributeSourceText(
      "id\tIdentifier\textra\tStable key\nname\tText\textra\tDisplay name",
    );
    expect(suggestColumnRoles(rows, false, KNOWN_TYPES)).toEqual([
      "name",
      "type",
      "ignore",
      "description",
    ]);
  });
});

describe("buildAttributeDrafts", () => {
  it("builds drafts using the assigned roles and skips the header", () => {
    const rows = parseAttributeSourceText(
      "Attribute\tType\tDefinition\nid\tIdentifier\tStable key\nname\tText\t",
    );
    const roles = suggestColumnRoles(rows, true, KNOWN_TYPES);
    expect(buildAttributeDrafts(rows, roles, true, KNOWN_TYPES)).toEqual([
      {
        name: "id",
        logicalType: "Identifier",
        description: "Stable key",
        isRequired: false,
        isIdentifier: false,
      },
      {
        name: "name",
        logicalType: "Text",
        description: "",
        isRequired: false,
        isIdentifier: false,
      },
    ]);
  });

  it("normalizes known type casing and defaults missing types to Text", () => {
    const drafts = buildAttributeDrafts(
      [
        ["id", "identifier"],
        ["note", ""],
      ],
      ["name", "type"],
      false,
      KNOWN_TYPES,
    );
    expect(drafts[0].logicalType).toBe("Identifier");
    expect(drafts[1].logicalType).toBe("Text");
  });

  it("keeps unknown type names verbatim", () => {
    const drafts = buildAttributeDrafts(
      [["id", "varchar(64)"]],
      ["name", "type"],
      false,
      KNOWN_TYPES,
    );
    expect(drafts[0].logicalType).toBe("varchar(64)");
  });

  it("drops rows with empty names", () => {
    const drafts = buildAttributeDrafts(
      [
        ["", "Identifier"],
        ["name", "Text"],
      ],
      ["name", "type"],
      false,
      KNOWN_TYPES,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("name");
  });
});

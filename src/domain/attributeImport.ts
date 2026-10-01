import { COMMON_LOGICAL_TYPES } from "./model";

/**
 * Bulk attribute import from pasted spreadsheet or plain-text sources.
 * Rows are one attribute each; columns are mapped to roles by suggestion
 * and can be reassigned by the user before import.
 */

export interface AttributeImportDraft {
  name: string;
  logicalType: string;
  description: string;
  isRequired: boolean;
  isIdentifier: boolean;
  /** When set, committing the draft also creates an identifying relationship
   * from this entity's primary identifier attribute to the new attribute —
   * the spreadsheet "foreign key" workflow. */
  referencesEntityId?: string;
}

export type AttributeColumnRole = "name" | "type" | "description" | "ignore";

export const ATTRIBUTE_COLUMN_ROLE_OPTIONS: ReadonlyArray<{
  value: AttributeColumnRole;
  label: string;
}> = [
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
  { value: "description", label: "Description" },
  { value: "ignore", label: "Ignore" },
];

const NAME_HEADERS = new Set([
  "name",
  "attribute",
  "attribute name",
  "attributename",
  "column",
  "column name",
  "columnname",
  "field",
  "field name",
  "fieldname",
  "logical name",
  "attribute_name",
  "column_name",
  "field_name",
]);

const TYPE_HEADERS = new Set([
  "type",
  "data type",
  "datatype",
  "data_type",
  "logical type",
  "logical_type",
  "attribute type",
  "domain",
  "format",
]);

const DESCRIPTION_HEADERS = new Set([
  "description",
  "desc",
  "definition",
  "business definition",
  "comment",
  "comments",
  "note",
  "notes",
  "details",
  "purpose",
]);

const TYPEISH_PATTERN =
  /^(var)?char\w*(\(\d+\))?|n(var)?char(\(\d+\))?|int\w*|integer|bigint|smallint|tinyint|number(\(\d+(,\s*\d+)?\))?|numeric|decimal(\(\d+(,\s*\d+)?\))?|float|double|real|bool(ean)?|bit|date|time(stamp)?|datetime2?|uuid|uniqueidentifier|jsonb?|text|ntext|clob|blob|money|serial|bigserial|identity|xml|interval|array|enum$/i;

function unquote(cell: string): string {
  if (cell.length >= 2 && cell.startsWith('"') && cell.endsWith('"')) {
    return cell.slice(1, -1).replace(/""/g, '"');
  }
  return cell;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Splits pasted text into rows of cells. Tab-separated input (Excel,
 * Numbers, Google Sheets) is preferred; otherwise comma-separated input
 * with quote handling; otherwise each non-empty line is a single cell.
 */
export function parseAttributeSourceText(text: string): string[][] {
  const lines = text.split(/\r\n|\r|\n/);
  const hasTabs = lines.some((line) => line.includes("\t"));
  return lines
    .map((line) => {
      if (hasTabs) return line.split("\t");
      if (line.includes(",")) return splitCsvLine(line);
      return [line];
    })
    .map((cells) => cells.map((cell) => unquote(cell.trim()).trim()))
    .filter((cells) => cells.some((cell) => cell.length > 0));
}

function headerRole(cell: string): AttributeColumnRole | null {
  const normalized = cell.trim().toLowerCase();
  if (NAME_HEADERS.has(normalized)) return "name";
  if (TYPE_HEADERS.has(normalized)) return "type";
  if (DESCRIPTION_HEADERS.has(normalized)) return "description";
  return null;
}

/**
 * Returns true when the first row looks like column headers: a majority
 * of its cells match known header names and at least one names the
 * attribute column. A lone row is never treated as a header.
 */
export function detectHeaderRow(rows: string[][]): boolean {
  if (rows.length < 2) return false;
  const first = rows[0];
  if (first.length === 0) return false;
  const roles = first.map((cell) => headerRole(cell));
  const recognized = roles.filter((role) => role !== null).length;
  return roles.includes("name") && recognized >= Math.ceil(first.length / 2);
}

function looksLikeTypeColumn(
  rows: string[][],
  index: number,
  knownTypes: ReadonlySet<string>,
): boolean {
  const values = rows
    .map((row) => (row[index] ?? "").trim())
    .filter((value) => value.length > 0);
  if (values.length === 0) return false;
  const hits = values.filter(
    (value) => knownTypes.has(value.toLowerCase()) || TYPEISH_PATTERN.test(value),
  ).length;
  return hits >= Math.ceil(values.length / 2);
}

/**
 * Suggests a role for each parsed column. Header names drive the mapping
 * when a header row is present; otherwise the first column is the name
 * and later columns are guessed by their content.
 */
export function suggestColumnRoles(
  rows: string[][],
  hasHeader: boolean,
  knownTypeNames: readonly string[],
): AttributeColumnRole[] {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const roles: AttributeColumnRole[] = new Array(columnCount).fill("ignore");
  if (columnCount === 0) return roles;
  const knownTypes = new Set(knownTypeNames.map((name) => name.toLowerCase()));

  if (hasHeader) {
    rows[0].forEach((cell, index) => {
      roles[index] = headerRole(cell) ?? "ignore";
    });
    if (!roles.includes("name")) roles[0] = "name";
    return roles;
  }

  roles[0] = "name";
  let typeAssigned = false;
  let descriptionIndex = -1;
  for (let index = 1; index < columnCount; index += 1) {
    if (!typeAssigned && looksLikeTypeColumn(rows, index, knownTypes)) {
      roles[index] = "type";
      typeAssigned = true;
    } else {
      descriptionIndex = index;
    }
  }
  if (descriptionIndex > 0) roles[descriptionIndex] = "description";
  return roles;
}

function normalizeLogicalType(
  raw: string,
  typeLookup: ReadonlyMap<string, string>,
): string {
  if (!raw) return "Text";
  return typeLookup.get(raw.toLowerCase()) ?? raw;
}

/**
 * Applies column roles to parsed rows and returns attribute drafts,
 * skipping rows whose name cell is empty. Type values are normalized to
 * known logical type casing when they match.
 */
export function buildAttributeDrafts(
  rows: string[][],
  roles: AttributeColumnRole[],
  hasHeader: boolean,
  knownTypeNames: readonly string[] = COMMON_LOGICAL_TYPES,
): AttributeImportDraft[] {
  const nameIndex = roles.indexOf("name");
  const typeIndex = roles.indexOf("type");
  const descriptionIndex = roles.indexOf("description");
  const typeLookup = new Map(knownTypeNames.map((name) => [name.toLowerCase(), name]));

  return rows
    .slice(hasHeader ? 1 : 0)
    .map((cells) => ({
      name: (nameIndex >= 0 ? (cells[nameIndex] ?? "") : "").trim(),
      logicalType: normalizeLogicalType(
        (typeIndex >= 0 ? (cells[typeIndex] ?? "") : "").trim(),
        typeLookup,
      ),
      description: (descriptionIndex >= 0
        ? (cells[descriptionIndex] ?? "")
        : ""
      ).trim(),
      isRequired: false,
      isIdentifier: false,
    }))
    .filter((draft) => draft.name.length > 0);
}

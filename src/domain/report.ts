import type { JoineryProject } from "./model";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function createModelCsv(project: JoineryProject): string {
  const rows = [
    [
      "Entity",
      "Entity description",
      "Attribute",
      "Logical type",
      "Required",
      "Identifiers",
      "Attribute description",
    ],
  ];

  Object.values(project.model.entities)
    .sort((left, right) => left.name.localeCompare(right.name))
    .forEach((entity) => {
      entity.attributes.forEach((attribute) => {
        const identifiers = entity.identifiers
          .filter((identifier) => identifier.attributeIds.includes(attribute.id))
          .map((identifier) => `${identifier.kind}: ${identifier.name}`)
          .join("; ");
        rows.push([
          entity.name,
          entity.description,
          attribute.name,
          attribute.logicalType,
          attribute.isRequired ? "Yes" : "No",
          identifiers,
          attribute.description,
        ]);
      });
      if (entity.attributes.length === 0) {
        rows.push([entity.name, entity.description, "", "", "", "", ""]);
      }
    });

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function createModelHtmlReport(project: JoineryProject): string {
  const entities = Object.values(project.model.entities).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const relationships = Object.values(project.model.relationships).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const entitySections = entities
    .map((entity) => {
      const rows = entity.attributes
        .map((attribute) => {
          const identifiers = entity.identifiers
            .filter((identifier) => identifier.attributeIds.includes(attribute.id))
            .map((identifier) =>
              identifier.kind === "primary" ? "Primary" : identifier.name,
            )
            .join(", ");
          return `<tr><td>${escapeHtml(attribute.name)}</td><td>${escapeHtml(
            attribute.logicalType,
          )}</td><td>${attribute.isRequired ? "Yes" : "No"}</td><td>${escapeHtml(
            identifiers,
          )}</td><td>${escapeHtml(attribute.description)}</td></tr>`;
        })
        .join("");
      return `<section><h2>${escapeHtml(entity.name)}</h2><p>${escapeHtml(
        entity.description,
      )}</p><table><thead><tr><th>Attribute</th><th>Logical type</th><th>Required</th><th>Identifier</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    })
    .join("\n");

  const logicalTypeRows = Object.values(project.model.logicalTypes)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(
      (logicalType) =>
        `<tr><td>${escapeHtml(logicalType.name)}</td><td>${escapeHtml(
          logicalType.baseType,
        )}</td><td>${escapeHtml(logicalType.format)}</td><td>${escapeHtml(
          logicalType.description,
        )}</td></tr>`,
    )
    .join("");

  const relationshipRows = relationships
    .map((relationship) => {
      const source = project.model.entities[relationship.sourceEntityId];
      const target = project.model.entities[relationship.targetEntityId];
      return `<tr><td>${escapeHtml(relationship.name || "—")}</td><td>${escapeHtml(
        relationship.kind,
      )}</td><td>${escapeHtml(source?.name ?? "Missing entity")}</td><td>${escapeHtml(
        relationship.sourceRole,
      )}</td><td>${escapeHtml(relationship.sourceCardinality)}</td><td>${escapeHtml(
        target?.name ?? "Missing entity",
      )}</td><td>${escapeHtml(relationship.targetRole)}</td><td>${escapeHtml(
        relationship.targetCardinality,
      )}</td><td>${relationship.isIdentifying ? "Yes" : "No"}</td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(
    project.name,
  )} — Joinery model report</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:1100px;margin:40px auto;padding:0 24px;color:#302a3d}h1{margin-bottom:4px}h2{margin-top:34px;border-bottom:2px solid #7453bd;padding-bottom:6px}p{color:#71697c}table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px}th,td{border:1px solid #ded9e5;padding:8px;text-align:left;vertical-align:top}th{background:#f2eef9}.summary{display:flex;gap:18px;margin:18px 0}.summary span{border:1px solid #ded9e5;border-radius:8px;padding:10px 14px}footer{margin-top:40px;color:#928b9c;font-size:11px}@media print{body{margin:0;max-width:none}section{break-inside:avoid}}</style></head><body>
<header><h1>${escapeHtml(project.name)}</h1><p>${escapeHtml(
    project.description,
  )}</p><div class="summary"><span>${entities.length} entities</span><span>${relationships.length} relationships</span><span>${
    Object.keys(project.diagrams).length
  } diagrams</span></div></header>
${entitySections}
<section><h2>Logical type library</h2><table><thead><tr><th>Name</th><th>Base type</th><th>Format</th><th>Description</th></tr></thead><tbody>${logicalTypeRows}</tbody></table></section>
<section><h2>Relationships</h2><table><thead><tr><th>Name</th><th>Type</th><th>Source</th><th>Source role</th><th>Cardinality</th><th>Target</th><th>Target role</th><th>Cardinality</th><th>Identifying</th></tr></thead><tbody>${relationshipRows}</tbody></table></section>
<footer>Generated by Joinery on ${escapeHtml(new Date().toLocaleString())}</footer></body></html>`;
}

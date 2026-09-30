import type { Graph } from "@antv/x6";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type ExportBackground = "white" | "transparent";

export interface SvgExportOptions {
  background: ExportBackground;
  title: string;
  margin?: number;
}

export interface SvgExportResult {
  svg: string;
  width: number;
  height: number;
}

function removeEditorOnlyElements(svg: SVGSVGElement): void {
  svg
    .querySelectorAll(
      [
        ".x6-port",
        ".connection-wrap",
        ".joinery-edge-hit-area",
        ".vertices",
        ".arrowheads",
        ".tools",
        ".x6-cell-tools",
        ".x6-cell-tool",
      ].join(","),
    )
    .forEach((element) => element.remove());
}

function normalizeDefinitionIds(svg: SVGSVGElement): void {
  const replacements = new Map<string, string>();
  svg.querySelectorAll<SVGElement>("defs [id]").forEach((element, index) => {
    const previousId = element.id;
    const nextId = `joinery-definition-${index + 1}`;
    replacements.set(previousId, nextId);
    element.id = nextId;
  });

  if (replacements.size === 0) return;
  svg.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      let value = attribute.value;
      replacements.forEach((nextId, previousId) => {
        value = value
          .split(`url(#${previousId})`)
          .join(`url(#${nextId})`)
          .split(`#${previousId}`)
          .join(`#${nextId}`);
      });
      if (value !== attribute.value) element.setAttribute(attribute.name, value);
    }
  });
}

export function createDiagramSvg(
  graph: Graph,
  options: SvgExportOptions,
): SvgExportResult {
  const margin = Math.max(0, options.margin ?? 48);
  const modelBounds = graph.model.getAllCellsBBox();
  const bounds = modelBounds
    ? {
        x: Math.floor(modelBounds.x - margin),
        y: Math.floor(modelBounds.y - margin),
        width: Math.ceil(modelBounds.width + margin * 2),
        height: Math.ceil(modelBounds.height + margin * 2),
      }
    : { x: 0, y: 0, width: 640, height: 400 };
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);

  const svg = graph.view.svg.cloneNode(true) as SVGSVGElement;
  removeEditorOnlyElements(svg);
  normalizeDefinitionIds(svg);

  svg.setAttribute("xmlns", SVG_NAMESPACE);
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `${bounds.x} ${bounds.y} ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", options.title);
  svg.removeAttribute("class");
  svg.removeAttribute("style");

  const viewport = svg.querySelector<SVGGElement>(".x6-graph-svg-viewport");
  viewport?.removeAttribute("transform");

  const title = document.createElementNS(SVG_NAMESPACE, "title");
  title.textContent = options.title;
  svg.insertBefore(title, svg.firstChild);

  const definitions = svg.querySelector("defs");
  const style = document.createElementNS(SVG_NAMESPACE, "style");
  style.textContent = `
    .joinery-edge-line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
    text { text-rendering: geometricPrecision; }
  `;
  definitions?.insertAdjacentElement("afterend", style);

  if (options.background === "white") {
    const background = document.createElementNS(SVG_NAMESPACE, "rect");
    background.setAttribute("x", String(bounds.x));
    background.setAttribute("y", String(bounds.y));
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", "#ffffff");
    background.setAttribute("data-export-background", "true");
    const insertionPoint = style.nextSibling;
    svg.insertBefore(background, insertionPoint);
  }

  const serialized = new XMLSerializer().serializeToString(svg);
  return {
    svg: `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`,
    width,
    height,
  };
}

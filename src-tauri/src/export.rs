use std::collections::HashMap;

use pdf_writer::{Content, Finish, Name, Pdf, Rect, Ref};

const MAX_SVG_BYTES: usize = 25 * 1024 * 1024;
const MAX_RASTER_DIMENSION: u32 = 24_000;
const MAX_RASTER_PIXELS: u64 = 120_000_000;
const PDF_MARGIN: f32 = 28.0;
const SVG_POINT_SCALE: f32 = 72.0 / 96.0;

fn parse_svg(svg: &str) -> Result<resvg::usvg::Tree, String> {
    if svg.len() > MAX_SVG_BYTES {
        return Err("The diagram SVG is too large to export safely.".to_string());
    }

    let mut options = resvg::usvg::Options::default();
    options.fontdb_mut().load_system_fonts();
    resvg::usvg::Tree::from_str(svg, &options)
        .map_err(|error| format!("Could not parse the diagram SVG: {error}"))
}

pub fn render_png(svg: &str, scale: f32) -> Result<Vec<u8>, String> {
    if !scale.is_finite() || !(0.25..=4.0).contains(&scale) {
        return Err("PNG scale must be between 0.25 and 4.".to_string());
    }

    let tree = parse_svg(svg)?;
    let base_size = tree.size().to_int_size();
    let output_size = base_size
        .scale_by(scale)
        .ok_or_else(|| "Could not calculate the PNG dimensions.".to_string())?;
    let pixels = u64::from(output_size.width()) * u64::from(output_size.height());

    if output_size.width() > MAX_RASTER_DIMENSION
        || output_size.height() > MAX_RASTER_DIMENSION
        || pixels > MAX_RASTER_PIXELS
    {
        return Err(format!(
            "The requested PNG is too large ({} × {} pixels). Reduce the export scale.",
            output_size.width(),
            output_size.height()
        ));
    }

    let mut pixmap = resvg::tiny_skia::Pixmap::new(output_size.width(), output_size.height())
        .ok_or_else(|| "Could not allocate memory for the PNG export.".to_string())?;
    let transform = resvg::tiny_skia::Transform::from_scale(scale, scale);
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    pixmap
        .encode_png()
        .map_err(|error| format!("Could not encode the PNG: {error}"))
}

fn page_dimensions(mode: &str) -> Option<(f32, f32)> {
    match mode {
        "a4-portrait" => Some((595.28, 841.89)),
        "a4-landscape" | "tile-a4-landscape" => Some((841.89, 595.28)),
        "a3-portrait" => Some((841.89, 1190.55)),
        "a3-landscape" => Some((1190.55, 841.89)),
        _ => None,
    }
}

fn render_paginated_pdf(
    tree: &resvg::usvg::Tree,
    page_width: f32,
    page_height: f32,
    tiled: bool,
) -> Result<Vec<u8>, String> {
    let (svg_chunk, svg_id) = svg2pdf::to_chunk(tree, svg2pdf::ConversionOptions::default())
        .map_err(|error| format!("Could not convert the diagram to PDF: {error}"))?;

    let mut allocation = Ref::new(1);
    let catalog_id = allocation.bump();
    let page_tree_id = allocation.bump();
    let mut mapping = HashMap::new();
    let svg_chunk =
        svg_chunk.renumber(|old| *mapping.entry(old).or_insert_with(|| allocation.bump()));
    let svg_id = *mapping
        .get(&svg_id)
        .ok_or_else(|| "Could not allocate the PDF diagram resource.".to_string())?;

    let available_width = page_width - PDF_MARGIN * 2.0;
    let available_height = page_height - PDF_MARGIN * 2.0;
    let svg_width = tree.size().width();
    let svg_height = tree.size().height();

    let (draw_width, draw_height, columns, rows, scale) = if tiled {
        let scale = SVG_POINT_SCALE;
        let full_width = svg_width * scale;
        let full_height = svg_height * scale;
        (
            full_width,
            full_height,
            (full_width / available_width).ceil().max(1.0) as usize,
            (full_height / available_height).ceil().max(1.0) as usize,
            scale,
        )
    } else {
        let scale = (available_width / svg_width)
            .min(available_height / svg_height)
            .min(1.0);
        (svg_width * scale, svg_height * scale, 1, 1, scale)
    };

    let page_count = columns * rows;
    let page_ids: Vec<_> = (0..page_count).map(|_| allocation.bump()).collect();
    let content_ids: Vec<_> = (0..page_count).map(|_| allocation.bump()).collect();
    let svg_name = Name(b"Diagram");
    let mut pdf = Pdf::new();
    pdf.catalog(catalog_id).pages(page_tree_id);
    pdf.pages(page_tree_id)
        .kids(page_ids.iter().copied())
        .count(page_count as i32);

    for row in 0..rows {
        for column in 0..columns {
            let page_index = row * columns + column;
            let page_id = page_ids[page_index];
            let content_id = content_ids[page_index];
            let mut page = pdf.page(page_id);
            page.media_box(Rect::new(0.0, 0.0, page_width, page_height));
            page.parent(page_tree_id);
            page.contents(content_id);
            let mut resources = page.resources();
            resources.x_objects().pair(svg_name, svg_id);
            resources.finish();
            page.finish();

            let mut content = Content::new();
            content.save_state();
            content
                .rect(PDF_MARGIN, PDF_MARGIN, available_width, available_height)
                .clip_nonzero()
                .end_path();

            let x = if tiled {
                PDF_MARGIN - column as f32 * available_width
            } else {
                (page_width - draw_width) / 2.0
            };
            let y = if tiled {
                page_height - PDF_MARGIN - draw_height + row as f32 * available_height
            } else {
                (page_height - draw_height) / 2.0
            };
            content
                .transform([draw_width, 0.0, 0.0, draw_height, x, y])
                .x_object(svg_name)
                .restore_state();
            pdf.stream(content_id, &content.finish());
        }
    }

    // Keep the scale calculation explicit for tiled output documentation and
    // guard accidental zero-sized SVGs after parsing.
    if !scale.is_finite() || scale <= 0.0 {
        return Err("Could not calculate a PDF scale.".to_string());
    }
    pdf.extend(&svg_chunk);
    Ok(pdf.finish())
}

pub fn render_pdf(svg: &str, page_mode: &str) -> Result<Vec<u8>, String> {
    let tree = parse_svg(svg)?;
    if page_mode == "content" {
        return svg2pdf::to_pdf(
            &tree,
            svg2pdf::ConversionOptions::default(),
            svg2pdf::PageOptions { dpi: 96.0 },
        )
        .map_err(|error| format!("Could not convert the diagram to PDF: {error}"));
    }

    let (page_width, page_height) = page_dimensions(page_mode)
        .ok_or_else(|| format!("Unsupported PDF page mode “{page_mode}”."))?;
    render_paginated_pdf(
        &tree,
        page_width,
        page_height,
        page_mode == "tile-a4-landscape",
    )
}

#[cfg(test)]
mod tests {
    use super::{render_pdf, render_png};

    const SAMPLE_SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#fff"/><rect x="10" y="10" width="100" height="60" rx="8" fill="#7857c8"/><text x="60" y="45" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#fff">Joinery</text></svg>"##;

    #[test]
    fn renders_png_at_requested_scale() {
        let png = render_png(SAMPLE_SVG, 2.0).expect("render PNG");
        assert!(png.starts_with(b"\x89PNG\r\n\x1a\n"));
        let width = u32::from_be_bytes(png[16..20].try_into().expect("PNG width"));
        let height = u32::from_be_bytes(png[20..24].try_into().expect("PNG height"));
        assert_eq!((width, height), (240, 160));
    }

    #[test]
    fn renders_content_and_standard_page_vector_pdfs() {
        for mode in [
            "content",
            "a4-portrait",
            "a3-landscape",
            "tile-a4-landscape",
        ] {
            let pdf = render_pdf(SAMPLE_SVG, mode).expect("render PDF");
            assert!(pdf.starts_with(b"%PDF-"));
            assert!(pdf.len() > 500);
        }
    }

    #[test]
    fn tiled_pdf_contains_multiple_pages_for_a_large_diagram() {
        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="1300" viewBox="0 0 2200 1300"><rect width="2200" height="1300" fill="#fff"/><path d="M0 0L2200 1300" stroke="#000"/></svg>"##;
        let pdf = render_pdf(svg, "tile-a4-landscape").expect("render tiled PDF");
        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains("/Count 6"));
    }

    #[test]
    fn renders_the_x6_compatibility_fixture() {
        let svg = include_str!("../tests/fixtures/x6-diagram.svg");
        let png = render_png(svg, 1.0).expect("render X6 PNG");
        let pdf = render_pdf(svg, "content").expect("render X6 PDF");
        assert!(png.starts_with(b"\x89PNG\r\n\x1a\n"));
        assert!(pdf.starts_with(b"%PDF-"));
    }

    #[test]
    fn rejects_unsafe_png_scale() {
        assert!(render_png(SAMPLE_SVG, 10.0).is_err());
    }
}

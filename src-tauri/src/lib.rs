mod export;

use std::{
    collections::VecDeque,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};
use tempfile::NamedTempFile;

const MAX_DOCUMENT_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Default)]
struct PendingOpenFiles(Mutex<VecDeque<String>>);

fn is_joinery_path(path: &str) -> bool {
    path.to_ascii_lowercase().ends_with(".joinery")
}

fn queue_open_files(app: &AppHandle, paths: impl IntoIterator<Item = String>) {
    let paths: Vec<String> = paths
        .into_iter()
        .filter(|path| is_joinery_path(path))
        .collect();
    if paths.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<PendingOpenFiles>().0.lock() {
        pending.extend(paths.iter().cloned());
    }
    for path in paths {
        let _ = tauri::Emitter::emit(app, "joinery://open-file", path);
    }
}

fn path_error(action: &str, path: &Path, error: impl std::fmt::Display) -> String {
    format!("Could not {action} “{}”: {error}", path.display())
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| format!("Could not determine the folder for “{}”.", path.display()))?;

    fs::create_dir_all(parent)
        .map_err(|error| path_error("create the destination folder for", path, error))?;

    let mut temporary = NamedTempFile::new_in(parent)
        .map_err(|error| path_error("create a temporary file beside", path, error))?;
    temporary
        .write_all(contents)
        .map_err(|error| path_error("write the temporary project for", path, error))?;
    temporary
        .as_file_mut()
        .sync_all()
        .map_err(|error| path_error("flush the temporary project for", path, error))?;

    temporary
        .persist(path)
        .map_err(|error| path_error("replace", path, error.error))?;

    #[cfg(unix)]
    {
        fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| path_error("flush the destination folder for", path, error))?;
    }

    Ok(())
}

fn read_utf8_file(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| path_error("inspect", path, error))?;
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err(format!(
            "Could not read “{}”: the file is larger than 50 MB.",
            path.display()
        ));
    }

    let bytes = fs::read(path).map_err(|error| path_error("read", path, error))?;
    String::from_utf8(bytes)
        .map_err(|error| path_error("decode as UTF-8", path, error.utf8_error()))
}

fn recovery_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("recovery-v1.joinery"))
        .map_err(|error| format!("Could not locate Joinery's application data folder: {error}"))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    read_utf8_file(&PathBuf::from(path))
}

#[tauri::command]
fn write_text_file_atomic(path: String, contents: String) -> Result<(), String> {
    if contents.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("Could not save the project because it is larger than 50 MB.".to_string());
    }
    atomic_write(Path::new(&path), contents.as_bytes())
}

#[tauri::command]
fn export_svg_file(path: String, svg: String) -> Result<(), String> {
    atomic_write(Path::new(&path), svg.as_bytes())
}

#[tauri::command]
fn export_png_file(path: String, svg: String, scale: f32) -> Result<(), String> {
    let png = export::render_png(&svg, scale)?;
    atomic_write(Path::new(&path), &png)
}

#[tauri::command]
fn export_pdf_file(path: String, svg: String, page_mode: String) -> Result<(), String> {
    let pdf = export::render_pdf(&svg, &page_mode)?;
    atomic_write(Path::new(&path), &pdf)
}

#[tauri::command]
fn write_recovery_file(app: AppHandle, contents: String) -> Result<(), String> {
    if contents.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("Could not preserve recovery data larger than 50 MB.".to_string());
    }
    let path = recovery_path(&app)?;
    atomic_write(&path, contents.as_bytes())
}

#[tauri::command]
fn read_recovery_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = recovery_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    read_utf8_file(&path).map(Some)
}

#[tauri::command]
fn clear_recovery_file(app: AppHandle) -> Result<(), String> {
    let path = recovery_path(&app)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(path_error("remove", &path, error)),
    }
}

#[tauri::command]
fn take_pending_open_file(state: tauri::State<'_, PendingOpenFiles>) -> Option<String> {
    state.0.lock().ok()?.pop_front()
}

#[tauri::command]
fn exit_application(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(PendingOpenFiles::default())
        .plugin(tauri_plugin_single_instance::init(|app, arguments, _| {
            queue_open_files(app, arguments);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file_atomic,
            export_svg_file,
            export_png_file,
            export_pdf_file,
            write_recovery_file,
            read_recovery_file,
            clear_recovery_file,
            take_pending_open_file,
            exit_application,
        ])
        .setup(|app| {
            queue_open_files(app.handle(), std::env::args().skip(1));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Joinery");

    app.run(|app_handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = event {
            queue_open_files(
                app_handle,
                urls.into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().to_string()),
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        atomic_write, export_pdf_file, export_png_file, export_svg_file, is_joinery_path,
        read_text_file, write_text_file_atomic,
    };
    use std::fs;

    const SAMPLE_SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#7654bf"/></svg>"##;

    #[test]
    fn atomic_write_creates_and_replaces_a_file() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("model.joinery");

        atomic_write(&path, b"first").expect("first write");
        assert_eq!(fs::read_to_string(&path).expect("first read"), "first");

        atomic_write(&path, b"second").expect("replacement write");
        assert_eq!(fs::read_to_string(&path).expect("second read"), "second");
    }

    #[test]
    fn atomic_write_creates_parent_directories() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("nested").join("model.joinery");

        atomic_write(&path, b"project").expect("nested write");
        assert_eq!(fs::read_to_string(path).expect("nested read"), "project");
    }

    #[test]
    fn document_commands_round_trip_utf8() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("model.joinery");
        let path_string = path.to_string_lossy().to_string();
        write_text_file_atomic(path_string.clone(), "Joinery ✓".to_string())
            .expect("write command");
        assert_eq!(
            read_text_file(path_string).expect("read command"),
            "Joinery ✓"
        );
        assert!(is_joinery_path("Example.JOINERY"));
    }

    #[test]
    fn export_commands_write_all_supported_formats() {
        let directory = tempfile::tempdir().expect("temp directory");
        let svg_path = directory.path().join("diagram.svg");
        let png_path = directory.path().join("diagram.png");
        let pdf_path = directory.path().join("diagram.pdf");

        export_svg_file(
            svg_path.to_string_lossy().to_string(),
            SAMPLE_SVG.to_string(),
        )
        .expect("SVG export command");
        export_png_file(
            png_path.to_string_lossy().to_string(),
            SAMPLE_SVG.to_string(),
            2.0,
        )
        .expect("PNG export command");
        export_pdf_file(
            pdf_path.to_string_lossy().to_string(),
            SAMPLE_SVG.to_string(),
            "a4-landscape".to_string(),
        )
        .expect("PDF export command");

        assert!(fs::read(svg_path).expect("SVG").starts_with(b"<svg"));
        assert!(fs::read(png_path).expect("PNG").starts_with(b"\x89PNG"));
        assert!(fs::read(pdf_path).expect("PDF").starts_with(b"%PDF-"));
    }
}

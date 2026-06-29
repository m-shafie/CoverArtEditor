mod search;

use base64::Engine as _;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::file::FileType;
use lofty::tag::{Accessor, Tag, TagType};
use lofty::picture::{Picture, PictureType, MimeType};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize)]
struct ReadMetadataResult {
    title: Option<String>,
    artist: Option<String>,
    cover_base64: Option<String>,
    cover_mime: Option<String>,
    filename: String,
}

#[derive(Deserialize)]
struct WriteMetadataArgs {
    file_path: String,
    title: Option<String>,
    artist: Option<String>,
    cover_url: Option<String>,
    cover_base64: Option<String>,
    cover_mime: Option<String>,
    new_filename: Option<String>,
    output_dir: Option<String>,
}

#[derive(Serialize)]
struct WriteMetadataResult {
    success: bool,
    new_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ImageData {
    data: String,
    mime: String,
}

#[tauri::command]
async fn pick_file(app: tauri::AppHandle, kind: String) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();
    match kind.as_str() {
        "audio" => {
            dialog = dialog.add_filter(
                "Audio",
                &["mp3", "m4a", "aac", "flac", "ogg", "wav", "aiff", "ape"],
            );
        }
        "image" => {
            dialog = dialog.add_filter("Image", &["jpg", "jpeg", "png", "webp", "bmp"]);
        }
        _ => {}
    }
    let file = dialog.blocking_pick_file();
    let path = if let Some(f) = file {
        f.as_path().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };
    Ok(path)
}

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app.dialog().file().blocking_pick_folder();
    let path = if let Some(f) = folder {
        f.as_path().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };
    Ok(path)
}

#[tauri::command]
async fn read_metadata(path: String) -> Result<ReadMetadataResult, String> {
    let file_path = Path::new(&path);
    let tagged_file =
        lofty::read_from_path(file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let tag = tagged_file.primary_tag();

    let title = tag.and_then(|t| t.title()).map(|s| s.to_string());
    let artist = tag.and_then(|t| t.artist()).map(|s| s.to_string());

    let (cover_base64, cover_mime) = tag
        .and_then(|t| t.pictures().first())
        .map(|pic| {
            let mime = pic.mime_type().map_or("image/jpeg", |m| m.as_str()).to_string();
            let data = base64::engine::general_purpose::STANDARD.encode(pic.data());
            (Some(data), Some(mime))
        })
        .unwrap_or((None, None));

    let filename = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(ReadMetadataResult {
        title,
        artist,
        cover_base64,
        cover_mime,
        filename,
    })
}

#[tauri::command]
async fn write_metadata(args: WriteMetadataArgs) -> Result<WriteMetadataResult, String> {
    let file_path = Path::new(&args.file_path);

    let mut target_path = file_path.to_path_buf();
    if let Some(dir) = args.output_dir.as_ref().filter(|d| !d.is_empty()) {
        // Save-to-folder mode: copy the original into the chosen folder and tag the copy.
        let out_dir = Path::new(dir);
        let out_name = args
            .new_filename
            .as_deref()
            .filter(|n| !n.is_empty())
            .map(|n| n.to_string())
            .or_else(|| {
                file_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
            })
            .ok_or_else(|| "Could not determine output filename".to_string())?;
        target_path = out_dir.join(out_name);
        if target_path == file_path {
            return Err("Output file would overwrite the original. Pick a different folder or filename.".to_string());
        }
        std::fs::copy(file_path, &target_path)
            .map_err(|e| format!("Failed to copy file to folder: {}", e))?;
    } else if let Some(new_name) = &args.new_filename {
        if !new_name.is_empty() {
            let parent = file_path.parent().unwrap_or(Path::new("."));
            target_path = parent.join(new_name);
            if target_path != file_path {
                std::fs::rename(file_path, &target_path)
                    .map_err(|e| format!("Failed to rename file: {}", e))?;
            }
        }
    }

    let mut tagged_file = lofty::read_from_path(&target_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    if tagged_file.primary_tag().is_none() && tagged_file.first_tag().is_none() {
        let tag_type = match tagged_file.file_type() {
            FileType::Mpeg => TagType::Id3v2,
            FileType::Mp4 => TagType::Mp4Ilst,
            FileType::Flac => TagType::VorbisComments,
            FileType::Vorbis | FileType::Opus => TagType::VorbisComments,
            FileType::Wav => TagType::Id3v2,
            FileType::Aiff => TagType::Id3v2,
            _ => TagType::Id3v2,
        };
        let new_tag = Tag::new(tag_type);
        tagged_file.insert_tag(new_tag);
    }

    let tag = if let Some(t) = tagged_file.primary_tag_mut() {
        t
    } else if let Some(t) = tagged_file.first_tag_mut() {
        t
    } else {
        return Err("No tag available".to_string());
    };

    if let Some(title_val) = &args.title {
        if !title_val.is_empty() {
            tag.set_title(title_val.clone());
        }
    }

    if let Some(artist_val) = &args.artist {
        if !artist_val.is_empty() {
            tag.set_artist(artist_val.clone());
        }
    }

    let cover_data = if let Some(url) = &args.cover_url {
        let (bytes, mime) = search::download_image(url).await?;
        Some((bytes, mime))
    } else if let (Some(b64), Some(mime)) = (&args.cover_base64, &args.cover_mime) {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| format!("Failed to decode cover image: {}", e))?;
        Some((bytes, mime.clone()))
    } else {
        None
    };

    if let Some((data, mime)) = cover_data {
        tag.remove_picture_type(PictureType::CoverFront);

        let picture = Picture::unchecked(data.into())
            .pic_type(PictureType::CoverFront)
            .mime_type(MimeType::from_str(&mime))
            .build();

        tag.push_picture(picture);
    }

    tagged_file
        .save_to_path(&target_path, WriteOptions::new())
        .map_err(|e| format!("Failed to write file: {}", e))?;

    let new_path = if target_path != file_path {
        Some(target_path.to_string_lossy().to_string())
    } else {
        None
    };

    Ok(WriteMetadataResult {
        success: true,
        new_path,
    })
}

#[tauri::command]
async fn read_image(path: String) -> Result<ImageData, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read image: {}", e))?;

    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    let mime = match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        "jpeg" | "jpg" => "image/jpeg",
        _ => "image/jpeg",
    };

    let data = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(ImageData {
        data,
        mime: mime.to_string(),
    })
}

#[tauri::command]
async fn search_art(query: String, offset: u32) -> Result<search::SearchResponse, String> {
    search::search_itunes(&query, offset).await
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pick_file,
            pick_folder,
            read_metadata,
            write_metadata,
            read_image,
            search_art,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

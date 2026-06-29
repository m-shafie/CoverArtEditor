use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct SearchResult {
    pub cover_url: Option<String>,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ITunesTrack {
    track_name: Option<String>,
    collection_name: Option<String>,
    artist_name: String,
    artwork_url_100: Option<String>,
    artwork_url_60: Option<String>,
}

#[derive(Deserialize)]
struct ITunesResponse {
    results: Vec<ITunesTrack>,
}

#[derive(Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub has_more: bool,
}

pub async fn search_itunes(query: &str, offset: u32) -> Result<SearchResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let resp = client
        .get("https://itunes.apple.com/search")
        .query(&[
            ("term", query),
            ("media", "music"),
            ("entity", "song"),
            ("limit", "24"),
            ("offset", &offset.to_string()),
        ])
        .header("User-Agent", "CoverArtEditor/1.0")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    if !status.is_success() {
        return Err(format!("iTunes API returned status {}: {}", status.as_u16(), text));
    }

    let data: ITunesResponse =
        serde_json::from_str(&text).map_err(|e| format!("Parse error: {}", e))?;

    let results: Vec<SearchResult> = data
        .results
        .iter()
        .map(|r| {
            let art = r.artwork_url_100.as_ref().or(r.artwork_url_60.as_ref());
            let hi = art.map(|a| {
                a.replace("100x100bb.jpg", "600x600bb.jpg")
                    .replace("100x100bb.png", "600x600bb.png")
                    .replace("60x60bb.jpg", "600x600bb.jpg")
                    .replace("60x60bb.png", "600x600bb.png")
            });
            let title = r
                .track_name
                .clone()
                .or_else(|| r.collection_name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            SearchResult {
                cover_url: hi,
                title,
                artist: r.artist_name.clone(),
                album: r.collection_name.clone(),
            }
        })
        .collect();

    Ok(SearchResponse {
        has_more: results.len() >= 24,
        results,
    })
}

pub async fn download_image(url: &str) -> Result<(Vec<u8>, String), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let resp = client
        .get(url)
        .header("User-Agent", "CoverArtEditor/1.0")
        .send()
        .await
        .map_err(|e| format!("Download error: {}", e))?;

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Read error: {}", e))?
        .to_vec();

    Ok((bytes, content_type))
}

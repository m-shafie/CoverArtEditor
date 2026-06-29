const invoke = window.__TAURI__.core.invoke;
const listen = window.__TAURI__.event.listen;
const appWindow = window.__TAURI__.window.getCurrentWindow();

const $ = id => document.getElementById(id);

const emptyState = $('empty-state');
const fileSection = $('file-section');
const fileNameEl = $('file-name');
const titleInput = $('title-input');
const artistInput = $('artist-input');
const currentThumb = $('current-thumb');
const searchInput = $('search-input');
const searchBtn = $('search-btn');
const resultsEl = $('results');
const resultsEmpty = $('results-empty');
const showMoreWrap = $('show-more-wrap');
const showMoreBtn = $('show-more-btn');
const curPreview = $('cur-preview');
const selPreview = $('sel-preview');
const curInfo = $('cur-info');
const selInfo = $('sel-info');
const applyBtn = $('apply-btn');
const importBtn = $('import-btn');
const renameInput = $('rename-input');
const extLabel = $('ext-label');
const renameFillBtn = $('rename-fill-btn');
const browseBtn = $('browse-btn');
const changeBtn = $('change-btn');
const dropOverlay = $('drop-overlay');
const modeInplaceBtn = $('mode-inplace');
const modeFolderBtn = $('mode-folder');
const folderRow = $('folder-row');
const folderPathEl = $('folder-path');
const folderBtn = $('folder-btn');
const selMetaTitle = $('sel-meta-title');
const selMetaArtist = $('sel-meta-artist');

const AUDIO_EXTS = ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'wav', 'aiff', 'aif', 'ape'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];

let currentFilePath = null;
let currentExt = '';
let selectedCoverUrl = null;
let selectedCoverBase64 = null;
let selectedCoverMime = null;
let selectedDisplayUri = null;
let lastSelectedMeta = null;
let currentSearchOffset = 0;
let hasMoreResults = false;
let currentSearchQuery = '';
let saveMode = 'inplace';
let outputDir = localStorage.getItem('outputDir') || null;

/* ---------- Helpers ---------- */

const TOAST_ICONS = {
  success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.5" fill="currentColor"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.5" fill="currentColor"/></svg>'
};

function showToast(msg, type) {
  type = type || 'info';
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = TOAST_ICONS[type];
  const span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  $('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 200); }, 3500);
}

function basename(path) {
  return path.includes('\\') ? path.split('\\').pop() : path.split('/').pop();
}

function extOf(path) {
  const name = basename(path);
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '').trim();
}

function stemOf(path) {
  return basename(path).replace(/\.[^.]+$/, '');
}

function setFilenameFields(path) {
  currentExt = extOf(path);
  extLabel.textContent = currentExt ? '.' + currentExt : '';
  renameInput.value = stemOf(path);
}

/* ---------- Theme ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}
applyTheme(localStorage.getItem('theme') || 'dark');

$('theme-btn').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ---------- Window controls ---------- */

$('min-btn').addEventListener('click', () => appWindow.minimize());
$('close-btn').addEventListener('click', () => appWindow.close());

/* ---------- Covers ---------- */

function showCurrentCover(uri) {
  curPreview.innerHTML = '';
  currentThumb.innerHTML = '';
  if (!uri) {
    curPreview.innerHTML = '<div class="empty">No image</div>';
    currentThumb.innerHTML = '<svg class="placeholder" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    curInfo.textContent = '—';
    return;
  }
  const img = document.createElement('img');
  img.alt = 'Current cover art';
  img.onload = () => { curInfo.textContent = img.naturalWidth + '×' + img.naturalHeight; };
  img.src = uri;
  curPreview.appendChild(img);
  const ti = document.createElement('img');
  ti.alt = '';
  ti.src = uri;
  currentThumb.appendChild(ti);
}

function showSelectedCover(uri) {
  selPreview.innerHTML = '';
  if (!uri) {
    selPreview.innerHTML = '<div class="empty">Pick a result</div>';
    selInfo.textContent = '—';
    return;
  }
  const img = document.createElement('img');
  img.alt = 'New cover art';
  img.onload = () => { selInfo.textContent = img.naturalWidth + '×' + img.naturalHeight; };
  img.onerror = () => {
    selPreview.innerHTML = '<div class="empty">Failed to load</div>';
    selInfo.textContent = '—';
  };
  img.src = uri;
  selPreview.appendChild(img);
}

function renderSelMeta() {
  const meta = lastSelectedMeta || {};
  selMetaTitle.textContent = meta.title || '—';
  selMetaTitle.title = meta.title ? 'Use this title: ' + meta.title : 'Use this title';
  selMetaTitle.disabled = !meta.title;
  selMetaArtist.textContent = meta.artist || '—';
  selMetaArtist.title = meta.artist ? 'Use this artist: ' + meta.artist : 'Use this artist';
  selMetaArtist.disabled = !meta.artist;
}

function clearSelection() {
  selectedCoverUrl = null;
  selectedCoverBase64 = null;
  selectedCoverMime = null;
  selectedDisplayUri = null;
  lastSelectedMeta = null;
  renderSelMeta();
  showSelectedCover(null);
  document.querySelectorAll('.result-item.selected').forEach(el => el.classList.remove('selected'));
}

/* ---------- File loading ---------- */

async function handleFilePath(path) {
  const ext = extOf(path);
  if (IMAGE_EXTS.includes(ext)) {
    if (!currentFilePath) {
      showToast('Load a music file first, then drop an image to use it as the cover.', 'info');
      return;
    }
    try {
      const result = await invoke('read_image', { path });
      selectedCoverBase64 = result.data;
      selectedCoverMime = result.mime;
      selectedCoverUrl = null;
      selectedDisplayUri = 'data:' + result.mime + ';base64,' + result.data;
      showSelectedCover(selectedDisplayUri);
      showToast('Image set as new cover.', 'success');
    } catch (err) {
      showToast('Failed to read image: ' + err, 'error');
    }
    return;
  }
  if (!AUDIO_EXTS.includes(ext)) {
    showToast('Unsupported file type: .' + ext, 'error');
    return;
  }

  currentFilePath = path;
  emptyState.hidden = true;
  fileSection.hidden = false;
  fileNameEl.textContent = basename(path);
  fileNameEl.title = path;
  titleInput.value = '';
  artistInput.value = '';
  clearSelection();

  try {
    const result = await invoke('read_metadata', { path });
    titleInput.value = result.title || '';
    artistInput.value = result.artist || '';
    if (result.cover_base64 && result.cover_mime) {
      showCurrentCover('data:' + result.cover_mime + ';base64,' + result.cover_base64);
    } else {
      showCurrentCover(null);
    }
    applyBtn.disabled = false;
    setFilenameFields(path);

    let q = ((result.artist || '') + ' ' + (result.title || '')).trim();
    if (!q) {
      q = basename(path).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    }
    if (q) {
      searchInput.value = q;
      doSearch();
    }
  } catch (err) {
    showCurrentCover(null);
    showToast('Failed to read metadata: ' + err, 'error');
  }
}

async function openFile() {
  try {
    const path = await invoke('pick_file', { kind: 'audio' });
    if (path) handleFilePath(path);
  } catch (err) {
    showToast('Failed to open file: ' + err, 'error');
  }
}

async function importImage() {
  try {
    const path = await invoke('pick_file', { kind: 'image' });
    if (!path) return;
    const result = await invoke('read_image', { path });
    selectedCoverBase64 = result.data;
    selectedCoverMime = result.mime;
    selectedCoverUrl = null;
    selectedDisplayUri = 'data:' + result.mime + ';base64,' + result.data;
    showSelectedCover(selectedDisplayUri);
  } catch (err) {
    showToast('Failed to import image: ' + err, 'error');
  }
}

/* ---------- Drag & drop (Tauri native events) ---------- */

listen('tauri://drag-enter', () => dropOverlay.classList.add('visible'));
listen('tauri://drag-leave', () => dropOverlay.classList.remove('visible'));
listen('tauri://drag-drop', event => {
  dropOverlay.classList.remove('visible');
  const path = event.payload && event.payload.paths && event.payload.paths[0];
  if (path) handleFilePath(path);
});

/* ---------- Search ---------- */

function showSkeletons(n) {
  resultsEl.innerHTML = '';
  resultsEmpty.hidden = true;
  showMoreWrap.hidden = true;
  for (let i = 0; i < n; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    sk.innerHTML = '<div class="sk-img sk-shimmer"></div><div class="sk-line sk-shimmer"></div><div class="sk-line short sk-shimmer"></div>';
    resultsEl.appendChild(sk);
  }
}

function setEmptyMessage(msg) {
  resultsEmpty.hidden = false;
  resultsEmpty.querySelector('span').textContent = msg;
}

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return showToast('Enter a search term first.', 'info');
  currentSearchQuery = q;
  currentSearchOffset = 0;
  showSkeletons(12);
  try {
    const res = await invoke('search_art', { query: q, offset: 0 });
    if (currentSearchQuery !== q) return;
    hasMoreResults = res.has_more;
    resultsEl.innerHTML = '';
    appendResults(res.results || []);
    showMoreWrap.hidden = !hasMoreResults;
    if (!resultsEl.children.length) setEmptyMessage('No results found for “' + q + '”.');
  } catch (err) {
    resultsEl.innerHTML = '';
    setEmptyMessage('Search failed.');
    showToast('Search failed: ' + err, 'error');
  }
}

async function loadMoreResults() {
  if (!hasMoreResults || !currentSearchQuery) return;
  currentSearchOffset += 24;
  showMoreBtn.textContent = 'Loading...';
  showMoreBtn.disabled = true;
  try {
    const res = await invoke('search_art', { query: currentSearchQuery, offset: currentSearchOffset });
    hasMoreResults = res.has_more;
    appendResults(res.results || []);
    showMoreWrap.hidden = !hasMoreResults;
  } catch (err) {
    showToast('Failed to load more results.', 'error');
  }
  showMoreBtn.textContent = 'Show more results';
  showMoreBtn.disabled = false;
}

function appendResults(items) {
  if (!items.length) return;
  resultsEmpty.hidden = true;
  items.forEach((it, i) => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.style.animationDelay = Math.min(i * 25, 400) + 'ms';
    div.tabIndex = 0;
    div.setAttribute('role', 'button');

    if (it.cover_url) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = (it.title || 'Cover') + ' artwork';
      img.src = it.cover_url;
      img.onerror = () => { img.replaceWith(makeNoArt()); };
      div.appendChild(img);
    } else {
      div.appendChild(makeNoArt());
    }

    const lbl = document.createElement('div');
    lbl.className = 'label';
    lbl.textContent = it.title || 'Unknown';
    lbl.title = it.title || '';
    div.appendChild(lbl);

    const sub = document.createElement('div');
    sub.className = 'sublabel';
    sub.textContent = it.artist + (it.album && it.album !== it.title ? ' · ' + it.album : '');
    sub.title = sub.textContent;
    div.appendChild(sub);

    const select = () => selectResult(it, div);
    div.addEventListener('click', select);
    div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });

    resultsEl.appendChild(div);
  });
}

function makeNoArt() {
  const d = document.createElement('div');
  d.className = 'no-art';
  d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  return d;
}

function selectResult(it, div) {
  document.querySelectorAll('.result-item.selected').forEach(el => el.classList.remove('selected'));
  div.classList.add('selected');
  lastSelectedMeta = { title: it.title || '', artist: it.artist || '' };
  renderSelMeta();

  if (it.cover_url) {
    selectedCoverUrl = it.cover_url;
    selectedCoverBase64 = null;
    selectedCoverMime = null;
    selectedDisplayUri = it.cover_url;
    showSelectedCover(it.cover_url);
  } else {
    showToast('No cover art available for this result.', 'info');
  }
}

/* ---------- Save mode ---------- */

function setSaveMode(mode) {
  saveMode = mode;
  modeInplaceBtn.classList.toggle('active', mode === 'inplace');
  modeFolderBtn.classList.toggle('active', mode === 'folder');
  modeInplaceBtn.setAttribute('aria-selected', mode === 'inplace');
  modeFolderBtn.setAttribute('aria-selected', mode === 'folder');
  folderRow.hidden = mode !== 'folder';
}

function renderFolderPath() {
  if (outputDir) {
    folderPathEl.textContent = outputDir;
    folderPathEl.title = outputDir;
    folderPathEl.classList.remove('unset');
  } else {
    folderPathEl.textContent = 'No folder selected';
    folderPathEl.title = '';
    folderPathEl.classList.add('unset');
  }
}

async function chooseFolder() {
  try {
    const dir = await invoke('pick_folder');
    if (dir) {
      outputDir = dir;
      localStorage.setItem('outputDir', dir);
      renderFolderPath();
    }
    return dir;
  } catch (err) {
    showToast('Failed to pick folder: ' + err, 'error');
    return null;
  }
}

/* ---------- Filename ---------- */

function fillGeneratedName() {
  if (!currentFilePath) return;
  const title = titleInput.value.trim();
  const artist = artistInput.value.trim();
  let stem;
  if (title && artist) stem = artist + ' - ' + title;
  else stem = title || artist || stemOf(currentFilePath);
  renameInput.value = sanitizeFilename(stem);
}

/* ---------- Apply ---------- */

async function applyChanges() {
  if (!currentFilePath) return showToast('No file loaded.', 'info');

  if (saveMode === 'folder' && !outputDir) {
    const dir = await chooseFolder();
    if (!dir) return showToast('Pick an output folder to save the copy into.', 'info');
  }

  applyBtn.disabled = true;
  applyBtn.classList.remove('success');
  applyBtn.classList.add('loading');
  const originalBtnHtml = applyBtn.innerHTML;
  applyBtn.innerHTML = '<span class="spinner"></span> Saving...';

  const args = {
    file_path: currentFilePath,
    title: titleInput.value.trim(),
    artist: artistInput.value.trim()
  };

  const stem = sanitizeFilename(renameInput.value.trim());
  if (stem) args.new_filename = stem + (currentExt ? '.' + currentExt : '');
  if (saveMode === 'folder') args.output_dir = outputDir;

  if (selectedCoverUrl) {
    args.cover_url = selectedCoverUrl;
  } else if (selectedCoverBase64 && selectedCoverMime) {
    args.cover_base64 = selectedCoverBase64;
    args.cover_mime = selectedCoverMime;
  }

  try {
    const result = await invoke('write_metadata', { args });
    if (!result.success) throw new Error('Unknown error');

    if (saveMode === 'inplace') {
      if (result.new_path) {
        currentFilePath = result.new_path;
        fileNameEl.textContent = basename(result.new_path);
        fileNameEl.title = result.new_path;
        setFilenameFields(result.new_path);
      }
      showToast('Changes saved to file.', 'success');
    } else {
      showToast('Copy saved to ' + (result.new_path || outputDir), 'success');
    }
    if (selectedDisplayUri) showCurrentCover(selectedDisplayUri);

    clearSelection();
    applyBtn.classList.add('success');
    setTimeout(() => applyBtn.classList.remove('success'), 1800);
  } catch (err) {
    showToast('Failed to save: ' + err, 'error');
  }
  applyBtn.innerHTML = originalBtnHtml;
  applyBtn.classList.remove('loading');
  applyBtn.disabled = !currentFilePath;
}

/* ---------- Wiring ---------- */

emptyState.addEventListener('click', openFile);
emptyState.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFile(); } });
browseBtn.addEventListener('click', e => { e.stopPropagation(); openFile(); });
changeBtn.addEventListener('click', openFile);
importBtn.addEventListener('click', importImage);

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
showMoreBtn.addEventListener('click', loadMoreResults);

renameFillBtn.addEventListener('click', fillGeneratedName);

modeInplaceBtn.addEventListener('click', () => setSaveMode('inplace'));
modeFolderBtn.addEventListener('click', () => setSaveMode('folder'));
folderBtn.addEventListener('click', chooseFolder);

selMetaTitle.addEventListener('click', () => {
  if (lastSelectedMeta && lastSelectedMeta.title) titleInput.value = lastSelectedMeta.title;
});
selMetaArtist.addEventListener('click', () => {
  if (lastSelectedMeta && lastSelectedMeta.artist) artistInput.value = lastSelectedMeta.artist;
});

applyBtn.addEventListener('click', applyChanges);

renderFolderPath();
setSaveMode('inplace');

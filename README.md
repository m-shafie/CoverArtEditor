# CoverArtEditor

A desktop tool for editing music file cover art. Supports both a standalone browser version and an Electron desktop app.

## Features

- **Drag & Drop** — Load MP3 files and instantly view metadata
- **ID3 Tag Editing** — Read/write ID3v2 (2.2, 2.3, 2.4) and ID3v1 tags including cover art (APIC/PIC frames)
- **iTunes Album Art Search** — Search Apple's iTunes API for cover art with pagination
- **Side-by-Side Preview** — Compare current vs. selected cover art
- **In-Place Metadata Editing** — Edit title and artist via double-click
- **Custom Image Import** — Import local image files as cover art

## Tech Stack

| Layer | Technology |
|---|---|
| Standalone | HTML, Vanilla JS, File System Access API |
| Desktop | Electron 28, Node.js (node-id3) |
| APIs | Apple iTunes Search API |
| Packaging | electron-builder (NSIS) |

## Usage

### Browser
Open `CoverArtEditor.html` in a Chromium-based browser.

### Desktop
```bash
cd exe-with-electron
npm install
npm start
```

### Build Installer
```bash
npm run build
```

---

## فارسی

ویرایشگر کاور آهنگ‌های MP3 — جستجو و دانلود کاور از iTunes + ویرایش برچسب‌های ID3

### قابلیت‌ها
- **کشیدن و رها کردن** — فایل MP3 را بکشید و متادیتا را ببینید
- **ویرایش برچسب ID3** — خواندن و نوشتن ID3v2 و ID3v1 شامل کاور (APIC/PIC)
- **جستجوی کاور** — جستجوی کاور آلبوم از API اپل iTunes
- **پیش‌نمایش** — مقایسه کاور فعلی و جدید کنار هم
- **نسخه تحت وب و دسکتاپ** — هم در مرورگر و هم به عنوان برنامه Electron

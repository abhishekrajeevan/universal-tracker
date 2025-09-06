# Universal To‑Do/Done Tracker (Chrome MV3)

One‑click save of the current page (with a clean title) into a user‑owned tracker. 
Local cache in the extension, with optional sync to **Google Sheets** via **Apps Script Web App**.

## Features
- Extracts a meaningful title (Open Graph, Twitter meta, JSON‑LD, H1, fallback to `<title>`).
- Status: **To Do** / **Done**.
- Category: Movie, TV, Trailer, Video, Blog, Podcast, Book, Course, Game, Other.
- Tags, Notes, timestamps, source domain.
- Local list in popup; Export/Import JSON.
- Options page to set **Apps Script URL**; manual Sync button; auto‑sync every N minutes.

## Install (Developer mode)
1. Download and unzip this folder.
2. Open `chrome://extensions` → toggle **Developer mode** (top right).
3. Click **Load unpacked** → select the unzipped folder.
4. Pin the extension (puzzle icon → pin).

## Set up Google Sheets backend (optional but recommended)
1. Create a new Google Sheet (empty is fine).
2. Open **Extensions → Apps Script**.
3. Replace the default code with `Code.gs` from `apps_script/Code.gs` in this repo.
4. Click **Deploy → New deployment**:
   - Type: **Web app**
   - **Execute as**: *Me*
   - **Who has access**: *Anyone with the link* (or org‑restricted if desired)
5. Copy the **Web App URL**.
6. In Chrome, open the extension’s **Options** page and paste that URL (without trailing slash).
7. In the popup, click **Sync** (or wait for autosync).

> The sheet will auto‑create a tab named **Items** with headers:
> `id,title,url,status,category,tags,notes,source,added_at,updated_at,completed_at`

## Data model
```json
{
  "id": "uuid",
  "title": "string",
  "url": "string",
  "status": "todo | done",
  "category": "Movie|TV|Trailer|Video|Blog|Podcast|Book|Course|Game|Other",
  "tags": ["string"],
  "notes": "string",
  "source": "hostname",
  "added_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "completed_at": "ISO timestamp or null"
}
```

## Notes
- This scaffold stores canonical items locally and queues upserts to Sheets.
- You can add other adapters (GitHub Gist, Notion) by following the `adapters.js` pattern.
- Some pages (Chrome Web Store, internal pages) block content scripts; the popup falls back to `tab.title` in those cases.

## Keyboard shortcut (optional)
You can add a **"commands"** section in `manifest.json` to support a shortcut, e.g. Ctrl+Shift+S to open the popup.

Enjoy!

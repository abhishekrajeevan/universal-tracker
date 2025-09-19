# Universal Tracker â€” Chrome Extension

> Track what you want to watch, read, or revisit across the web. Save pages with one click, organize with categories/tags/priority, and optionally sync to your own Google Sheet.

## Features

### Core

- Oneâ€‘click save from any page with clean title detection
- Smart categorization: Movie, TV, Video, Blog, Podcast, Book, Course, Game, Other
- Status tracking: To Do / Done with timestamps (added/updated/completed)
- Rich metadata: notes, tags, source domain, optional reminder time
- Localâ€‘first storage with optional Google Sheets sync

### Advanced

- Robust title extraction (Open Graph, Twitter, JSONâ€‘LD, H1) with URL cleanup
- SPA aware (works on dynamically changing pages, uses history listeners)
- Batch sync (up to 100 items per batch) with outbox queue
- Import/Export JSON for full portability
- Archiving and stats via Apps Script backend

### UI/UX

- Compact mode toggle for both Popup and Dashboard (persisted)
- Priority filter and sorting (priority/created/updated)
- Reset button on Dashboard to clear all filters/search/tags quickly
- Inâ€‘button sync progress and nonâ€‘blocking toasts for success/error
- Stats modal in Popup (replaces alert)
- Fix for Google Search pages that previously produced the title â€œAccessibility linksâ€

## Install (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable Developer mode.
4. Click â€œLoad unpackedâ€ and select the project folder.
5. Pin the extension for quick access.

## Setup (Optional Google Sheets Sync)

The extension works locally out of the box. To sync with Google Sheets:

1. Create a Google Sheet (e.g., â€œUniversal Trackerâ€).
2. Open Extensions â†’ Apps Script and replace the default code with `apps_script/Code.gs`.
3. Deploy as Web App:
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone (or your preferred access)
   - Deploy and copy the Web App URL.
4. Open the extensionâ€™s Options page and paste the URL, set autoâ€‘sync interval, and save.
5. Use â€œTest Connectionâ€ in Options to verify connectivity.

See `SETUP_GUIDE.md` and `GOOGLE_SHEETS_SETUP.md` for detailed steps and troubleshooting.

## Usage

### Save items from the Popup

- The extension autoâ€‘detects title/category; you can adjust category, priority, tags, notes, and optionally set a reminder.
- Save creates a To Do item by default; you can mark items Done later from the list.
- The Popup toolbar offers Sync, Export, Import, Archive, and View Stats.

### Manage items in the Dashboard

- Open `dashboard.html` from the toolbar: filter by search/status/category/priority/tags, and sort by priority/created/updated.
- Use the Reset button to clear all filters instantly.
- Toggle Compact mode for a denser layout.

## Recent Additions

- Compact mode toggle (Popup + Dashboard), persisted in `chrome.storage.local`.
- Priority filter and sorting on Dashboard.
- Reset button to clear all filters on Dashboard.
- Nonâ€‘blocking toast notifications for Sync/Import/Export/Stats.
- Stats displayed in a modal in Popup.
- Improved Sync feedback with spinner and button state.
- Title fix for Google Search result pages (â€œAccessibility linksâ€ is ignored).

## Permissions

From `manifest.json`:

- `storage`, `tabs`, `scripting`, `alarms`, `downloads`, `notifications`
- `host_permissions`: `<all_urls>` (required to read page metadata for save)

These are used for local storage, metadata extraction, reminders (alarms/notifications), exporting, and optional background sync.

## Project Structure

- `content.js` â€” Extract page metadata (title/url/category), SPAâ€‘aware
- `popup.html` / `popup.js` â€” Capture UI and recent items list
- `dashboard.html` / `dashboard.js` â€” All Items page with filters/sort
- `options.html` / `options.js` â€” Configuration for Apps Script URL and autosync
- `background.js` â€” Outbox queue, sync/alarms/notifications, stats
- `shared/` â€” `schema.js`, `utils.js` (toasts, prefs, ids, title cleaning), `adapters.js`
- `apps_script/Code.gs` â€” Google Apps Script web app (bulk upsert/delete, archive, stats)

## Configuration

### Extension

- Autoâ€‘sync interval (minutes)
- Apps Script Web App URL

### Apps Script

Edit `Code.gs` constants as needed:

```javascript
const CONFIG = {
  ACTIVE_SHEET: 'Items_Active',
  ARCHIVE_SHEET_PREFIX: 'Items_Archive_',
  MAX_ACTIVE_ROWS: 10000,
  ARCHIVE_MONTHS: 6,
  BATCH_SIZE: 100
};
```

## Troubleshooting

- Connection test fails: ensure your Web App is deployed as â€œAnyoneâ€ and the URL ends with `/exec`.
- No data appears: click Sync, then check Chrome DevTools Console for errors.
- Timeouts/large data: reduce autoâ€‘sync frequency or use Archive to keep the active sheet lean.

## Privacy

- Localâ€‘first by default; Google Sheets sync is optional and userâ€‘controlled.
- No tracking or analytics; your data lives in your browser and your spreadsheet.

## Development

- Manifest V3 extension; no build step. Edit files and reload the unpacked extension.
- Keep changes minimal and focused; avoid breaking existing behaviors.

## License

Open source. See the repository for license details.

## Contributing

Pull requests are welcome. Please:

- Keep changes minimal and focused.
- Preserve existing UX patterns and reliability.
- Include documentation updates for userâ€‘visible changes.

---

Need help? See the setup guides or open an issue.



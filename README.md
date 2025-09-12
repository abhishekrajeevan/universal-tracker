# Universal Tracker - Chrome Extension

A powerful Chrome extension for tracking content across the web with intelligent categorization, local storage, and seamless Google Sheets synchronization.

 
## 🚀 Features

### Core Functionality
 

- **One-click content saving** - Save any webpage with intelligent title extraction
 
- **Smart categorization** - Automatically detects content type (Movie, TV, Video, Blog, Podcast, Book, Course, Game, etc.)
- **Status tracking** - Mark items as "To Do" or "Done" with visual indicators
 
- **Rich metadata** - Store tags, notes, source domain, and timestamps
- **Local-first storage** - All data stored locally in Chrome with optional cloud sync
 

### Advanced Features
 
- **Intelligent title extraction** - Uses Open Graph, Twitter meta, JSON-LD, and H1 tags for clean titles
- **URL cleanup** - Removes tracking parameters while preserving important content identifiers
 
- **SPA-aware** - Works with single-page applications and dynamic content
- **Batch processing** - Efficient syncing with up to 100 items per batch
 
- **Automatic archiving** - Keeps active sheet fast by archiving old items
- **Export/Import** - Full data portability with JSON export/import
 
- **Connection testing** - Built-in diagnostics for Google Sheets setup

 
### Google Sheets Integration
- **Real-time sync** - Automatic background synchronization every 10 minutes (configurable)
 
- **Enhanced storage** - Handles large datasets with intelligent archiving
- **Multiple sheets** - Active items + monthly archive sheets
 
- **Performance optimized** - Batch processing and chunked reading for large datasets
- **Statistics tracking** - Monitor active vs archived items
 

## 📦 Installation
 

### Developer Mode Installation
 
1. Download and extract this repository
2. Open Chrome and navigate to `chrome://extensions`
 
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the extracted folder
 
5. Pin the extension to your toolbar for easy access

 
## ⚙️ Setup

 
### Basic Usage (Local Storage Only)

 
The extension works immediately after installation with local storage. No additional setup required.

 
### Google Sheets Integration (Recommended)

For cloud sync and backup, set up Google Sheets integration:
 

1. **Create Google Spreadsheet**
 
   - Go to [Google Sheets](https://sheets.google.com)
   - Create a new blank spreadsheet
 
   - Name it "Universal Tracker"

 
2. **Set Up Apps Script**
   - In your spreadsheet: **Extensions** → **Apps Script**
 
   - Delete default code and paste contents of `apps_script/Code.gs`
   - Save the project (Ctrl+S)
 

3. **Deploy as Web App**
 
   - Click **Deploy** → **New deployment**
   - Choose **Web app** as type
 
   - Set **Execute as**: Me
   - Set **Who has access**: Anyone
 
   - Click **Deploy** and **copy the Web App URL**

 
4. **Configure Extension**
   - Open extension popup → Click gear icon (⚙️)
 
   - Paste your Web App URL
   - Set sync interval (default: 10 minutes)
 
   - Click **Save Settings**

 
5. **Test Connection**
   - Click **🔗 Test Connection** to verify setup
 
   - You should see success message with item counts

 
> 📖 **Detailed Setup Guide**: See `SETUP_GUIDE.md` for comprehensive instructions with troubleshooting

 
## 🎯 How to Use

 
### Saving Content
1. Navigate to any webpage you want to track
 
2. Click the Universal Tracker extension icon
3. Review the auto-detected title and category
 
4. Add tags, notes, or modify details as needed
5. Click **Save as To Do** or **Mark as Done**

### Managing Items
- **View all items** in the popup with status indicators
- **Toggle status** between To Do/Done with one click
- **Delete items** you no longer need
- **Open original URLs** directly from the popup
- **Export data** as JSON for backup
- **Import data** from previous exports

### Google Sheets Features
- **Manual sync** - Click 🔄 Sync button anytime
- **Auto-sync** - Runs automatically every 10 minutes (configurable)
- **Archive management** - Click 📦 Archive to move old items
- **Statistics** - View 📊 Stats for storage overview

## 📊 Data Structure

Each tracked item contains:
```json
{
  "id": "unique-uuid",
  "title": "Clean extracted title",
  "url": "Original URL (blank for Movies/TV)",
  "status": "todo | done",
  "category": "Movie|TV|Trailer|Video|Blog|Podcast|Book|Course|Game|Other",
  "tags": ["array", "of", "tags"],
  "notes": "User notes",
  "source": "website hostname",
  "added_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "completed_at": "ISO timestamp or null"
}
```

## 🏗️ Architecture

### Extension Components
- **`manifest.json`** - Chrome extension configuration
- **`background.js`** - Service worker for sync and background tasks
- **`content.js`** - Page metadata extraction and SPA detection
- **`popup.js`** - Main UI and user interactions
- **`options.js`** - Settings and Google Sheets configuration

### Shared Modules
- **`shared/adapters.js`** - Local storage and queue adapters
- **`shared/schema.js`** - Data model and item creation
- **`shared/utils.js`** - Common utilities (UUID, title cleaning, etc.)

### Google Apps Script
- **`apps_script/Code.gs`** - Server-side API for Google Sheets integration
- Handles bulk operations, archiving, and statistics
- Optimized for large datasets with batch processing

## 🔧 Configuration

### Extension Settings
- **Auto-sync interval** - How often to sync with Google Sheets (5-60 minutes)
- **Apps Script URL** - Your Google Apps Script web app endpoint

### Google Sheets Settings
The Apps Script can be configured by modifying constants in `Code.gs`:
```javascript
const CONFIG = {
  ACTIVE_SHEET: 'Items_Active',
  ARCHIVE_SHEET_PREFIX: 'Items_Archive_',
  MAX_ACTIVE_ROWS: 10000,
  ARCHIVE_MONTHS: 6,
  BATCH_SIZE: 100
};
```

## 🛠️ Troubleshooting

### Common Issues

**Connection Test Fails**
- Verify Apps Script URL is correct (ends with `/exec`)
- Ensure Apps Script is deployed with "Anyone" access
- Check internet connection

**No Data in Google Sheets**
- Click **🔄 Sync** in extension popup
- Check browser console (F12) for error messages
- Verify Apps Script deployment settings

**Performance Issues**
- Use **📦 Archive** button to move old items
- Reduce auto-sync frequency if you have many items
- Check statistics to monitor active vs archived counts

### Getting Help
1. Check browser console (F12 → Console) for error messages
2. Use the **🔗 Test Connection** button in options
3. Review the detailed setup guides in `SETUP_GUIDE.md` and `GOOGLE_SHEETS_SETUP.md`
4. Check Apps Script execution log in Google Apps Script editor

## 🔒 Privacy & Security

- **Local-first** - All data stored locally in Chrome
- **Optional sync** - Google Sheets integration is completely optional
- **No tracking** - Extension doesn't collect or send personal data
- **User-owned** - You control your Google Sheets and data
- **Secure** - Uses HTTPS for all Google Sheets communication

## 🚀 Advanced Features

### Smart Content Detection
- **JSON-LD parsing** - Extracts structured data from websites
- **Category inference** - Automatically detects content type
- **Title cleaning** - Removes site names and separators for clean titles
- **URL optimization** - Preserves important parameters while removing trackers

### Performance Optimizations
- **Batch processing** - Handles up to 100 items per sync
- **Chunked reading** - Processes large sheets in 1000-row chunks
- **Intelligent archiving** - Automatically moves old items to archive sheets
- **Memory efficient** - Optimized for large datasets

### Data Management
- **Automatic archiving** - Items older than 6 months moved to archive sheets
- **Multiple archive sheets** - Organized by month (e.g., `Items_Archive_2024_01`)
- **Statistics tracking** - Monitor active vs archived item counts
- **Export/Import** - Full data portability with JSON format

## 📈 Scaling

### For Heavy Users (1000+ items)
- Set auto-sync to 15-30 minutes
- Use manual archiving monthly
- Monitor statistics regularly
- Consider reducing batch size if experiencing timeouts

### For Light Users (< 100 items)
- Default settings work perfectly
- Auto-sync every 10 minutes is sufficient
- Archiving happens automatically
- No performance concerns

## 🔄 Migration & Updates

### From Previous Versions
- Existing data automatically migrates
- Old "Items" sheet renamed to "Items_Active"
- Archive sheets created as needed
- No data loss during migration

### Data Export/Import
- Export: Click **📤 Export** in popup
- Import: Click **📥 Import** and select JSON file
- Full data portability between installations

## 📄 License

This project is open source. See the repository for license details.

## 🤝 Contributing

Contributions welcome! Please read the codebase and follow existing patterns for:
- Error handling and user feedback
- Consistent UI/UX patterns
- Performance optimizations
- Documentation updates

---

**Need help?** The extension includes comprehensive built-in help, connection testing, and detailed setup guides to get you started quickly.

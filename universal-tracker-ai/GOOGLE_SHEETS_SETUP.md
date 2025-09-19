# Enhanced Google Sheets Setup Guide

This guide will help you set up the enhanced Google Sheets storage system for your Universal Tracker.

## 🚀 Quick Setup

### 1. Create a New Google Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it "Universal Tracker" (or any name you prefer)

### 2. Set Up Google Apps Script
1. In your spreadsheet, go to **Extensions** → **Apps Script**
2. Delete the default code and paste the contents of `apps_script/Code.gs`
3. Save the project (Ctrl+S) and give it a name like "Universal Tracker API"

### 3. Deploy as Web App
1. Click **Deploy** → **New deployment**
2. Choose **Web app** as the type
3. Set the following:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. **Copy the Web App URL** (you'll need this for the extension)

### 4. Configure the Extension
1. Open the Universal Tracker extension popup
2. Click the gear icon (⚙️) to open options
3. Paste your Web App URL in the "Apps Script Base URL" field
4. Set your preferred auto-sync interval (default: 10 minutes)
5. Click **Save Settings**

## ✨ Enhanced Features

### 📦 Automatic Archiving
- Items older than 6 months are automatically moved to archive sheets
- Keeps your active sheet fast and responsive
- Archive sheets are organized by month (e.g., "Items_Archive_2024_01")

### 🚀 Improved Performance
- **Batch processing**: Handles up to 100 items per sync
- **Chunked reading**: Processes large sheets in 1000-row chunks
- **Optimized updates**: Separates inserts from updates for better performance

### 📊 Storage Management
- **Statistics tracking**: Monitor active vs archived items
- **Manual archiving**: Trigger archiving on demand
- **Connection testing**: Verify your setup is working

### 🎨 Better Organization
- **Formatted sheets**: Headers with colors and proper column widths
- **Frozen headers**: Always see column names
- **Multiple sheets**: Active data + monthly archives

## 📋 Sheet Structure

### Active Sheet: `Items_Active`
Contains your recent items (last 6 months or 10,000 items max)

### Archive Sheets: `Items_Archive_YYYY_MM`
Contains older items organized by month

### Columns:
- `id` - Unique identifier
- `title` - Item title
- `url` - Item URL (blank for Movies/TV)
- `status` - "todo" or "done"
- `category` - Item category
- `tags` - Comma-separated tags
- `notes` - User notes
- `source` - Website source
- `added_at` - When item was added
- `updated_at` - Last modification
- `completed_at` - When marked as done

## 🔧 Configuration Options

You can modify these settings in the Apps Script code:

```javascript
const CONFIG = {
  ACTIVE_SHEET: 'Items_Active',
  ARCHIVE_SHEET_PREFIX: 'Items_Archive_',
  MAX_ACTIVE_ROWS: 10000, // Archive when active sheet exceeds this
  ARCHIVE_MONTHS: 6, // Archive items older than 6 months
  BATCH_SIZE: 100, // Process items in batches
};
```

## 🛠️ Troubleshooting

### Connection Issues
1. Make sure your Web App URL is correct
2. Verify the Apps Script is deployed as "Anyone" can access
3. Use the "Test Connection" button in options

### Performance Issues
1. Check if archiving is needed (use "Archive Now" button)
2. Reduce auto-sync frequency if you have many items
3. Monitor statistics to see active vs archived counts

### Data Issues
1. Check the Apps Script execution log for errors
2. Verify your spreadsheet has the correct permissions
3. Try manual sync to see if it resolves issues

## 📈 Scaling Tips

### For Heavy Users (1000+ items)
- Set auto-sync to 15-30 minutes
- Use manual archiving monthly
- Monitor statistics regularly

### For Light Users (< 100 items)
- Default settings work fine
- Auto-sync every 10 minutes is sufficient
- Archiving happens automatically

## 🔄 Migration from Old System

If you're upgrading from the old single-sheet system:

1. Your existing data will be automatically migrated
2. The old "Items" sheet will be renamed to "Items_Active"
3. Archive sheets will be created as needed
4. No data loss occurs during migration

## 📞 Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Apps Script deployment settings
3. Test the connection using the options page
4. Check the Apps Script execution log in Google Apps Script editor

---

**Note**: This enhanced system is designed to handle much larger datasets than the original implementation while maintaining fast performance through intelligent archiving and batch processing.

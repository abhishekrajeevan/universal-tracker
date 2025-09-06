// Enhanced Universal Tracker - Google Apps Script
// Optimized for large datasets with archiving and performance improvements

const CONFIG = {
  ACTIVE_SHEET: 'Items_Active',
  ARCHIVE_SHEET_PREFIX: 'Items_Archive_',
  MAX_ACTIVE_ROWS: 10000, // Archive when active sheet exceeds this
  ARCHIVE_MONTHS: 6, // Archive items older than 6 months
  BATCH_SIZE: 100, // Process items in batches
  HEADERS: ['id','title','url','status','category','tags','notes','source','added_at','updated_at','completed_at']
};

// Initialize spreadsheet with proper structure
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.getActive();
  
  // Create active sheet if it doesn't exist
  let activeSheet = ss.getSheetByName(CONFIG.ACTIVE_SHEET);
  if (!activeSheet) {
    activeSheet = ss.insertSheet(CONFIG.ACTIVE_SHEET);
    activeSheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
    
    // Format header row
    const headerRange = activeSheet.getRange(1, 1, 1, CONFIG.HEADERS.length);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    // Freeze header row
    activeSheet.setFrozenRows(1);
    
    // Set column widths
    activeSheet.setColumnWidth(1, 200); // ID
    activeSheet.setColumnWidth(2, 300); // Title
    activeSheet.setColumnWidth(3, 200); // URL
    activeSheet.setColumnWidth(4, 100); // Status
    activeSheet.setColumnWidth(5, 120); // Category
    activeSheet.setColumnWidth(6, 150); // Tags
    activeSheet.setColumnWidth(7, 200); // Notes
    activeSheet.setColumnWidth(8, 150); // Source
    activeSheet.setColumnWidth(9, 150); // Added at
    activeSheet.setColumnWidth(10, 150); // Updated at
    activeSheet.setColumnWidth(11, 150); // Completed at
  }
  
  return activeSheet;
}

// Get or create archive sheet for a specific month
function getArchiveSheet(year, month) {
  const ss = SpreadsheetApp.getActive();
  const sheetName = `${CONFIG.ARCHIVE_SHEET_PREFIX}${year}_${month.toString().padStart(2, '0')}`;
  
  let archiveSheet = ss.getSheetByName(sheetName);
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(sheetName);
    archiveSheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
    
    // Format header row
    const headerRange = archiveSheet.getRange(1, 1, 1, CONFIG.HEADERS.length);
    headerRange.setBackground('#34a853');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    // Freeze header row
    archiveSheet.setFrozenRows(1);
  }
  
  return archiveSheet;
}

// Archive old items to reduce active sheet size
function archiveOldItems() {
  const activeSheet = initializeSpreadsheet();
  const lastRow = activeSheet.getLastRow();
  
  if (lastRow <= 1) return; // No data to archive
  
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - CONFIG.ARCHIVE_MONTHS);
  
  const data = activeSheet.getDataRange().getValues();
  const [header, ...rows] = data;
  
  const itemsToArchive = [];
  const itemsToKeep = [header];
  
  rows.forEach(row => {
    const addedAt = new Date(row[8]); // added_at column
    if (addedAt < cutoffDate) {
      itemsToArchive.push(row);
    } else {
      itemsToKeep.push(row);
    }
  });
  
  if (itemsToArchive.length === 0) return;
  
  // Group items by month for archiving
  const archiveGroups = {};
  itemsToArchive.forEach(row => {
    const date = new Date(row[8]);
    const key = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!archiveGroups[key]) archiveGroups[key] = [];
    archiveGroups[key].push(row);
  });
  
  // Archive to appropriate sheets
  Object.entries(archiveGroups).forEach(([key, items]) => {
    const [year, month] = key.split('_');
    const archiveSheet = getArchiveSheet(parseInt(year), parseInt(month));
    
    // Append items to archive sheet
    if (items.length > 0) {
      archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, items.length, CONFIG.HEADERS.length)
        .setValues(items);
    }
  });
  
  // Clear and repopulate active sheet with remaining items
  activeSheet.clear();
  if (itemsToKeep.length > 0) {
    activeSheet.getRange(1, 1, itemsToKeep.length, CONFIG.HEADERS.length)
      .setValues(itemsToKeep);
  }
  
  console.log(`Archived ${itemsToArchive.length} items, kept ${itemsToKeep.length - 1} items active`);
}

// Check if archiving is needed and perform it
function checkAndArchive() {
  const activeSheet = initializeSpreadsheet();
  const lastRow = activeSheet.getLastRow();
  
  // Archive if we have too many rows or if it's been a while since last archive
  if (lastRow > CONFIG.MAX_ACTIVE_ROWS) {
    archiveOldItems();
  }
}

// Optimized bulk upsert with batching
function bulkUpsert(items) {
  if (!items || items.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ok: true, upserted: 0}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const activeSheet = initializeSpreadsheet();
  const header = CONFIG.HEADERS;
  const idIdx = header.indexOf('id');
  
  // Get existing data in batches to avoid memory issues
  const lastRow = activeSheet.getLastRow();
  let existingIds = new Map();
  
  if (lastRow > 1) {
    // Read in chunks to avoid memory issues with large sheets
    const chunkSize = 1000;
    for (let startRow = 2; startRow <= lastRow; startRow += chunkSize) {
      const endRow = Math.min(startRow + chunkSize - 1, lastRow);
      const chunk = activeSheet.getRange(startRow, idIdx + 1, endRow - startRow + 1, 1).getValues();
      chunk.forEach((row, index) => {
        existingIds.set(String(row[0]), startRow + index);
      });
    }
  }
  
  const updates = [];
  const inserts = [];
  
  // Separate updates from inserts
  items.forEach(item => {
    const row = header.map(h => (h in item) ? item[h] : "");
    const existingRow = existingIds.get(String(item.id));
    
    if (existingRow) {
      updates.push({row: existingRow, data: row});
    } else {
      inserts.push(row);
    }
  });
  
  // Perform updates in batches
  if (updates.length > 0) {
    updates.forEach(({row, data}) => {
      activeSheet.getRange(row, 1, 1, header.length).setValues([data]);
    });
  }
  
  // Perform inserts in batches
  if (inserts.length > 0) {
    for (let i = 0; i < inserts.length; i += CONFIG.BATCH_SIZE) {
      const batch = inserts.slice(i, i + CONFIG.BATCH_SIZE);
      const startRow = activeSheet.getLastRow() + 1;
      activeSheet.getRange(startRow, 1, batch.length, header.length).setValues(batch);
    }
  }
  
  // Check if archiving is needed after bulk operation
  checkAndArchive();
  
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true, 
      upserted: items.length,
      updated: updates.length,
      inserted: inserts.length
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get items with pagination support
function getItems(limit = 1000, offset = 0, category = null, status = null) {
  const activeSheet = initializeSpreadsheet();
  const lastRow = activeSheet.getLastRow();
  
  if (lastRow <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({items: [], total: 0}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = activeSheet.getDataRange().getValues();
  const [header, ...rows] = data;
  
  let filteredRows = rows;
  
  // Apply filters
  if (category) {
    const categoryIdx = header.indexOf('category');
    filteredRows = filteredRows.filter(row => row[categoryIdx] === category);
  }
  
  if (status) {
    const statusIdx = header.indexOf('status');
    filteredRows = filteredRows.filter(row => row[statusIdx] === status);
  }
  
  // Apply pagination
  const paginatedRows = filteredRows.slice(offset, offset + limit);
  const items = paginatedRows.map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
  
  return ContentService
    .createTextOutput(JSON.stringify({
      items,
      total: filteredRows.length,
      limit,
      offset
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Legacy endpoints for backward compatibility
function doGet(e) {
  const {limit, offset, category, status} = e.parameter || {};
  return getItems(
    limit ? parseInt(limit) : 1000,
    offset ? parseInt(offset) : 0,
    category,
    status
  );
}

function doPost(e) {
  const body = JSON.parse(e.postData && e.postData.contents || "{}");
  const items = body.items || (body.item ? [body.item] : []);
  return bulkUpsert(items);
}

// New endpoint for bulk operations
function bulkUpsert(e) {
  const body = JSON.parse(e.postData && e.postData.contents || "{}");
  const items = body.items || [];
  return bulkUpsert(items);
}

// Manual archive trigger (can be called from extension)
function triggerArchive() {
  archiveOldItems();
  return ContentService
    .createTextOutput(JSON.stringify({ok: true, message: "Archive completed"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get statistics about the spreadsheet
function getStats() {
  const activeSheet = initializeSpreadsheet();
  const lastRow = activeSheet.getLastRow();
  const activeCount = Math.max(0, lastRow - 1);
  
  // Count archive sheets
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  const archiveSheets = sheets.filter(sheet => 
    sheet.getName().startsWith(CONFIG.ARCHIVE_SHEET_PREFIX)
  );
  
  let archivedCount = 0;
  archiveSheets.forEach(sheet => {
    archivedCount += Math.max(0, sheet.getLastRow() - 1);
  });
  
  return ContentService
    .createTextOutput(JSON.stringify({
      active: activeCount,
      archived: archivedCount,
      total: activeCount + archivedCount,
      archiveSheets: archiveSheets.length
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Enhanced Universal Tracker - Google Apps Script
// Optimized for large datasets with archiving, priority, and reminder support

const CONFIG = {
  ACTIVE_SHEET: 'Items_Active',
  ARCHIVE_SHEET_PREFIX: 'Items_Archive_',
  MAX_ACTIVE_ROWS: 10000, // Archive when active sheet exceeds this
  ARCHIVE_MONTHS: 6, // Archive items older than 6 months
  BATCH_SIZE: 100, // Process items in batches
  HEADERS: ['id','title','url','status','category','priority','tags','notes','source','reminder_time','added_at','updated_at','completed_at']
};

// Ensure the sheet's header row matches CONFIG.HEADERS and realign existing data if needed
function ensureSchema(sheet) {
  if (!sheet) return;
  const range = sheet.getDataRange();
  const numRows = range.getNumRows();
  const numCols = range.getNumColumns();
  if (numRows === 0) {
    // Empty sheet, just write headers
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const data = range.getValues();
  const currentHeader = (data[0] || []).map(String);
  const desired = CONFIG.HEADERS;

  // If headers already match (same order and names), nothing to do
  if (currentHeader.length === desired.length && currentHeader.every((h, i) => h === desired[i])) {
    return;
  }

  // Build mapping from old header -> index
  const oldIndex = new Map();
  currentHeader.forEach((h, i) => oldIndex.set(String(h), i));

  // Rebuild all rows to desired order
  const rebuilt = [desired];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const next = desired.map(h => {
      if (oldIndex.has(h)) {
        return row[oldIndex.get(h)];
      }
      return "";
    });
    rebuilt.push(next);
  }

  // Clear old data and write back in desired shape
  sheet.clear();
  sheet.getRange(1, 1, rebuilt.length, desired.length).setValues(rebuilt);
  sheet.setFrozenRows(1);
}

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
    activeSheet.setColumnWidth(6, 80);  // Priority
    activeSheet.setColumnWidth(7, 150); // Tags
    activeSheet.setColumnWidth(8, 200); // Notes
    activeSheet.setColumnWidth(9, 150); // Source
    activeSheet.setColumnWidth(10, 150); // Reminder time
    activeSheet.setColumnWidth(11, 150); // Added at
    activeSheet.setColumnWidth(12, 150); // Updated at
    activeSheet.setColumnWidth(13, 150); // Completed at
  }

  // Always ensure schema is up to date (handles existing sheets)
  ensureSchema(activeSheet);
  
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
  
  // Ensure archive sheet schema is up to date as well
  ensureSchema(archiveSheet);
  
  return archiveSheet;
}

// Migrate headers for all relevant sheets (active + archives)
function migrateAllSheets() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (name === CONFIG.ACTIVE_SHEET || name.indexOf(CONFIG.ARCHIVE_SHEET_PREFIX) === 0) {
      ensureSchema(sheet);
    }
  });
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, migrated: true }))
    .setMimeType(ContentService.MimeType.JSON);
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
  
  const headerRow = header; // from data[0]
  const addedIdx = headerRow.indexOf('added_at');
  rows.forEach(row => {
    const addedAt = addedIdx >= 0 ? new Date(row[addedIdx]) : new Date(row[0]);
    if (addedAt < cutoffDate) {
      itemsToArchive.push(row);
    } else {
      itemsToKeep.push(row);
    }
  });
  
  if (itemsToArchive.length === 0) return;
  
  // Group items by month for archiving
  const archiveGroups = {};
  const archiveKeyIdx = addedIdx;
  itemsToArchive.forEach(row => {
    const date = archiveKeyIdx >= 0 ? new Date(row[archiveKeyIdx]) : new Date();
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
  try {
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
  var existingIndexById = {};
  
  if (lastRow > 1) {
    // Read in chunks to avoid memory issues with large sheets
    const chunkSize = 1000;
    for (let startRow = 2; startRow <= lastRow; startRow += chunkSize) {
      const endRow = Math.min(startRow + chunkSize - 1, lastRow);
      const chunk = activeSheet.getRange(startRow, idIdx + 1, endRow - startRow + 1, 1).getValues();
      for (var ci = 0; ci < chunk.length; ci++) {
        var idCell = String(chunk[ci][0] || "");
        if (idCell) existingIndexById[idCell] = startRow + ci;
      }
    }
  }
  
  const updates = [];
  const inserts = [];
  
  // Separate updates from inserts
  items.forEach(item => {
    const row = header.map(h => {
      if (h in item) {
        // Handle arrays (tags) and objects properly
        if (h === 'tags' && Array.isArray(item[h])) {
          return item[h].join(', ');
        }
        return item[h];
      }
      return "";
    });
    const existingRow = existingIndexById[String(item.id)];
    
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
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: msg }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Get items with pagination support
function getItems(limit = 1000, offset = 0, category = null, status = null, priority = null) {
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
  
  if (priority) {
    const priorityIdx = header.indexOf('priority');
    filteredRows = filteredRows.filter(row => row[priorityIdx] === priority);
  }
  
  // Apply pagination
  const paginatedRows = filteredRows.slice(offset, offset + limit);
  const items = paginatedRows.map(row => {
    const item = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    // Convert tags back to array
    if (item.tags && typeof item.tags === 'string') {
      item.tags = item.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
    return item;
  });
  
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
  try {
  // Handle extra path segments or action param (e.g., /getStats or ?action=getStats)
  const pathInfo = e && e.pathInfo ? e.pathInfo.toString() : "";
  const path = pathInfo.replace(/^\//, "");
  const action = (e && e.parameter && e.parameter.action) || path;
  if (action === "getStats") {
    return getStats();
  }

  // Default behaviour: list items with optional filters
  const { limit, offset, category, status, priority } = e.parameter || {};
  return getItems(
    limit ? parseInt(limit, 10) : 1000,
    offset ? parseInt(offset, 10) : 0,
    category || null,
    status || null,
    priority || null
  );
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: msg }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
  // Handle extra path segments or action param (e.g., /bulkUpsert or ?action=bulkUpsert)
  const pathInfo = e && e.pathInfo ? e.pathInfo.toString() : "";
  const path = pathInfo.replace(/^\//, "");
  const action = (e && e.parameter && e.parameter.action) || path;
  if (action === "bulkUpsert") {
    return handleBulkUpsert(e);
  }
  if (action === "bulkDelete") {
    const body  = JSON.parse(e.postData && e.postData.contents || "{}");
    const ids = body.ids || [];
    return bulkDelete(ids);
  }
  if (action === "triggerArchive") {
    return triggerArchive();
  }
  if (action === "migrate") {
    return migrateAllSheets();
  }

  // Default behaviour: parse body and perform bulk upsert
  const body = JSON.parse(e.postData && e.postData.contents || "{}");
  const items = body.items || (body.item ? [body.item] : []);
  return bulkUpsert(items);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: msg }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Routing helper for bulk upsert requests
function handleBulkUpsert(e) {
  const body  = JSON.parse(e.postData && e.postData.contents || "{}");
  const items = body.items || (body.item ? [body.item] : []);
  return bulkUpsert(items);
}

// Bulk delete by IDs across active and archive sheets
function bulkDelete(ids) {
  try {
    if (!ids || !ids.length) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, deleted: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActive();
    const sheets = ss.getSheets();
    const targetSheets = sheets.filter(sh => sh.getName() === CONFIG.ACTIVE_SHEET || sh.getName().indexOf(CONFIG.ARCHIVE_SHEET_PREFIX) === 0);

    let totalDeleted = 0;
    const idSet = {};
    ids.forEach(id => { if (id) idSet[String(id)] = true; });

    targetSheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      if (!data.length) return;
      const header = data[0];
      const idIdx = header.indexOf('id');
      if (idIdx < 0) return;

      const rowsToDelete = [];
      for (let r = 1; r < data.length; r++) {
        const rowId = String(data[r][idIdx] || "");
        if (idSet[rowId]) rowsToDelete.push(r + 1); // 1-based row index including header
      }
      // Delete from bottom to top to avoid shifting
      rowsToDelete.sort((a,b) => b - a);
      rowsToDelete.forEach(rowNum => {
        sheet.deleteRow(rowNum);
        totalDeleted++;
      });
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, deleted: totalDeleted }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: msg }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
  
  // Get priority and reminder stats
  let priorityStats = { high: 0, medium: 0, low: 0 };
  let reminderStats = { total: 0, upcoming: 0 };
  
  if (lastRow > 1) {
    const data = activeSheet.getDataRange().getValues();
    const [header, ...rows] = data;
    const priorityIdx = header.indexOf('priority');
    const reminderIdx = header.indexOf('reminder_time');
    const statusIdx = header.indexOf('status');
    
    const now = new Date();
    
    rows.forEach(row => {
      // Count priorities (only for active items)
      if (row[statusIdx] === 'todo') {
        const priority = row[priorityIdx] || 'medium';
        if (priorityStats.hasOwnProperty(priority)) {
          priorityStats[priority]++;
        }
      }
      
      // Count reminders
      if (row[reminderIdx]) {
        reminderStats.total++;
        const reminderTime = new Date(row[reminderIdx]);
        if (reminderTime > now) {
          reminderStats.upcoming++;
        }
      }
    });
  }
  
  return ContentService
    .createTextOutput(JSON.stringify({
      active: activeCount,
      archived: archivedCount,
      total: activeCount + archivedCount,
      archiveSheets: archiveSheets.length,
      priorities: priorityStats,
      reminders: reminderStats
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

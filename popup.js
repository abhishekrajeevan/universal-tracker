// Global state for editing
let editingItemId = null;
let tagCache = [];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getMetadata() {
  const tab = await getActiveTab();
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_METADATA' });
    if (res) return res;
  } catch {}
  // fallback
  return {
    title: cleanTitle(tab.title || ''),
    url: tab.url,
    siteName: new URL(tab.url).hostname
  };
}

function getCategoryIcon(category) {
  const icons = {
    'Movie': '🎬',
    'TV': '📺', 
    'Trailer': '🎭',
    'Video': '🎥',
    'Blog': '📝',
    'Podcast': '🎧',
    'Book': '📖',
    'Course': '🎓',
    'Game': '🎮',
    'Other': '📄'
  };
  return icons[category] || '📄';
}

function getPriorityIcon(priority) {
  const icons = {
    'low': '🔵',
    'medium': '🟡',
    'high': '🔴'
  };
  return icons[priority] || '🟡';
}

function formatReminderTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  // Check if it's today
  if (date.toDateString() === now.toDateString()) {
    return `Today ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  }
  
  // Check if it's tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  }
  
  // Otherwise show date and time
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function buildTagCache(items) {
  const tagFrequency = {};
  
  items.forEach(item => {
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach(tag => {
        tagFrequency[tag.toLowerCase()] = (tagFrequency[tag.toLowerCase()] || 0) + 1;
      });
    }
  });
  
  // Sort by frequency (most used first)
  tagCache = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
}

function setupTagAutocomplete() {
  const tagsInput = document.getElementById('tags');
  const suggestionsDiv = document.getElementById('tagsSuggestions');
  let selectedIndex = -1;
  
  tagsInput.addEventListener('input', (e) => {
    const value = e.target.value;
    const lastCommaIndex = value.lastIndexOf(',');
    const currentTag = value.substring(lastCommaIndex + 1).trim().toLowerCase();
    
    if (currentTag.length < 1) {
      suggestionsDiv.style.display = 'none';
      return;
    }
    
    const matches = tagCache.filter(tag => 
      tag.includes(currentTag) && tag !== currentTag
    ).slice(0, 5);
    
    if (matches.length === 0) {
      suggestionsDiv.style.display = 'none';
      return;
    }
    
    suggestionsDiv.innerHTML = '';
    matches.forEach((tag, index) => {
      const div = document.createElement('div');
      div.className = 'tag-suggestion';
      div.textContent = tag;
      div.addEventListener('click', () => selectTag(tag));
      suggestionsDiv.appendChild(div);
    });
    
    suggestionsDiv.style.display = 'block';
    selectedIndex = -1;
  });
  
  tagsInput.addEventListener('keydown', (e) => {
    const suggestions = suggestionsDiv.querySelectorAll('.tag-suggestion');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const selectedTag = suggestions[selectedIndex].textContent;
      selectTag(selectedTag);
    } else if (e.key === 'Escape') {
      suggestionsDiv.style.display = 'none';
      selectedIndex = -1;
    }
  });
  
  function updateSelection() {
    const suggestions = suggestionsDiv.querySelectorAll('.tag-suggestion');
    suggestions.forEach((div, index) => {
      div.classList.toggle('selected', index === selectedIndex);
    });
  }
  
  function selectTag(tag) {
    const value = tagsInput.value;
    const lastCommaIndex = value.lastIndexOf(',');
    const beforeCurrentTag = value.substring(0, lastCommaIndex + 1);
    const afterCurrentTag = lastCommaIndex >= 0 ? (beforeCurrentTag ? ' ' : '') : '';
    
    tagsInput.value = beforeCurrentTag + afterCurrentTag + tag + ', ';
    tagsInput.focus();
    suggestionsDiv.style.display = 'none';
  }
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tags-input-container')) {
      suggestionsDiv.style.display = 'none';
    }
  });
}

function renderItems(items) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  
  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <div>No items yet</div>
        <div style="font-size: 12px; margin-top: 4px; opacity: 0.7;">Start tracking content by saving your first item!</div>
      </div>
    `;
    return;
  }
  
  const sorted = items.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const toRender = sorted.slice(0, 3);
  for (const it of toRender) {
    const host = (it.url ? new URL(it.url).hostname : '');
    const div = document.createElement('div');
    div.className = `item ${editingItemId === it.id ? 'edit-mode' : ''}`;
    
    // Build reminder display
    let reminderDisplay = '';
    if (it.reminder_time) {
      const reminderText = formatReminderTime(it.reminder_time);
      const isActive = new Date(it.reminder_time) > new Date();
      reminderDisplay = `<span class="reminder-pill ${isActive ? 'reminder-active' : ''}">${isActive ? '⏰' : '⏰'} ${reminderText}</span>`;
    }
    
    div.innerHTML = `
      <div class="item-title">
        <span class="category-icon">${getCategoryIcon(it.category)}</span>
        ${it.title || '(untitled)'}
        <span class="status-pill status-${it.status}">${it.status === 'done' ? '✅ Done' : '📋 To Do'}</span>
        ${editingItemId === it.id ? '<span class="edit-indicator">Editing</span>' : ''}
      </div>
      <div class="item-meta">
        <span>${getPriorityIcon(it.priority || 'medium')} ${it.category || 'Other'}</span>
        <span>•</span>
        <span>${host}</span>
        ${it.tags && it.tags.length > 0 ? `<span>•</span><span>🏷️ ${it.tags.slice(0, 2).join(', ')}${it.tags.length > 2 ? '...' : ''}</span>` : ''}
        ${reminderDisplay}
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-small" data-act="toggle" data-id="${it.id}">
          ${it.status === 'done' ? '↩️ Mark To Do' : '✅ Mark Done'}
        </button>
        <button class="btn btn-secondary btn-small" data-act="edit" data-id="${it.id}">
          ✏️ Edit
        </button>
        <button class="btn btn-secondary btn-small" data-act="remove" data-id="${it.id}">
          🗑️ Delete
        </button>
        ${it.url ? `<a class="link" href="${it.url}" target="_blank">🔗 Open</a>` : ''}
      </div>
    `;
    // Clean labels and hide host bullet when URL absent
    const toggleBtn = div.querySelector('button[data-act="toggle"]');
    if (toggleBtn) toggleBtn.textContent = it.status === 'done' ? '↺ Mark To Do' : '✓ Mark Done';
    const editBtn = div.querySelector('button[data-act="edit"]');
    if (editBtn) editBtn.textContent = '✎ Edit';
    const delBtn = div.querySelector('button[data-act="remove"]');
    if (delBtn) delBtn.textContent = '🗑 Delete';
    const linkEl = div.querySelector('a.link');
    if (linkEl) linkEl.textContent = 'Open';
    if (!host) {
      const metaEl = div.querySelector('.item-meta');
      if (metaEl) {
        const spans = metaEl.querySelectorAll('span');
        if (spans.length >= 3 && !spans[2].textContent.trim()) {
          if (spans[1]) spans[1].remove();
          if (spans[2]) spans[2].remove();
        }
      }
    }
    list.appendChild(div);
  }
  
  list.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-act');
    
    if (act === 'toggle') {
      const items = await localAdapter.getAll();
      const it = items.find(x => x.id === id);
      if (it) {
        it.status = it.status === 'done' ? 'todo' : 'done';
        it.updated_at = nowISO();
        if (it.status === 'done') {
          it.completed_at = nowISO();
        } else {
          it.completed_at = null;
        }
        await localAdapter.upsert(it);
        await queueAdapter.enqueue(it);
        renderItems(await localAdapter.getAll());
      }
    } else if (act === 'edit') {
      const items = await localAdapter.getAll();
      const it = items.find(x => x.id === id);
      if (it) {
        startEditing(it);
      }
    } else if (act === 'remove') {
      if (confirm('Are you sure you want to delete this item?')) {
        // Queue deletion for backend, then remove locally
        await queueAdapter.enqueue({ op: 'delete', id });
        await localAdapter.remove(id);
        if (editingItemId === id) {
          cancelEditing();
        }
        renderItems(await localAdapter.getAll());
      }
    }
  };
}

async function startEditing(item) {
  editingItemId = item.id;
  
  // Populate form with item data
  document.getElementById('title').value = item.title || '';
  document.getElementById('category').value = item.category || 'Other';
  document.getElementById('priority').value = item.priority || 'medium';
  document.getElementById('tags').value = (item.tags || []).join(', ');
  document.getElementById('notes').value = item.notes || '';
  
  // Handle reminder
  const reminderEnabled = document.getElementById('reminderEnabled');
  const reminderDateTime = document.getElementById('reminderDateTime');
  const reminderTime = document.getElementById('reminderTime');
  
  if (item.reminder_time) {
    reminderEnabled.checked = true;
    reminderDateTime.style.display = 'block';
    // Convert to local datetime string
    const date = new Date(item.reminder_time);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    reminderTime.value = localDate.toISOString().slice(0, 16);
  } else {
    reminderEnabled.checked = false;
    reminderDateTime.style.display = 'none';
    reminderTime.value = '';
  }
  
  // Update UI
  document.getElementById('editIndicator').style.display = 'block';
  document.getElementById('saveBtnIcon').textContent = '✏️';
  document.getElementById('saveBtnText').textContent = 'Update Item';
  
  // Hide page meta when editing
  document.getElementById('pageMeta').style.display = 'none';
  
  // Scroll to top
  document.querySelector('.content').scrollTop = 0;
  
  renderItems(await localAdapter.getAll());
}

function cancelEditing() {
  editingItemId = null;
  
  // Clear form
  document.getElementById('title').value = '';
  document.getElementById('category').value = 'Other';
  document.getElementById('priority').value = 'medium';
  document.getElementById('tags').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('reminderEnabled').checked = false;
  document.getElementById('reminderDateTime').style.display = 'none';
  document.getElementById('reminderTime').value = '';
  
  // Update UI
  document.getElementById('editIndicator').style.display = 'none';
  document.getElementById('saveBtnIcon').textContent = '💾';
  document.getElementById('saveBtnText').textContent = 'Save Item';
  document.getElementById('pageMeta').style.display = 'flex';
}

async function checkConnectionStatus() {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const connectionStatus = document.getElementById('connectionStatus');
  
  try {
    console.log('Sending GET_STATS message...');
    
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout - connection check took too long'));
      }, 10000);
      
      chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('Connection status response:', response);
    
    if (response && response.success) {
      statusIndicator.textContent = '🟢';
      statusText.textContent = `Connected (${response.stats.total} items)`;
      connectionStatus.className = 'connection-status connected';
    } else {
      console.log('Connection failed:', response);
      throw new Error((response && response.error) || 'Connection failed');
    }
  } catch (error) {
    console.log('Connection error:', error);
    statusIndicator.textContent = '🔴';
    
    if (error.message.includes('timeout')) {
      statusText.textContent = 'Connection timeout';
    } else if (error.message.includes('No Apps Script URL')) {
      statusText.textContent = 'Not configured';
    } else {
      statusText.textContent = 'Connection failed';
    }
    
    connectionStatus.className = 'connection-status disconnected';
  }
}

async function sendMessageWithTimeout(message, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Message timeout - background script may be unresponsive'));
    }, timeout);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Reminder notification system
function scheduleReminder(item) {
  if (!item.reminder_time) return;
  
  const reminderTime = new Date(item.reminder_time);
  const now = new Date();
  
  if (reminderTime <= now) return; // Don't schedule past reminders
  
  // Use Chrome alarms API for reminders
  chrome.alarms.create(`reminder_${item.id}`, {
    when: reminderTime.getTime()
  });
}

function clearReminder(itemId) {
  chrome.alarms.clear(`reminder_${itemId}`);
}

async function init() {
  // Get metadata only if not editing
  let meta = null;
  if (!editingItemId) {
    meta = await getMetadata();
    document.getElementById('pageMeta').textContent = `${meta.siteName} • ${meta.url}`;
    document.getElementById('title').value = meta.title || '';
  }

  const items = await localAdapter.getAll();
  
  // Build tag cache for autocomplete
  buildTagCache(items);
  setupTagAutocomplete();
  
  renderItems(items);
  
  // Set up reminder checkbox handler
  document.getElementById('reminderEnabled').addEventListener('change', (e) => {
    const reminderDateTime = document.getElementById('reminderDateTime');
    if (e.target.checked) {
      reminderDateTime.style.display = 'block';
      // Set default to tomorrow at 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const offset = tomorrow.getTimezoneOffset();
      const localDate = new Date(tomorrow.getTime() - (offset * 60 * 1000));
      document.getElementById('reminderTime').value = localDate.toISOString().slice(0, 16);
    } else {
      reminderDateTime.style.display = 'none';
    }
  });
  
  checkConnectionStatus().catch(error => {
    console.log('Connection status check failed:', error);
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const connectionStatus = document.getElementById('connectionStatus');
    
    statusIndicator.textContent = '⚪';
    statusText.textContent = 'Connection check failed';
    connectionStatus.className = 'connection-status disconnected';
  });

  document.getElementById('saveBtn').onclick = async () => {
    const saveBtn = document.getElementById('saveBtn');
    const originalIcon = document.getElementById('saveBtnIcon').textContent;
    const originalText = document.getElementById('saveBtnText').textContent;
    
    // Visual feedback
    document.getElementById('saveBtnIcon').textContent = '⏳';
    document.getElementById('saveBtnText').textContent = editingItemId ? 'Updating...' : 'Saving...';
    saveBtn.disabled = true;
    
    try {
      const selectedCategory = document.getElementById('category').value;
      let finalUrl = '';
      
      // Only use URL for new items (not editing)
      if (!editingItemId) {
        finalUrl = (selectedCategory === "Movie" || selectedCategory === "TV") ? "" : meta.url;
      } else {
        // For editing, preserve existing URL or use empty if Movie/TV
        const existingItem = (await localAdapter.getAll()).find(x => x.id === editingItemId);
        finalUrl = existingItem ? existingItem.url : '';
      }
      
      // Handle reminder
      let reminderTime = null;
      if (document.getElementById('reminderEnabled').checked) {
        const reminderInput = document.getElementById('reminderTime').value;
        if (reminderInput) {
          reminderTime = new Date(reminderInput).toISOString();
        }
      }
      
      const itemData = {
        title: document.getElementById('title').value.trim(),
        url: finalUrl,
        status: editingItemId ? undefined : 'todo', // Don't change status when editing
        category: selectedCategory,
        priority: document.getElementById('priority').value,
        tags: splitTags(document.getElementById('tags').value),
        notes: document.getElementById('notes').value.trim(),
        source: editingItemId ? undefined : meta.siteName, // Don't change source when editing
        reminder_time: reminderTime
      };
      
      let item;
      if (editingItemId) {
        // Update existing item
        const items = await localAdapter.getAll();
        const existingItem = items.find(x => x.id === editingItemId);
        if (existingItem) {
          // Clear old reminder
          if (existingItem.reminder_time) {
            clearReminder(existingItem.id);
          }
          
          item = { ...existingItem, ...itemData, updated_at: nowISO() };
          
          // Schedule new reminder
          if (item.reminder_time) {
            scheduleReminder(item);
          }
        }
      } else {
        // Create new item
        item = createItem(itemData);
        
        // Schedule reminder for new item
        if (item.reminder_time) {
          scheduleReminder(item);
        }
      }
      
      await localAdapter.upsert(item);
      await queueAdapter.enqueue(item);
      
      // Success feedback
      document.getElementById('saveBtnIcon').textContent = '✅';
      document.getElementById('saveBtnText').textContent = editingItemId ? 'Updated!' : 'Saved!';
      
      setTimeout(() => {
        document.getElementById('saveBtnIcon').textContent = originalIcon;
        document.getElementById('saveBtnText').textContent = originalText;
        saveBtn.disabled = false;
      }, 1500);
      
      // If we were editing, cancel edit mode
      if (editingItemId) {
        cancelEditing();
      } else {
        // Clear form for new items
        document.getElementById('tags').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('reminderEnabled').checked = false;
        document.getElementById('reminderDateTime').style.display = 'none';
      }
      
      const updatedItems = await localAdapter.getAll();
      buildTagCache(updatedItems); // Rebuild cache with new tags
      renderItems(updatedItems);
      
    } catch (error) {
      console.error('Save error:', error);
      // Error feedback
      document.getElementById('saveBtnIcon').textContent = '❌';
      document.getElementById('saveBtnText').textContent = 'Error';
      setTimeout(() => {
        document.getElementById('saveBtnIcon').textContent = originalIcon;
        document.getElementById('saveBtnText').textContent = originalText;
        saveBtn.disabled = false;
      }, 2000);
    }
  };

  // Export functionality
  document.getElementById('exportBtn').onclick = async () => {
    const items = await localAdapter.getAll();
    const blob = new Blob([JSON.stringify({ items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    if (chrome.downloads) {
      chrome.downloads.download({ url, filename: 'universal-tracker-export.json' });
    } else {
      window.open(url);
    }
  };

  // Open dashboard (full list) in a new tab
  const dashLink = document.getElementById('openDashboard');
  if (dashLink) {
    dashLink.onclick = (e) => {
      e.preventDefault();
      const url = chrome.runtime.getURL('dashboard.html');
      chrome.tabs.create({ url });
    };
  }

  // Import functionality
  document.getElementById('importBtn').onclick = async () => {
    const input = document.createElement('input');
    input.type = 'file'; 
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files[0]; 
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const items = Array.isArray(data?.items) ? data.items : [];
        
        for (const it of items) {
          await localAdapter.upsert(it);
          // Schedule reminders for imported items
          if (it.reminder_time && new Date(it.reminder_time) > new Date()) {
            scheduleReminder(it);
          }
        }
        
        const updatedItems = await localAdapter.getAll();
        buildTagCache(updatedItems);
        renderItems(updatedItems);
        alert(`Successfully imported ${items.length} items!`);
      } catch (error) {
        alert('Error importing file: ' + error.message);
      }
    };
    input.click();
  };

  // Sync functionality
  document.getElementById('syncBtn').onclick = async () => {
    const syncBtn = document.getElementById('syncBtn');
    const originalText = syncBtn.innerHTML;
    
    syncBtn.innerHTML = '⏳ Syncing...';
    syncBtn.style.pointerEvents = 'none';
    
    try {
      console.log('Starting sync...');
      const response = await sendMessageWithTimeout({ type: 'SYNC_NOW' }, 15000);
      console.log('Sync response:', response);
      
      if (response && response.success) {
        syncBtn.innerHTML = '✅ Synced!';
        await checkConnectionStatus();
        setTimeout(() => {
          syncBtn.innerHTML = originalText;
          syncBtn.style.pointerEvents = 'auto';
        }, 1500);
      } else {
        throw new Error((response && response.error) || 'Sync failed');
      }
    } catch (error) {
      console.log('Sync error:', error);
      syncBtn.innerHTML = '❌ Error';
      
      if (error.message.includes('timeout')) {
        console.error('Sync timeout - this may indicate the sync is still running in the background');
      }
      
      setTimeout(() => {
        syncBtn.innerHTML = originalText;
        syncBtn.style.pointerEvents = 'auto';
      }, 2000);
    }
  };

  // Archive functionality
  document.getElementById('archiveBtn').onclick = async () => {
    const archiveBtn = document.getElementById('archiveBtn');
    const originalText = archiveBtn.innerHTML;
    
    archiveBtn.innerHTML = '⏳ Archiving...';
    archiveBtn.style.pointerEvents = 'none';
    
    try {
      const response = await sendMessageWithTimeout({ type: 'TRIGGER_ARCHIVE' }, 20000);
      
      if (response && response.success) {
        archiveBtn.innerHTML = '✅ Archived!';
        setTimeout(() => {
          archiveBtn.innerHTML = originalText;
          archiveBtn.style.pointerEvents = 'auto';
        }, 1500);
      } else {
        throw new Error((response && response.error) || 'Archive failed');
      }
    } catch (error) {
      archiveBtn.innerHTML = '❌ Error';
      setTimeout(() => {
        archiveBtn.innerHTML = originalText;
        archiveBtn.style.pointerEvents = 'auto';
      }, 2000);
    }
  };

  // Stats functionality
  document.getElementById('statsBtn').onclick = async () => {
    const statsBtn = document.getElementById('statsBtn');
    const originalText = statsBtn.innerHTML;
    
    statsBtn.innerHTML = '⏳ Loading...';
    statsBtn.style.pointerEvents = 'none';
    
    try {
      const response = await sendMessageWithTimeout({ type: 'GET_STATS' }, 10000);
      
      if (response && response.success) {
        const stats = response.stats;
        alert(`📊 Storage Statistics:\n\n` +
              `Active Items: ${stats.active}\n` +
              `Archived Items: ${stats.archived}\n` +
              `Total Items: ${stats.total}\n` +
              `Archive Sheets: ${stats.archiveSheets}`);
        
        statsBtn.innerHTML = originalText;
        statsBtn.style.pointerEvents = 'auto';
      } else {
        throw new Error((response && response.error) || 'Failed to get stats');
      }
    } catch (error) {
      alert(`Error getting statistics: ${error.message}`);
      statsBtn.innerHTML = originalText;
      statsBtn.style.pointerEvents = 'auto';
    }
  };
  
  // Add escape key handler to cancel editing
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' && editingItemId) {
      cancelEditing();
      renderItems(await localAdapter.getAll());
    }
  });
}

document.addEventListener('DOMContentLoaded', init);


// Override icon helpers with clean emoji for a consistent UI in the popup
// eslint-disable-next-line no-func-assign
getCategoryIcon = function(category) {
  const icons = {
    'Movie': '??',
    'TV': '??',
    'Trailer': '???',
    'Video': '??',
    'Blog': '??',
    'Podcast': '??',
    'Book': '??',
    'Course': '??',
    'Game': '??',
    'Other': '??'
  };
  return icons[category] || '??';
};

// eslint-disable-next-line no-func-assign
getPriorityIcon = function(priority) {
  const icons = { low: '??', medium: '??', high: '??' };
  return icons[priority] || '??';
};

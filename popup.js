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
  for (const it of sorted) {
    const host = (it.source || (it.url ? new URL(it.url).hostname : ''));
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="item-title">
        <span class="category-icon">${getCategoryIcon(it.category)}</span>
        ${it.title || '(untitled)'}
        <span class="status-pill status-${it.status}">${it.status === 'done' ? '✅ Done' : '📋 To Do'}</span>
      </div>
      <div class="item-meta">
        <span>${it.category || 'Other'}</span>
        <span>•</span>
        <span>${host}</span>
        ${it.tags && it.tags.length > 0 ? `<span>•</span><span>🏷️ ${it.tags.slice(0, 2).join(', ')}${it.tags.length > 2 ? '...' : ''}</span>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-small" data-act="toggle" data-id="${it.id}">
          ${it.status === 'done' ? '↩️ Mark To Do' : '✅ Mark Done'}
        </button>
        <button class="btn btn-secondary btn-small" data-act="remove" data-id="${it.id}">
          🗑️ Delete
        </button>
        ${it.url ? `<a class="link" href="${it.url}" target="_blank">🔗 Open</a>` : ''}
      </div>
    `;
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
        await localAdapter.upsert(it);
        await queueAdapter.enqueue(it);
        renderItems(await localAdapter.getAll());
      }
    } else if (act === 'remove') {
      await localAdapter.remove(id);
      renderItems(await localAdapter.getAll());
    }
  };
}

async function checkConnectionStatus() {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const connectionStatus = document.getElementById('connectionStatus');
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (response && response.success) {
      statusIndicator.textContent = '🟢';
      statusText.textContent = `Connected (${response.stats.total} items)`;
      connectionStatus.className = 'connection-status connected';
    } else {
      throw new Error((response && response.error) || 'Connection failed');
    }
  } catch (error) {
    statusIndicator.textContent = '🔴';
    statusText.textContent = 'Not connected';
    connectionStatus.className = 'connection-status disconnected';
  }
}

async function init() {
  const meta = await getMetadata();
  document.getElementById('pageMeta').textContent = `${meta.siteName} • ${meta.url}`;
  document.getElementById('title').value = meta.title || '';

  renderItems(await localAdapter.getAll());
  
  // Check connection status
  await checkConnectionStatus();

  document.getElementById('saveBtn').onclick = async () => {
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerHTML;
    
    // Visual feedback
    saveBtn.innerHTML = '⏳ Saving...';
    saveBtn.disabled = true;
    
    try {
      const selectedCategory = document.getElementById('category').value;
      const finalUrl = (selectedCategory === "Movie" || selectedCategory === "TV") ? "" : meta.url;
      
      const item = createItem({
        title: document.getElementById('title').value.trim(),
        url: finalUrl,  // Use filtered URL based on user selection
        status: document.getElementById('status').value,
        category: selectedCategory,
        tags: splitTags(document.getElementById('tags').value),
        notes: document.getElementById('notes').value.trim(),
        source: meta.siteName
      });
      await localAdapter.upsert(item);
      await queueAdapter.enqueue(item);
      
      // Success feedback
      saveBtn.innerHTML = '✅ Saved!';
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }, 1500);
      
      renderItems(await localAdapter.getAll());
    } catch (error) {
      // Error feedback
      saveBtn.innerHTML = '❌ Error';
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }, 2000);
    }
  };

  document.getElementById('markDoneBtn').onclick = async () => {
    const markDoneBtn = document.getElementById('markDoneBtn');
    const originalText = markDoneBtn.innerHTML;
    
    // Visual feedback
    markDoneBtn.innerHTML = '⏳ Marking...';
    markDoneBtn.disabled = true;
    
    try {
      const selectedCategory = document.getElementById('category').value;
      const finalUrl = (selectedCategory === "Movie" || selectedCategory === "TV") ? "" : meta.url;
      
      const item = createItem({
        title: document.getElementById('title').value.trim(),
        url: finalUrl,  // Use filtered URL based on user selection
        status: 'done',
        category: selectedCategory,
        tags: splitTags(document.getElementById('tags').value),
        notes: document.getElementById('notes').value.trim(),
        source: meta.siteName
      });
      await localAdapter.upsert(item);
      await queueAdapter.enqueue(item);
      
      // Success feedback
      markDoneBtn.innerHTML = '✅ Done!';
      setTimeout(() => {
        markDoneBtn.innerHTML = originalText;
        markDoneBtn.disabled = false;
      }, 1500);
      
      renderItems(await localAdapter.getAll());
    } catch (error) {
      // Error feedback
      markDoneBtn.innerHTML = '❌ Error';
      setTimeout(() => {
        markDoneBtn.innerHTML = originalText;
        markDoneBtn.disabled = false;
      }, 2000);
    }
  };

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

  document.getElementById('importBtn').onclick = async () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const it of items) await localAdapter.upsert(it);
      renderItems(await localAdapter.getAll());
    };
    input.click();
  };

  document.getElementById('syncBtn').onclick = async () => {
    const syncBtn = document.getElementById('syncBtn');
    const originalText = syncBtn.innerHTML;
    
    syncBtn.innerHTML = '⏳ Syncing...';
    syncBtn.style.pointerEvents = 'none';
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
      if (response.success) {
        syncBtn.innerHTML = '✅ Synced!';
        // Refresh connection status after successful sync
        await checkConnectionStatus();
        setTimeout(() => {
          syncBtn.innerHTML = originalText;
          syncBtn.style.pointerEvents = 'auto';
        }, 1500);
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (error) {
      syncBtn.innerHTML = '❌ Error';
      setTimeout(() => {
        syncBtn.innerHTML = originalText;
        syncBtn.style.pointerEvents = 'auto';
      }, 2000);
    }
  };

  document.getElementById('archiveBtn').onclick = async () => {
    const archiveBtn = document.getElementById('archiveBtn');
    const originalText = archiveBtn.innerHTML;
    
    archiveBtn.innerHTML = '⏳ Archiving...';
    archiveBtn.style.pointerEvents = 'none';
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_ARCHIVE' });
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

  document.getElementById('statsBtn').onclick = async () => {
    const statsBtn = document.getElementById('statsBtn');
    const originalText = statsBtn.innerHTML;
    
    statsBtn.innerHTML = '⏳ Loading...';
    statsBtn.style.pointerEvents = 'none';
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
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
}

document.addEventListener('DOMContentLoaded', init);

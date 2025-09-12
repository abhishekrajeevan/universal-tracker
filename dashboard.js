async function getAllItems() {
  return await localAdapter.getAll();
}

function hostFor(item) {
  try {
    return item.url ? new URL(item.url).hostname : '';
  } catch { return ''; }
}

function matchesFilters(item, filters) {
  if (filters.status && item.status !== filters.status) return false;
  if (filters.category && item.category !== filters.category) return false;
  if (filters.priority && (item.priority || '').toLowerCase() !== filters.priority) return false;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = [item.title, item.notes, (item.tags||[]).join(' ')].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (filters.tags.length) {
    const itemTags = (item.tags || []).map(t => t.toLowerCase());
    for (const t of filters.tags) {
      if (!itemTags.includes(t)) return false;
    }
  }
  return true;
}

function uniqueTags(items) {
  const set = new Set();
  for (const it of items) {
    (it.tags||[]).forEach(t => set.add(t));
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function renderTagChips(allTags, onPick) {
  const wrap = document.getElementById('tagChips');
  wrap.innerHTML = '';
  allTags.slice(0, 30).forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = t;
    btn.onclick = () => onPick(t);
    wrap.appendChild(btn);
  });
}

function priorityWeight(p){
  switch((p||'').toLowerCase()){
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function renderList(items, sortKey) {
  const list = document.getElementById('list');
  const count = document.getElementById('count');
  list.innerHTML = '';
  count.textContent = `${items.length} item${items.length===1?'':'s'}`;

  if (!items.length) {
    list.innerHTML = '<div class="empty">No items match your filters.</div>';
    return;
  }

  const sorted = items.slice();
  const key = sortKey || 'updated_desc';
  const cmpDate = (a,b,field,dir) => {
    const av = a[field] || '';
    const bv = b[field] || '';
    return dir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  };
  if (key.startsWith('updated_')) sorted.sort((a,b)=>cmpDate(a,b,'updated_at', key.endsWith('asc')?'asc':'desc'));
  else if (key.startsWith('created_')) sorted.sort((a,b)=>cmpDate(a,b,'added_at', key.endsWith('asc')?'asc':'desc'));
  else if (key.startsWith('priority_')) sorted.sort((a,b)=>{
    const diff = priorityWeight(a.priority) - priorityWeight(b.priority);
    return key.endsWith('asc') ? diff : -diff;
  });
  for (const it of sorted) {
    const div = document.createElement('div');
    div.className = 'item';
    const host = hostFor(it);
    const prio = (it.priority||'').toLowerCase();
    div.innerHTML = `
      <div class="item-title">
        ${it.title || '(untitled)'}
        <span class="pill ${it.status==='done'?'done':'todo'}">${it.status==='done'?'Done':'To Do'}</span>
        ${prio ? `<span class="pill ${prio==='high'?'prio-high':prio==='medium'?'prio-medium':'prio-low'}">${(it.priority||'').charAt(0).toUpperCase()+ (it.priority||'').slice(1)}</span>` : ''}
      </div>
      <div class="meta">
        <span>${it.category || 'Other'}</span>
        ${host ? `<span>• ${host}</span>` : ''}
        ${(it.tags && it.tags.length) ? `<span>• ${it.tags.join(', ')}</span>` : ''}
        ${(it.reminder_time) ? `<span>• Reminder: ${new Date(it.reminder_time).toLocaleString()}</span>` : ''}
      </div>
      <div class="item-actions">
        <button class="action-btn ${it.status==='done'?'':'solid'}" data-act="toggle" data-id="${it.id}">${it.status==='done'?'Mark To Do':'Mark Done'}</button>
        <button class="action-btn danger" data-act="delete" data-id="${it.id}">Delete</button>
        ${it.url ? `<a class="link" href="${it.url}" target="_blank">Open</a>` : ''}
      </div>
    `;
    list.appendChild(div);
  }

  list.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-act');
    const items = await getAllItems();
    const it = items.find(x => x.id === id);
    if (!it) return;
    if (act === 'toggle') {
      it.status = it.status === 'done' ? 'todo' : 'done';
      it.updated_at = nowISO();
      it.completed_at = it.status === 'done' ? nowISO() : null;
      await localAdapter.upsert(it);
      await queueAdapter.enqueue(it);
    } else if (act === 'delete') {
      if (confirm('Delete this item?')) {
        await queueAdapter.enqueue({ op: 'delete', id });
        await localAdapter.remove(id);
      }
    }
    // Re-render after any action
    const updated = await getAllItems();
    applyFiltersAndRender(updated);
  };
}

function readFiltersFromUI() {
  const search = document.getElementById('search').value.trim();
  const status = document.getElementById('status').value;
  const category = document.getElementById('category').value;
  const priority = document.getElementById('priority')?.value || '';
  const sort = document.getElementById('sort')?.value || 'updated_desc';
  const tagsRaw = document.getElementById('tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
  return { search, status, category, priority, sort, tags };
}

function applyFiltersAndRender(items) {
  const filters = readFiltersFromUI();
  const filtered = items.filter(it => matchesFilters(it, filters));
  renderList(filtered, filters.sort);
}

async function init() {
  // Buttons
  const syncBtn = document.getElementById('syncBtn');
  const syncSpinner = document.getElementById('syncSpinner');
  const syncText = document.getElementById('syncText');
  // Compact toggle init
  try {
    const prefs = await (window.getUIPrefs ? getUIPrefs() : Promise.resolve({}));
    if (prefs.dashboard_compact) document.body.classList.add('compact');
    const ct = document.getElementById('compactToggle');
    if (ct) {
      ct.checked = !!prefs.dashboard_compact;
      ct.addEventListener('change', async () => {
        document.body.classList.toggle('compact', ct.checked);
        if (window.setUIPrefs) await setUIPrefs({ dashboard_compact: ct.checked });
      });
    }
  } catch {}
  document.getElementById('syncBtn').onclick = async () => {
    try {
      syncBtn.disabled = true;
      // Show in-button spinner and change text
      if (syncSpinner) {
        syncSpinner.classList.remove('hidden');
      }
      if (syncText) syncText.textContent = 'Syncing…';
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, (resp) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (resp && resp.success) resolve(); else reject(new Error((resp && resp.error) || 'Sync failed'));
        });
      });
      const items = await getAllItems();
      applyFiltersAndRender(items);
      if (window.showToast) showToast('Synced', 'success');
    } catch (e) {
      alert('Sync failed: ' + e.message);
    } finally {
      syncBtn.disabled = false;
      if (syncSpinner) syncSpinner.classList.add('hidden');
      if (syncText) syncText.textContent = 'Sync Now';
    }
  };

  document.getElementById('exportBtn').onclick = async () => {
    const items = await getAllItems();
    const blob = new Blob([JSON.stringify({ items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    if (chrome.downloads) chrome.downloads.download({ url, filename: 'universal-tracker-export.json' });
    else window.open(url);
  };

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
        if (data && Array.isArray(data.items)) {
          for (const it of data.items) await localAdapter.upsert(it);
          const items = await getAllItems();
          applyFiltersAndRender(items);
          if (window.showToast) showToast('Import complete', 'success');
        } else {
          if (window.showToast) showToast('Invalid file', 'error');
        }
      } catch(e){ if (window.showToast) showToast('Import failed: ' + e.message, 'error'); }
    };
    input.click();
  };

  // Filters events
  ['search','status','category','priority','sort','tags'].forEach(id => document.getElementById(id).addEventListener('input', async () => {
    const items = await getAllItems();
    applyFiltersAndRender(items);
  }));

  // Initial data
  const items = await getAllItems();
  renderTagChips(uniqueTags(items), tag => {
    const tagsInput = document.getElementById('tags');
    const existing = tagsInput.value.trim();
    tagsInput.value = existing ? `${existing}, ${tag}` : tag;
    applyFiltersAndRender(items);
  });
  applyFiltersAndRender(items);
}

document.addEventListener('DOMContentLoaded', init);

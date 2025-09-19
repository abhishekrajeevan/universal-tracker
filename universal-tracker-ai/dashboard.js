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
  const current = new Set((document.getElementById('tags').value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  allTags.slice(0, 50).forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (current.has(t.toLowerCase()) ? ' selected' : '');
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
      ${it.notes ? `<div class="notes">${it.notes.length>500?it.notes.slice(0,500)+"…":it.notes}</div>` : ''}
      <div class="item-actions">
        <button class="action-btn ${it.status==='done'?'':'solid'}" data-act="toggle" data-id="${it.id}">${it.status==='done'?'Mark To Do':'Mark Done'}</button>
        <button class="action-btn danger" data-act="delete" data-id="${it.id}">Delete</button>
        <button class="action-btn" data-act="edit" data-id="${it.id}">Edit</button>
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
    } else if (act === 'edit') {
      openEditModal(it);
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
  const statsbar = document.getElementById('statsbar');
  if (statsbar) {
    const total = filtered.length;
    const done = filtered.filter(i => i.status === 'done').length;
    const todo = total - done;
    statsbar.textContent = `Filtered: ${total} • Done: ${done} • To Do: ${todo}`;
  }
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
      const items1 = await getAllItems();
      applyFiltersAndRender(items1);
      // Pull from backend to reflect remote deletions
      try {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'PULL_ALL' }, (resp) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (resp && resp.success) resolve(); else reject(new Error((resp && resp.error) || 'Pull failed'));
          });
        });
        const items2 = await getAllItems();
        applyFiltersAndRender(items2);
      } catch {}
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
    if (chrome.downloads) { const downloadId = await new Promise(resolve => chrome.downloads.download({ url, filename: 'universal-tracker-export.json' }, resolve)); try { const listener = (delta) => { if (delta && delta.id === downloadId && delta.state && delta.state.current === 'complete') { if (window.showToast) showToast('Exported', 'success'); chrome.downloads.onChanged.removeListener(listener); } }; chrome.downloads.onChanged.addListener(listener); } catch {} } else { window.open(url); if (window.showToast) showToast('Exported', 'success'); }


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

  // Tag chip toggle: keep UI selection in sync with input
  document.getElementById('tagChips').addEventListener('click', async (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const t = btn.textContent.trim();
    const input = document.getElementById('tags');
    const cur = new Set((input.value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
    const key = t.toLowerCase();
    if (cur.has(key)) cur.delete(key); else cur.add(key);
    input.value = Array.from(cur).join(', ');
    renderTagChips(uniqueTags(await getAllItems()), () => {});
    const items = await getAllItems();
    applyFiltersAndRender(items);
  });

  // Stats button
  const statsBtn = document.getElementById('statsBtn');
  if (statsBtn) statsBtn.addEventListener('click', async () => {
    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_STATS' }, (r) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(r);
        });
      });
      if (resp && resp.success) {
        const modal = document.getElementById('editModal'); // reuse modal shell styles
        const title = document.querySelector('#editModal header span');
        const body = document.querySelector('#editModal .body');
        const footer = document.querySelector('#editModal .footer');
        title.textContent = 'Stats';
        body.innerHTML = `<div><strong>Total:</strong> ${resp.stats.total}</div>
          <div><strong>Active (local view may differ):</strong> ${resp.stats.active}</div>
          <div><strong>Archived:</strong> ${resp.stats.archived}</div>
          <div><strong>Archive Sheets:</strong> ${resp.stats.archiveSheets}</div>`;
        footer.innerHTML = '<button id="editSave" class="btn btn-primary">Close</button>';
        document.getElementById('editSave').onclick = () => { modal.style.display='none'; };
        document.getElementById('editClose').onclick = () => { modal.style.display='none'; };
        modal.style.display = 'flex';
      }
    } catch (e) { if (window.showToast) showToast('Stats failed: ' + e.message, 'error'); }
  });

  // Reset filters
  const resetBtn = document.getElementById('resetFilters');
  if (resetBtn) resetBtn.addEventListener('click', async () => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('search',''); setVal('status',''); setVal('category',''); setVal('priority',''); setVal('sort','updated_desc'); setVal('tags','');
    const items = await getAllItems();
    applyFiltersAndRender(items);
    if (window.showToast) showToast('Filters reset', 'success');
  });

  // Initial data
  const items = await getAllItems();
  renderTagChips(uniqueTags(items), tag => {
    const tagsInput = document.getElementById('tags');
    const cur = new Set((tagsInput.value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
    const key = tag.toLowerCase();
    if (cur.has(key)) cur.delete(key); else cur.add(key);
    tagsInput.value = Array.from(cur).join(', ');
    applyFiltersAndRender(items);
  });
  applyFiltersAndRender(items);
}

document.addEventListener('DOMContentLoaded', init);

// Edit modal helpers
function openEditModal(item){
  const modal = document.getElementById('editModal');
  const title = document.getElementById('editTitle');
  const category = document.getElementById('editCategory');
  const priority = document.getElementById('editPriority');
  const tags = document.getElementById('editTags');
  const notes = document.getElementById('editNotes');
  const status = document.getElementById('editStatus');
  const close = document.getElementById('editClose');
  const save = document.getElementById('editSave');
  document.querySelector('#editModal header span').textContent = 'Edit Item';
  document.querySelector('#editModal .footer').innerHTML = '<button id="editSave" class="btn btn-primary">Save</button>';
  title.value = item.title || '';
  category.value = item.category || 'Other';
  priority.value = item.priority || 'medium';
  tags.value = (item.tags||[]).join(', ');
  notes.value = item.notes || '';
  status.value = item.status || 'todo';
  const closeFn = ()=>{ modal.style.display='none'; };
  close.onclick = closeFn;
  modal.style.display = 'flex';
  document.getElementById('editSave').onclick = async () => {
    item.title = title.value.trim();
    item.category = category.value;
    item.priority = priority.value;
    item.tags = (tags.value||'').split(',').map(s=>s.trim()).filter(Boolean);
    item.notes = notes.value.trim();
    item.status = status.value;
    item.updated_at = nowISO();
    if (item.status === 'done' && !item.completed_at) item.completed_at = nowISO();
    if (item.status !== 'done') item.completed_at = null;
    await localAdapter.upsert(item);
    await queueAdapter.enqueue(item);
    const items = await getAllItems();
    applyFiltersAndRender(items);
    modal.style.display='none';
    if (window.showToast) showToast('Item updated', 'success');
  };
}




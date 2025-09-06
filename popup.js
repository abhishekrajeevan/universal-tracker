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

function renderItems(items) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  const sorted = items.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  for (const it of sorted) {
    const host = (it.source || (it.url ? new URL(it.url).hostname : ''));
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="title">${it.title || '(untitled)'} <span class="pill">${it.status}</span></div>
      <div class="meta">${it.category || 'Other'} · ${host}</div>
      <div class="actions">
        <button class="btn btn-secondary btn-small" data-act="toggle" data-id="${it.id}">${it.status==='done'?'Mark To Do':'Mark Done'}</button>
        <button class="btn btn-secondary btn-small" data-act="remove" data-id="${it.id}">Delete</button>
        <a class="link" href="${it.url}" target="_blank">Open</a>
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

async function init() {
  const meta = await getMetadata();
  document.getElementById('pageMeta').textContent = `${meta.siteName} • ${meta.url}`;
  document.getElementById('title').value = meta.title || '';

  renderItems(await localAdapter.getAll());

  document.getElementById('saveBtn').onclick = async () => {
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
    renderItems(await localAdapter.getAll());
  };

  document.getElementById('markDoneBtn').onclick = async () => {
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
    renderItems(await localAdapter.getAll());
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
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
  };
}

document.addEventListener('DOMContentLoaded', init);

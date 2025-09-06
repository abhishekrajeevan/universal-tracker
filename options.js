const OPTS_KEY = "options";
async function getLocal(key){ return (await chrome.storage.local.get([key]))[key]; }
async function setLocal(key,val){ return chrome.storage.local.set({[key]:val}); }

document.getElementById('saveBtn').onclick = async () => {
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  const originalText = saveBtn.innerHTML;
  
  // Visual feedback
  saveBtn.innerHTML = '⏳ Saving...';
  saveBtn.disabled = true;
  statusEl.style.display = 'none';
  
  try {
    const url = document.getElementById('appsScriptUrl').value.trim();
    const mins = Number(document.getElementById('autosync').value);
    
    // Validation
    if (url && !url.startsWith('https://script.google.com/')) {
      throw new Error('Please enter a valid Google Apps Script URL');
    }
    
    const opts = (await getLocal(OPTS_KEY)) || {};
    opts.apps_script_url = url;
    opts.autosync_mins = Math.max(5, mins || 10);
    await setLocal(OPTS_KEY, opts);
    
    // Success feedback
    saveBtn.innerHTML = '✅ Saved!';
    statusEl.innerHTML = `Settings saved successfully! Auto-sync will run every ${opts.autosync_mins} minutes.`;
    statusEl.className = 'status-success';
    statusEl.style.display = 'block';
    
    chrome.alarms.create("autosync", { periodInMinutes: opts.autosync_mins });
    
    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    // Error feedback
    saveBtn.innerHTML = '❌ Error';
    statusEl.innerHTML = `Error: ${error.message}`;
    statusEl.className = 'status-error';
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }, 3000);
  }
};

// Test connection to Apps Script
document.getElementById('testConnectionBtn').onclick = async () => {
  const btn = document.getElementById('testConnectionBtn');
  const originalText = btn.innerHTML;
  
  btn.innerHTML = '⏳ Testing...';
  btn.disabled = true;
  
  try {
    const url = document.getElementById('appsScriptUrl').value.trim();
    if (!url) {
      throw new Error('Please enter an Apps Script URL first');
    }
    
    const response = await fetch(url + "/getStats", { method: "GET" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    
    const result = await response.json();
    alert(`✅ Connection successful!\n\n` +
          `Active Items: ${result.active}\n` +
          `Archived Items: ${result.archived}\n` +
          `Total Items: ${result.total}`);
    
    btn.innerHTML = '✅ Connected';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
    
  } catch (error) {
    alert(`❌ Connection failed: ${error.message}`);
    btn.innerHTML = '❌ Failed';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
  }
};

// View statistics
document.getElementById('viewStatsBtn').onclick = async () => {
  const btn = document.getElementById('viewStatsBtn');
  const originalText = btn.innerHTML;
  
  btn.innerHTML = '⏳ Loading...';
  btn.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (response.success) {
      const stats = response.stats;
      alert(`📊 Storage Statistics:\n\n` +
            `Active Items: ${stats.active}\n` +
            `Archived Items: ${stats.archived}\n` +
            `Total Items: ${stats.total}\n` +
            `Archive Sheets: ${stats.archiveSheets}\n\n` +
            `💡 Tip: Items older than 6 months are automatically archived to keep your active sheet fast.`);
    } else {
      throw new Error(response.error || 'Failed to get stats');
    }
  } catch (error) {
    alert(`Error getting statistics: ${error.message}`);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

// Trigger manual archive
document.getElementById('triggerArchiveBtn').onclick = async () => {
  const btn = document.getElementById('triggerArchiveBtn');
  const originalText = btn.innerHTML;
  
  if (!confirm('This will archive items older than 6 months to separate sheets. Continue?')) {
    return;
  }
  
  btn.innerHTML = '⏳ Archiving...';
  btn.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_ARCHIVE' });
    if (response.success) {
      alert(`✅ Archive completed!\n\n${response.message}`);
      btn.innerHTML = '✅ Archived';
    } else {
      throw new Error(response.error || 'Archive failed');
    }
  } catch (error) {
    alert(`❌ Archive failed: ${error.message}`);
    btn.innerHTML = '❌ Failed';
  } finally {
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
  }
};

(async function init(){
  const opts = (await getLocal(OPTS_KEY)) || {};
  document.getElementById('appsScriptUrl').value = opts.apps_script_url || "";
  document.getElementById('autosync').value = opts.autosync_mins || 10;
})();

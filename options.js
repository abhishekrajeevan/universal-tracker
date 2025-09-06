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

(async function init(){
  const opts = (await getLocal(OPTS_KEY)) || {};
  document.getElementById('appsScriptUrl').value = opts.apps_script_url || "";
  document.getElementById('autosync').value = opts.autosync_mins || 10;
})();

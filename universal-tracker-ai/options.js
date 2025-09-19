const OPTS_KEY = "options";
const AI_OPTS_KEY = "ai_options"; // { api_key, prefill_title, prefill_category, prefill_priority, prefill_tags, prefill_summary }
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
    const aiKey = (document.getElementById('aiApiKey')?.value || '').trim();
    const aiPrefill = {
      api_key: aiKey,
      prefill_title: !!document.getElementById('aiPrefillTitle')?.checked,
      prefill_category: !!document.getElementById('aiPrefillCategory')?.checked,
      prefill_priority: !!document.getElementById('aiPrefillPriority')?.checked,
      prefill_tags: !!document.getElementById('aiPrefillTags')?.checked,
      prefill_summary: !!document.getElementById('aiPrefillSummary')?.checked
    };
    
    // Validation
    if (url && !url.startsWith('https://script.google.com/')) {
      throw new Error('Please enter a valid Google Apps Script URL');
    }
    
    const opts = (await getLocal(OPTS_KEY)) || {};
    opts.apps_script_url = url;
    opts.autosync_mins = Math.max(5, mins || 10);
    await setLocal(OPTS_KEY, opts);
    await setLocal(AI_OPTS_KEY, aiPrefill);
    
    // Success feedback
    saveBtn.innerHTML = '✅ Saved!';
    statusEl.innerHTML = `Settings saved successfully! Auto-sync every ${opts.autosync_mins} min${opts.autosync_mins==1?'':'s'}.`;
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
    
    // Validate URL format
    if (!url.startsWith('https://script.google.com/')) {
      throw new Error('URL must start with https://script.google.com/');
    }
    
    if (!url.endsWith('/exec')) {
      throw new Error('URL must end with /exec');
    }
    
    // Test the connection
    const response = await fetch(url + "/getStats", { 
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Access denied. Make sure your Apps Script is deployed with "Anyone" access.');
      } else if (response.status === 404) {
        throw new Error('Not found. Check that your Apps Script is deployed as a Web App.');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }
    
    const result = await response.json();
    
    // Show detailed success message
    const message = `✅ Connection successful!\n\n` +
          `📊 Current Statistics:\n` +
          `• Active Items: ${result.active}\n` +
          `• Archived Items: ${result.archived}\n` +
          `• Total Items: ${result.total}\n` +
          `• Archive Sheets: ${result.archiveSheets}\n\n` +
          `🎉 Your Universal Tracker is ready to use!`;
    
    alert(message);
    
    btn.innerHTML = '✅ Connected';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
    
  } catch (error) {
    let errorMessage = `❌ Connection failed: ${error.message}\n\n`;
    
    if (error.message.includes('fetch')) {
      errorMessage += `💡 Troubleshooting tips:\n` +
                     `• Check your internet connection\n` +
                     `• Verify the URL is correct\n` +
                     `• Make sure the Apps Script is deployed\n` +
                     `• Try refreshing the Apps Script deployment`;
    } else if (error.message.includes('Access denied')) {
      errorMessage += `💡 To fix this:\n` +
                     `• Go to your Apps Script editor\n` +
                     `• Click Deploy → Manage deployments\n` +
                     `• Edit the deployment\n` +
                     `• Set "Who has access" to "Anyone"`;
    } else if (error.message.includes('Not found')) {
      errorMessage += `💡 To fix this:\n` +
                     `• Make sure you deployed as a Web App\n` +
                     `• Check that the URL ends with /exec\n` +
                     `• Try redeploying the Apps Script`;
    }
    
    alert(errorMessage);
    btn.innerHTML = '❌ Failed';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
  }
};

// Test AI integration
document.getElementById('testAiBtn').onclick = async () => {
  const btn = document.getElementById('testAiBtn');
  const original = btn.innerHTML;
  btn.innerHTML = '… Testing';
  btn.disabled = true;
  try {
    const r = await new Promise((resolve,reject)=>{
      chrome.runtime.sendMessage({ type:'TEST_AI' }, (resp) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(resp);
      });
    });
    if (r && r.success) alert('AI test ok: ' + JSON.stringify(r.suggestions));
    else throw new Error((r && r.error) || 'AI test failed');
  } catch(e){ alert('AI test failed: ' + e.message); }
  finally { btn.innerHTML = original; btn.disabled = false; }
};

// View statistics
document.getElementById('viewStatsBtn').onclick = async () => {
  const btn = document.getElementById('viewStatsBtn');
  const originalText = btn.innerHTML;
  
  btn.innerHTML = '⏳ Loading...';
  btn.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (response && response.success) {
      const stats = response.stats;
      alert(`📊 Storage Statistics:\n\n` +
            `Active Items: ${stats.active}\n` +
            `Archived Items: ${stats.archived}\n` +
            `Total Items: ${stats.total}\n` +
            `Archive Sheets: ${stats.archiveSheets}\n\n` +
            `💡 Tip: Items older than 6 months are automatically archived to keep your active sheet fast.`);
    } else {
      throw new Error((response && response.error) || 'Failed to get stats');
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
    if (response && response.success) {
      alert(`✅ Archive completed!\n\n${response.message}`);
      btn.innerHTML = '✅ Archived';
    } else {
      throw new Error((response && response.error) || 'Archive failed');
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

// Setup guide link
document.getElementById('setupGuideLink').onclick = (e) => {
  e.preventDefault();
  
  const guide = `🚀 Universal Tracker Setup Guide

📋 Step 1: Create Google Spreadsheet
• Go to sheets.google.com
• Create a new blank spreadsheet
• Name it "Universal Tracker"

📋 Step 2: Set Up Apps Script
• In your spreadsheet: Extensions → Apps Script
• Delete default code and paste the Code.gs content
• Save the project

📋 Step 3: Deploy as Web App
• Click Deploy → New deployment
• Choose "Web app" as type
• Set "Execute as": Me
• Set "Who has access": Anyone
• Click Deploy and COPY the URL

📋 Step 4: Configure Extension
• Paste the URL in the field below
• Set sync interval (default: 10 minutes)
• Click Save Settings

📋 Step 5: Test Connection
• Click "Test Connection" button
• You should see success message

🎉 That's it! Your tracker is ready to use.

Need more help? Check the SETUP_GUIDE.md file in your extension folder.`;

  alert(guide);
};

(async function init(){
  const opts = (await getLocal(OPTS_KEY)) || {};
  document.getElementById('appsScriptUrl').value = opts.apps_script_url || "";
  document.getElementById('autosync').value = opts.autosync_mins || 10;
  const ai = (await getLocal(AI_OPTS_KEY)) || {};
  const setIf = (id,val)=>{ const el = document.getElementById(id); if (el!=null) el.value = val; };
  const setCk = (id,val)=>{ const el = document.getElementById(id); if (el!=null) el.checked = !!val; };
  setIf('aiApiKey', ai.api_key || '');
  setCk('aiPrefillTitle', ai.prefill_title);
  setCk('aiPrefillCategory', ai.prefill_category);
  setCk('aiPrefillPriority', ai.prefill_priority);
  setCk('aiPrefillTags', ai.prefill_tags);
  setCk('aiPrefillSummary', ai.prefill_summary);
})();

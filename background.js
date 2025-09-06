const LS_KEY = "items";
const QUEUE_KEY = "outbox";
const OPTS_KEY = "options"; // { apps_script_url, autosync_mins }

function nowISO(){ return new Date().toISOString(); }

async function getLocal(key){ return (await chrome.storage.local.get([key]))[key]; }
async function setLocal(key, val){ return chrome.storage.local.set({[key]: val}); }

// Basic queue for pending upserts
const queueAdapter = {
  async enqueue(item) {
    const q = (await getLocal(QUEUE_KEY)) || [];
    q.push(item);
    await setLocal(QUEUE_KEY, q);
  },
  async takeBatch(n=25) {
    const q = (await getLocal(QUEUE_KEY)) || [];
    const batch = q.splice(0, n);
    await setLocal(QUEUE_KEY, q);
    return batch;
  },
  async size(){ const q = (await getLocal(QUEUE_KEY)) || []; return q.length; }
};

// Local adapter storing canonical list
const localAdapter = {
  async getAll(){
    return (await getLocal(LS_KEY)) || [];
  },
  async upsert(incoming){
    const items = (await getLocal(LS_KEY)) || [];
    const i = items.findIndex(x => x.id === incoming.id);
    if (i === -1) items.push(incoming);
    else if (!items[i].updated_at || items[i].updated_at <= incoming.updated_at) items[i] = incoming;
    await setLocal(LS_KEY, items);
  },
  async remove(id){
    const items = (await getLocal(LS_KEY)) || [];
    const next = items.filter(x => x.id !== id);
    await setLocal(LS_KEY, next);
  }
};

async function flushOnce(){
  const opts = (await getLocal(OPTS_KEY)) || {};
  const base = opts.apps_script_url;
  console.log('flushOnce: base URL:', base);
  
  if (!base) {
    console.log('flushOnce: No Apps Script URL configured');
    return;
  }
  
  const batch = await queueAdapter.takeBatch(100); // Increased batch size
  console.log('flushOnce: batch size:', batch.length);
  
  if (!batch.length) {
    console.log('flushOnce: No items in queue to sync');
    return;
  }

  try {
    console.log('flushOnce: Sending batch to:', base + "/bulkUpsert");
    const resp = await fetch(base + "/bulkUpsert", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ items: batch })
    });
    
    console.log('flushOnce: Response status:', resp.status);
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.log('flushOnce: Error response:', errorText);
      throw new Error("HTTP " + resp.status + ": " + errorText.substring(0, 200));
    }
    
    const responseText = await resp.text();
    console.log('flushOnce: Response text:', responseText);
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('flushOnce: Failed to parse JSON:', responseText);
      throw new Error("Invalid JSON response: " + responseText.substring(0, 200));
    }
    console.log(`Synced ${result.upserted} items (${result.updated} updated, ${result.inserted} inserted)`);
  } catch (e) {
    console.error("Sync failed:", e);
    // put items back if failed
    const q = (await getLocal(QUEUE_KEY)) || [];
    await setLocal(QUEUE_KEY, batch.concat(q));
    throw e;
  }
}

let syncing = false;
async function syncLoop(){
  if (syncing) return;
  syncing = true;
  try {
    for (let i=0; i<5; i++) { // up to 5 batches per run
      const size = await queueAdapter.size();
      if (!size) break;
      await flushOnce();
    }
  } finally { syncing = false; }
}

// messages from popup
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.type === "SYNC_NOW") {
    try { 
      await syncLoop(); 
      sendResponse({success: true});
    } catch(e) {
      sendResponse({success: false, error: e.message});
    }
  } else if (msg?.type === "TRIGGER_ARCHIVE") {
    try {
      const opts = (await getLocal(OPTS_KEY)) || {};
      const base = opts.apps_script_url;
      if (!base) {
        sendResponse({success: false, error: "No Apps Script URL configured"});
        return true;
      }
      
      const resp = await fetch(base + "/triggerArchive", {
        method: "POST",
        headers: {"Content-Type":"application/json"}
      });
      
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const result = await resp.json();
      sendResponse({success: true, message: result.message});
    } catch(e) {
      sendResponse({success: false, error: e.message});
    }
    return true;
  } else if (msg?.type === "GET_STATS") {
    try {
      const opts = (await getLocal(OPTS_KEY)) || {};
      const base = opts.apps_script_url;
      if (!base) {
        sendResponse({success: false, error: "No Apps Script URL configured"});
        return true;
      }
      
      const resp = await fetch(base + "/getStats", {
        method: "GET"
      });
      
      if (!resp.ok) {
        const errorText = await resp.text();
        console.log('GET_STATS: Error response:', errorText);
        throw new Error("HTTP " + resp.status + ": " + errorText.substring(0, 200));
      }
      
      const responseText = await resp.text();
      console.log('GET_STATS: Response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
    } catch (e) {
      console.error('GET_STATS: Failed to parse JSON:', responseText);
      console.error('GET_STATS: Full response:', responseText);
      throw new Error("Invalid JSON response. Apps Script returned HTML instead of JSON. Check your deployment.");
    }
      
      sendResponse({success: true, stats: result});
    } catch(e) {
      sendResponse({success: false, error: e.message});
    }
    return true;
  } else if (msg?.type === "UPSERT_ITEM") {
    // not used in this scaffold (popup writes to local + queue directly)
  }
  
  return true; // Keep message channel open for async response
});

// periodic alarm for autosync
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "autosync") {
    try { await syncLoop(); } catch(e) {}
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const opts = (await getLocal(OPTS_KEY)) || { autosync_mins: 10 };
  await setLocal(OPTS_KEY, opts);
  chrome.alarms.create("autosync", { periodInMinutes: Math.max(5, Number(opts.autosync_mins||10)) });
});

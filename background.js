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
      console.error('flushOnce: Full response:', responseText);
      throw new Error("Invalid JSON response. Apps Script returned HTML instead of JSON. Check your deployment.");
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

// Reminder notification handler
async function handleReminderAlarm(alarmName) {
  if (!alarmName.startsWith('reminder_')) return;
  
  const itemId = alarmName.replace('reminder_', '');
  const items = await localAdapter.getAll();
  const item = items.find(x => x.id === itemId);
  
  if (!item) {
    console.log('Reminder alarm fired but item not found:', itemId);
    return;
  }
  
  // Create notification
  const notificationOptions = {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '📚 Universal Tracker Reminder',
    message: `Don't forget: ${item.title}`,
    contextMessage: `${item.category}${item.priority === 'high' ? ' • High Priority' : ''}`,
    buttons: [
      { title: 'Mark as Done' },
      { title: 'Snooze (1 hour)' }
    ],
    requireInteraction: true
  };
  
  chrome.notifications.create(`reminder_${itemId}`, notificationOptions);
  
  console.log('Reminder notification created for:', item.title);
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('reminder_')) return;
  
  const itemId = notificationId.replace('reminder_', '');
  const items = await localAdapter.getAll();
  const item = items.find(x => x.id === itemId);
  
  if (!item) return;
  
  if (buttonIndex === 0) { // Mark as Done
    item.status = 'done';
    item.completed_at = nowISO();
    item.updated_at = nowISO();
    item.reminder_time = null; // Clear reminder
    
    await localAdapter.upsert(item);
    await queueAdapter.enqueue(item);
    
    chrome.notifications.clear(notificationId);
    
    // Show success notification
    chrome.notifications.create(`done_${itemId}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '✅ Item Completed',
      message: `"${item.title}" marked as done!`,
    });
    
    // Clear the success notification after 3 seconds
    setTimeout(() => {
      chrome.notifications.clear(`done_${itemId}`);
    }, 3000);
    
  } else if (buttonIndex === 1) { // Snooze
    const snoozeTime = new Date();
    snoozeTime.setHours(snoozeTime.getHours() + 1); // Snooze for 1 hour
    
    item.reminder_time = snoozeTime.toISOString();
    item.updated_at = nowISO();
    
    await localAdapter.upsert(item);
    await queueAdapter.enqueue(item);
    
    // Schedule new reminder
    chrome.alarms.create(`reminder_${itemId}`, {
      when: snoozeTime.getTime()
    });
    
    chrome.notifications.clear(notificationId);
    
    // Show snooze notification
    chrome.notifications.create(`snooze_${itemId}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '⏰ Reminder Snoozed',
      message: `"${item.title}" reminder set for 1 hour`,
    });
    
    // Clear the snooze notification after 3 seconds
    setTimeout(() => {
      chrome.notifications.clear(`snooze_${itemId}`);
    }, 3000);
  }
});

// Clear notification on click
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
});

// messages from popup - FIXED: Return true and use async sendResponse properly
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Background received message:', msg);
  
  if (msg?.type === "TEST") {
    console.log('TEST: Sending test response');
    sendResponse({success: true, message: "Test successful"});
  } else if (msg?.type === "SYNC_NOW") {
    (async () => {
      try { 
        console.log('SYNC_NOW: Starting sync...');
        await syncLoop(); 
        console.log('SYNC_NOW: Sync completed successfully');
        sendResponse({success: true});
      } catch(e) {
        console.log('SYNC_NOW: Sync failed:', e.message);
        sendResponse({success: false, error: e.message});
      }
    })();
  } else if (msg?.type === "TRIGGER_ARCHIVE") {
    (async () => {
      try {
        const opts = (await getLocal(OPTS_KEY)) || {};
        const base = opts.apps_script_url;
        if (!base) {
          sendResponse({success: false, error: "No Apps Script URL configured"});
          return;
        }
        
        const resp = await fetch(base + "/triggerArchive", {
          method: "POST",
          headers: {"Content-Type":"application/json"}
        });
        
        if (!resp.ok) {
          const errorText = await resp.text();
          console.log('TRIGGER_ARCHIVE: Error response:', errorText);
          throw new Error("HTTP " + resp.status + ": " + errorText.substring(0, 200));
        }
        
        const responseText = await resp.text();
        console.log('TRIGGER_ARCHIVE: Response text:', responseText);
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.error('TRIGGER_ARCHIVE: Failed to parse JSON:', responseText);
          console.error('TRIGGER_ARCHIVE: Full response:', responseText);
          throw new Error("Invalid JSON response. Apps Script returned HTML instead of JSON. Check your deployment.");
        }
        
        sendResponse({success: true, message: result.message});
      } catch(e) {
        sendResponse({success: false, error: e.message});
      }
    })();
  } else if (msg?.type === "GET_STATS") {
    (async () => {
      try {
        console.log('GET_STATS: Starting request...');
        const opts = (await getLocal(OPTS_KEY)) || {};
        const base = opts.apps_script_url;
        if (!base) {
          console.log('GET_STATS: No Apps Script URL configured');
          sendResponse({success: false, error: "No Apps Script URL configured"});
          return;
        }
        
        console.log('GET_STATS: Fetching from:', base + "/getStats");
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
        
        console.log('GET_STATS: Sending response:', {success: true, stats: result});
        sendResponse({success: true, stats: result});
      } catch(e) {
        console.log('GET_STATS: Error occurred:', e.message);
        sendResponse({success: false, error: e.message});
      }
    })();
  } else if (msg?.type === "UPSERT_ITEM") {
    // not used in this scaffold (popup writes to local + queue directly)
  }
  
  return true; // Keep message channel open for async response
});

// FIXED: Auto-sync alarm handling with proper error handling and config check
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);
  
  // Handle reminder alarms
  if (alarm.name.startsWith('reminder_')) {
    await handleReminderAlarm(alarm.name);
    return;
  }
  
  // Handle auto-sync alarm
  if (alarm.name === "autosync") {
    try { 
      console.log('Auto-sync triggered by alarm');
      
      // Check if Apps Script URL is configured before trying to sync
      const opts = (await getLocal(OPTS_KEY)) || {};
      if (!opts.apps_script_url) {
        console.log('Auto-sync skipped: No Apps Script URL configured');
        return;
      }
      
      await syncLoop(); 
      console.log('Auto-sync completed');
    } catch(e) {
      console.log('Auto-sync failed:', e.message);
    }
  }
});

// FIXED: Proper alarm setup on install/startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');
  await setupAutoSync();
  await rescheduleReminders(); // Reschedule existing reminders
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  await setupAutoSync();
  await rescheduleReminders(); // Reschedule existing reminders
});

async function setupAutoSync() {
  const opts = (await getLocal(OPTS_KEY)) || { autosync_mins: 10 };
  await setLocal(OPTS_KEY, opts);
  
  // Clear existing alarm first
  await chrome.alarms.clear("autosync");
  
  const interval = Math.max(5, Number(opts.autosync_mins||10));
  console.log('Setting up autosync alarm with interval:', interval, 'minutes');
  
  // Create alarm with proper periodInMinutes
  await chrome.alarms.create("autosync", { 
    periodInMinutes: interval,
    delayInMinutes: interval // Start first sync after interval
  });
  
  // Verify alarm was created
  const alarm = await chrome.alarms.get("autosync");
  if (alarm) {
    console.log('Autosync alarm created successfully:', alarm);
  } else {
    console.error('Failed to create autosync alarm');
  }
}

// Reschedule reminders after browser restart
async function rescheduleReminders() {
  console.log('Rescheduling reminders...');
  const items = await localAdapter.getAll();
  let rescheduledCount = 0;
  
  for (const item of items) {
    if (item.reminder_time) {
      const reminderTime = new Date(item.reminder_time);
      const now = new Date();
      
      // Only reschedule future reminders
      if (reminderTime > now) {
        chrome.alarms.create(`reminder_${item.id}`, {
          when: reminderTime.getTime()
        });
        rescheduledCount++;
      }
    }
  }
  
  console.log(`Rescheduled ${rescheduledCount} reminders`);
}
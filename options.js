const OPTS_KEY = "options";
async function getLocal(key){ return (await chrome.storage.local.get([key]))[key]; }
async function setLocal(key,val){ return chrome.storage.local.set({[key]:val}); }

document.getElementById('saveBtn').onclick = async () => {
  const url = document.getElementById('appsScriptUrl').value.trim();
  const mins = Number(document.getElementById('autosync').value);
  const opts = (await getLocal(OPTS_KEY)) || {};
  opts.apps_script_url = url;
  opts.autosync_mins = Math.max(5, mins || 10);
  await setLocal(OPTS_KEY, opts);
  document.getElementById('status').innerHTML = '<p class="ok">Saved. Autosync will run every '+opts.autosync_mins+' minutes.</p>';
  chrome.alarms.create("autosync", { periodInMinutes: opts.autosync_mins });
};

(async function init(){
  const opts = (await getLocal(OPTS_KEY)) || {};
  document.getElementById('appsScriptUrl').value = opts.apps_script_url || "";
  document.getElementById('autosync').value = opts.autosync_mins || 10;
})();

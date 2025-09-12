function nowISO(){ return new Date().toISOString(); }
function uuid() {
  // RFC4122-ish v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function cleanTitle(t){
  const parts=t.split(/[\|\-–—:·»]/).map(s=>s.trim()).filter(Boolean);
  const filtered=parts.filter(p=>p.length>3 && !/^(IMDb|YouTube|Netflix|Prime Video|Hotstar|Wikipedia)$/i.test(p));
  return (filtered[0]||parts[0]||t||"").trim();
}
function splitTags(s){ return s.split(',').map(x=>x.trim()).filter(Boolean); }

// Toasts (reusable across popup and dashboard)
function ensureToastStyles(){
  if (document.getElementById('toast-styles')) return;
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    .toast-container{position:fixed;z-index:2147483647;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px}
    .toast{min-width:180px;max-width:360px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#111;background:#fff;border:1px solid #e5e7eb;box-shadow:0 6px 24px rgba(0,0,0,.12);opacity:0;transform:translateY(6px);transition:opacity .2s ease, transform .2s ease}
    .toast.show{opacity:1;transform:translateY(0)}
    .toast-success{border-color:#bbf7d0;background:#f0fdf4;color:#065f46}
    .toast-error{border-color:#fecaca;background:#fef2f2;color:#991b1b}
    .toast-info{border-color:#dbeafe;background:#eff6ff;color:#1e40af}
  `;
  document.head.appendChild(style);
}
function ensureToastContainer(){
  ensureToastStyles();
  let el = document.querySelector('.toast-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}
function showToast(message, type='info', duration=2000){
  try{
    const c = ensureToastContainer();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = message;
    c.appendChild(t);
    // Force layout then show
    requestAnimationFrame(()=>{ t.classList.add('show'); });
    setTimeout(()=>{
      t.classList.remove('show');
      setTimeout(()=>{ t.remove(); }, 200);
    }, duration);
  }catch{}
}

// UI preferences shared helper
const UI_PREFS_KEY = 'ui_prefs';
async function getUIPrefs(){
  try {
    const v = await chrome.storage.local.get([UI_PREFS_KEY]);
    return v[UI_PREFS_KEY] || {};
  } catch { return {}; }
}
async function setUIPrefs(patch){
  const cur = await getUIPrefs();
  const next = Object.assign({}, cur, patch);
  const obj = {}; obj[UI_PREFS_KEY] = next;
  await chrome.storage.local.set(obj);
  return next;
}

// Expose helpers globally
window.showToast = showToast;
window.getUIPrefs = getUIPrefs;
window.setUIPrefs = setUIPrefs;

// Expose localAdapter & queueAdapter to popup via background messaging?
// For simplicity in this scaffold, popup imports adapters.js directly.

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

// Expose localAdapter & queueAdapter to popup via background messaging?
// For simplicity in this scaffold, popup imports adapters.js directly.

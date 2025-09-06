function pick(sel, attr="content"){const el=document.querySelector(sel);return el?(attr==="text"?el.textContent.trim():el.getAttribute(attr)||""): "";}
function pickJSONLDName(){
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent); const arr = Array.isArray(data)?data:[data];
      for (const d of arr) {
        if (typeof d?.name === "string" && d.name.trim()) return d.name.trim();
        if (Array.isArray(d?.['@graph'])) for (const g of d['@graph']) if (g?.name) return g.name.trim();
      }
    } catch {}
  }
  return "";
}
function cleanTitle(t){
  const parts=t.split(/[\|\-–—:·»]/).map(s=>s.trim()).filter(Boolean);
  const filtered=parts.filter(p=>p.length>3 && !/^(IMDb|YouTube|Netflix|Prime Video|Hotstar|Wikipedia)$/i.test(p));
  return (filtered[0]||parts[0]||t||"").trim();
}
function bestTitle(){
  return cleanTitle(
    pick('meta[property="og:title"]') ||
    pick('meta[name="twitter:title"]') ||
    pickJSONLDName() ||
    pick('h1','text') ||
    document.title || ""
  );
}
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg?.type === "GET_PAGE_METADATA") {
    send({
      title: bestTitle(),
      url:  pick('meta[property="og:url"]') || document.querySelector('link[rel="canonical"]')?.href || location.href,
      siteName: pick('meta[property="og:site_name"]') || location.hostname
    });
  }
});

// content.js — OTT/YouTube aware metadata + SPA handling

/* ------------------ helpers ------------------ */
function pick(sel, attr = "content") {
  const el = document.querySelector(sel);
  return el ? (attr === "text" ? (el.textContent || "").trim() : (el.getAttribute(attr) || "")) : "";
}

function cleanTitle(t) {
  if (!t) return "";
  const parts = t.split(/[|\-–—:·»]/).map(s => s.trim()).filter(Boolean);
  const filtered = parts.filter(p => p.length > 3 && !/^(IMDb|YouTube|Netflix|Prime Video|Amazon|Hotstar|Disney\+|Wikipedia)$/i.test(p));
  return (filtered[0] || parts[0] || t).trim();
}

function parseJSONSafely(txt) {
  try { return JSON.parse(txt); } catch { return null; }
}

/* ------------------ JSON-LD scan ------------------ */
function extractFromJSONLD() {
  // Return array of {name,type,url} candidates
  const out = [];
  const nodes = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of nodes) {
    const data = parseJSONSafely(s.textContent);
    if (!data) continue;
    const arr = Array.isArray(data) ? data : [data];
    for (const root of arr) {
      const visit = (obj) => {
        if (!obj || typeof obj !== "object") return;
        const type = typeof obj["@type"] === "string" ? obj["@type"] : Array.isArray(obj["@type"]) ? obj["@type"][0] : "";
        const name = typeof obj.name === "string" ? obj.name.trim() : "";
        const url  = typeof obj.url  === "string" ? obj.url.trim()  : "";
        if (name) out.push({ name, type, url });
        if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
        if (Array.isArray(obj.itemListElement)) obj.itemListElement.forEach(visit);
      };
      visit(root);
    }
  }
  return out;
}

/* ------------------ URL selection ------------------ */
function bestCanonicalOrHref() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href || pick('meta[property="og:url"]') || "";
  try {
    const u = canonical ? new URL(canonical, location.href) : null;
    if (u && u.hostname === location.hostname && u.pathname && u.pathname !== "/" && !/\/(home|browse|feed)(\/|$)/i.test(u.pathname)) {
      return u.href;
    }
  } catch {}
  return location.href;
}

function ytDeepURL(u) {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch" && url.searchParams.get("v")) return url.href;
      if (url.pathname.startsWith("/shorts/")) return url.href;
      // If canonical lied, use current
      const cur = new URL(location.href);
      if (cur.pathname === "/watch" && cur.searchParams.get("v")) return cur.href;
      if (cur.pathname.startsWith("/shorts/")) return cur.href;
    }
  } catch {}
  return u;
}

/* ------------------ Category inference ------------------ */
function inferCategory(host, ldCandidates, titleGuess) {
  const hasType = (t) => ldCandidates.some(x => (x.type || "").toLowerCase().includes(t));
  if (hasType("movie")) return "Movie";
  if (hasType("tvseries") || hasType("tvseriesseason") || hasType("tvseason") || hasType("episode")) return "TV";
  if (/youtube\.com$/i.test(host)) return "Video";
  if (/vimeo\.com$/i.test(host)) return "Video";
  if (/medium\.com|substack\.com|wordpress\.com|blogspot\.|hashnode\.dev|dev\.to/i.test(host)) return "Blog";
  // title-based weak hint
  if (/\btrailer\b/i.test(titleGuess)) return "Video";
  return "Other";
}

/* ------------------ Title selection ------------------ */
function bestTitle(host, ldCandidates) {
  // Prefer JSON-LD names for OTT
  const ldName = ldCandidates.find(x => x.name)?.name;
  const og = pick('meta[property="og:title"]');
  const tw = pick('meta[name="twitter:title"]');
  const h1 = document.querySelector("h1")?.textContent?.trim();
  const doc = document.title?.trim();
  // YouTube often sets good OG/Twitter titles; fall back to #title h1
  if (/youtube\.com$/i.test(host)) {
    const ytH1 = document.querySelector("#title h1")?.textContent?.trim();
    return cleanTitle(ldName || og || tw || ytH1 || h1 || doc);
  }
  return cleanTitle(ldName || og || tw || h1 || doc);
}

/* ------------------ Main extractor ------------------ */
function getBestMetadata() {
  const host = location.hostname;
  const ld = extractFromJSONLD();

  // Title
  const title = bestTitle(host, ld);

  // URL (deep where appropriate)
  let rawUrl = bestCanonicalOrHref();
  rawUrl = ytDeepURL(rawUrl);

  // Category
  const inferredCategory = inferCategory(host, ld, title);

  // Per your rule:
  // 1) If category is Movie/TV → DO NOT capture a deep URL (keep url empty string)
  // 2) For others → MUST keep correct deep link (especially YouTube)
  const url = (inferredCategory === "Movie" || inferredCategory === "TV") ? "" : rawUrl;

  // Site name
  const siteName = pick('meta[property="og:site_name"]') || host;

  return { title, url, siteName, inferredCategory, rawUrl };
}

/* ------------------ Messaging ------------------ */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_PAGE_METADATA") {
    sendResponse(getBestMetadata());
  }
});

/* ------------------ SPA change awareness ------------------ */
(function watchSPA() {
  let last = location.href;
  const refresh = () => { last = location.href; };
  const mo = new MutationObserver(() => {
    if (last !== location.href) refresh();
  });
  mo.observe(document, { subtree: true, childList: true });
  const ps = history.pushState;
  const rs = history.replaceState;
  history.pushState = function() { ps.apply(this, arguments); refresh(); };
  history.replaceState = function() { rs.apply(this, arguments); refresh(); };
  window.addEventListener("popstate", refresh);
})();

// content.js — Address-bar-first URLs, OTT title accuracy, SPA-aware

/* ------------------ helpers ------------------ */
function pick(sel, attr = "content") {
  const el = document.querySelector(sel);
  return el ? (attr === "text" ? (el.textContent || "").trim() : (el.getAttribute(attr) || "")) : "";
}

function cleanTitle(t) {
  if (!t) return "";
  const parts = t.split(/[|\-–—:·»]/).map(s => s.trim()).filter(Boolean);
  const filtered = parts.filter(p => p.length > 3 && !/^(IMDb|YouTube|Netflix|Prime Video|Amazon|Hotstar|Disney\+|Wikipedia|Hulu|HBO|Apple TV|Paramount\+|Peacock)$/i.test(p));
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
      const visit = (obj, depth = 0) => {
        // Prevent infinite recursion
        if (depth > 10 || !obj || typeof obj !== "object") return;
        
        const type = typeof obj["@type"] === "string" ? obj["@type"] 
                   : Array.isArray(obj["@type"]) ? obj["@type"][0] : "";
        const name = typeof obj.name === "string" ? obj.name.trim() : "";
        const url  = typeof obj.url  === "string" ? obj.url.trim()  : "";
        
        if (name) out.push({ name, type, url });
        
        if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(item => visit(item, depth + 1));
        if (Array.isArray(obj.itemListElement)) obj.itemListElement.forEach(item => visit(item, depth + 1));
      };
      visit(root);
    }
  }
  return out;
}

/* ------------------ Address bar URL (with cleanup) ------------------ */
function addressBarURLClean() {
  // Always prefer the real address bar URL; strip common tracking params
  try {
    const u = new URL(location.href);

    // Parameters to remove if present (keep content-relevant params like v/list on YouTube)
    const TRACKER_PARAM = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|igshid$|spm$|_hsenc$|_hsmi$|ref$|source$|campaign$)/i;

    // Preserve list of query params for specific sites
    const preserve = new Set();
    if (/youtube\.com/i.test(u.hostname)) {
      // Keep video identifiers & timestamps/playlists
      ["v", "list", "t", "time_continue", "si"].forEach(k => preserve.add(k));
    }
    if (/vimeo\.com/i.test(u.hostname)) {
      // Keep Vimeo video IDs
      ["v", "autoplay", "loop"].forEach(k => preserve.add(k));
    }

    // Remove known tracker params unless preserved
    for (const [k] of u.searchParams) {
      if (preserve.has(k)) continue;
      if (TRACKER_PARAM.test(k)) u.searchParams.delete(k);
    }
    return u.href;
  } catch {
    return location.href;
  }
}

/* ------------------ Category inference ------------------ */
function inferCategory(host, ldCandidates, titleGuess) {
  const hasType = (t) => ldCandidates.some(x => (x.type || "").toLowerCase().includes(t));
  
  // JSON-LD based detection (highest priority)
  if (hasType("movie")) return "Movie";
  if (hasType("tvseries") || hasType("tvseriesseason") || hasType("tvseason") || hasType("episode")) return "TV";
  
  // Hostname based detection
  if (/youtube\.com/i.test(host)) return "Video";
  if (/vimeo\.com/i.test(host)) return "Video";
  if (/twitch\.tv/i.test(host)) return "Video";
  if (/medium\.com|substack\.com|wordpress\.com|blogspot\.|hashnode\.dev|dev\.to|ghost\.org|notion\.site/i.test(host)) return "Blog";
  if (/github\.com/i.test(host)) return "Code";
  if (/stackoverflow\.com|stackexchange\.com/i.test(host)) return "Code";
  
  // Title-based weak hints
  if (/\btrailer\b/i.test(titleGuess)) return "Video";
  if (/\btutorial\b|\bguide\b|\bhow to\b/i.test(titleGuess)) return "Blog";
  
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

  // Special handling for Google Search pages where <h1> is often "Accessibility links"
  const isGoogleSearch = /(^|\.)google\./i.test(host) && location.pathname === '/search';
  if (isGoogleSearch) {
    // Try knowledge panel title first (when present), then search query, then document title
    const kp = document.querySelector('[data-attrid="title"] span')?.textContent?.trim()
            || document.querySelector('#rhs .kp-header')?.textContent?.trim();
    const qParam = new URL(location.href).searchParams.get('q')
               || document.querySelector('input[name="q"]')?.value;
    const candidate = kp || qParam || og || tw || doc;
    const cleaned = cleanTitle(candidate || '');
    if (!/^accessibility\s+links$/i.test(cleaned)) return cleaned;
    // fall through to general logic if somehow still bad
  }

  // YouTube-specific handling
  if (/youtube\.com/i.test(host)) {
    const ytH1 = document.querySelector("#title h1")?.textContent?.trim();
    return cleanTitle(ldName || og || tw || ytH1 || h1 || doc);
  }
  
  // Vimeo-specific handling
  if (/vimeo\.com/i.test(host)) {
    const vimeoTitle = document.querySelector(".clip_title")?.textContent?.trim();
    return cleanTitle(ldName || og || tw || vimeoTitle || h1 || doc);
  }
  
  // Avoid the common a11y header text if it sneaks in
  const chosen = ldName || og || tw || h1 || doc;
  const cleaned = cleanTitle(chosen || '');
  if (/^accessibility\s+links$/i.test(cleaned)) return cleanTitle(doc || og || tw || '');
  return cleaned;
}

/* ------------------ Main extractor ------------------ */
function getBestMetadata() {
  const host = location.hostname;
  const ld = extractFromJSONLD();

  // Title
  const title = bestTitle(host, ld);

  // Always use the ADDRESS BAR for URL (with cleanup)
  const rawUrl = addressBarURLClean();

  // Category
  const inferredCategory = inferCategory(host, ld, title);

  // Per your rule:
  // 1) Movie/TV => DO NOT return a deep URL (blank)
  // 2) Everything else => keep the real (cleaned) address bar URL
  const url = (inferredCategory === "Movie" || inferredCategory === "TV") ? "" : rawUrl;

  // Site name
  const siteName = pick('meta[property="og:site_name"]') || host;

  return { title, url, siteName, inferredCategory, rawUrl };
}

/* ------------------ Messaging ------------------ */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_PAGE_METADATA") {
    try {
      sendResponse(getBestMetadata());
    } catch (error) {
      console.error('Error getting metadata:', error);
      sendResponse({ title: "", url: "", siteName: "", inferredCategory: "Other", rawUrl: "" });
    }
  }
});

/* ------------------ SPA change awareness ------------------ */
(function watchSPA() {
  // Keep this so the content script reflects the latest URL when popup re-requests metadata.
  let last = location.href;
  const refresh = () => { last = location.href; };
  
  const mo = new MutationObserver(() => {
    if (last !== location.href) refresh();
  });
  mo.observe(document, { subtree: true, childList: true });
  
  const ps = history.pushState;
  const rs = history.replaceState;
  
  history.pushState = function() { 
    try { 
      ps.apply(this, arguments); 
    } catch(e) { 
      console.warn('pushState error:', e); 
    }
    refresh(); 
  };
  
  history.replaceState = function() { 
    try { 
      rs.apply(this, arguments); 
    } catch(e) { 
      console.warn('replaceState error:', e); 
    }
    refresh(); 
  };
  
  window.addEventListener("popstate", refresh);
  
  // Cleanup function (though not called, good practice)
  window.addEventListener("beforeunload", () => {
    mo.disconnect();
  });
})();

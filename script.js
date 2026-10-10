"use strict";
/* ==========================================================================
   My Library: V1
   Sections:  1. Config   2. Storage   3. Helpers   4. Views
              5. Actions  6. Events    7. Start-up
   ========================================================================== */


/* 1. CONFIG: media types, fields and statuses --------------------------- */

const STORAGE_KEY = "myLibrary.items.v1";

const STATUSES = [
  { value: "planned",   label: "Planned" },
  { value: "active",    label: null },          // wording depends on media type
  { value: "completed", label: "Completed" },
  { value: "onhold",    label: "On Hold" },
  { value: "dropped",   label: "Dropped" }
];

// To add a category or a language later, just add it to these lists.
const CATEGORIES = ["Romance", "Fantasy", "Drama", "Thriller", "Mystery", "Comedy", "Action", "Adventure",
  "Horror", "Historical", "Sci-Fi", "Slice of Life", "Crime", "Supernatural", "Psychological", "Family",
  "Young Adult", "Biography", "Documentary", "Animation"];
const LANGUAGES = ["English", "French", "Arabic", "Korean", "Japanese", "Chinese", "Spanish", "Turkish",
  "Italian", "German", "Portuguese", "Hindi", "Russian", "Other"];

// Field helper: kind = text | number | date | textarea (plus special kinds handled in the form)
const F = (key, label, kind = "text") => ({ key, label, kind });
const STATUS_FIELD   = { key: "status",   label: "Status",   kind: "status" };
const RATING_FIELD   = { key: "rating",   label: "Rating",   kind: "rating" };
const FAVORITE_FIELD = { key: "favorite", label: "Favorite", kind: "favorite" };
const NOTES_FIELD    = F("notes", "Notes", "textarea");
const GENRE_FIELD    = { key: "genre",    label: "Categories", kind: "genres" };    // multi-select chips
const LANGUAGE_FIELD = { key: "language", label: "Language",   kind: "language" };  // select list
const WHEN_FIELD      = { key: "_when", kind: "when" };                       // dates new progress for the statistics
const FIND_FIELD      = { key: "_find", kind: "find" };                      // "Find online" helper (new items only)
const ORIGIN_FIELD    = F("origin", "Origin (country)");
const SYNOPSIS_FIELD  = F("synopsis", "Synopsis", "textarea");
const FRANCHISE_FIELD = { key: "franchise", label: "Franchise / series", kind: "franchise" };  // works of any type can share one
const LINK_FIELD      = F("link", "Link to read / watch online", "url");

// To add a media type or field later, edit this object only.
const MEDIA = {
  book: {
    icon: "📚", label: "Book", plural: "Books", activeLabel: "Currently Reading",
    creatorKey: "author",     // which field receives the author / director / creator found online
    progress: ["currentPage"],
    unit: "Page", percent: { done: "currentPage", total: "totalPages", unit: "pages" },
    fields: [F("title", "Title"), FIND_FIELD, F("author", "Author"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("totalPages", "Total pages", "number"), F("currentPage", "Current page", "number"),
      F("publishedDate", "Published"), F("publisher", "Publisher"), ORIGIN_FIELD, FRANCHISE_FIELD, SYNOPSIS_FIELD,
      { key: "file", label: "Book file", kind: "bookfile" }, LINK_FIELD,
      WHEN_FIELD, FAVORITE_FIELD, NOTES_FIELD]
  },
  webtoon: {
    icon: "📖", label: "Webtoon", plural: "Webtoons", activeLabel: "Currently Reading",
    creatorKey: "author",
    progress: ["currentChapter"],
    unit: "Chapter", percent: { done: "currentChapter", total: "totalChapters", unit: "chapters" },
    fields: [F("title", "Title"), FIND_FIELD, F("author", "Author"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentChapter", "Current chapter", "number"), F("totalChapters", "Total chapters", "number"),
      F("publishedDate", "First published"), F("publisher", "Platform / publisher"), ORIGIN_FIELD, FRANCHISE_FIELD, SYNOPSIS_FIELD, LINK_FIELD,
      WHEN_FIELD, FAVORITE_FIELD, NOTES_FIELD]
  },
  movie: {
    icon: "🎬", label: "Movie", plural: "Movies", activeLabel: "Currently Watching",
    creatorKey: "director",
    progress: ["minutesWatched"],
    unit: "Minute", percent: { done: "minutesWatched", total: "totalMinutes", unit: "min" },
    fields: [F("title", "Title"), FIND_FIELD, F("director", "Director"), F("year", "Year", "number"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      { key: "watchedWhen", label: "Date watched", kind: "viewing" },
      F("minutesWatched", "Minutes watched", "number"), F("totalMinutes", "Total duration (minutes)", "number"),
      F("publisher", "Studio"), ORIGIN_FIELD, FRANCHISE_FIELD, SYNOPSIS_FIELD, LINK_FIELD,
      WHEN_FIELD, FAVORITE_FIELD, NOTES_FIELD]
  },
  series: {
    icon: "📺", label: "Series", plural: "Series", activeLabel: "Currently Watching",
    creatorKey: "creator",
    progress: ["currentSeason", "currentEpisode"],     // episodes watched is calculated, never typed
    unit: "Episode", percent: { done: "episodesWatched", total: "totalEpisodes", unit: "episodes" },  // percent: only for older series without season data
    fields: [F("title", "Title"), FIND_FIELD, F("creator", "Creator"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentSeason", "Current season", "number"), F("currentEpisode", "Current episode", "number"),
      { key: "_calc", kind: "calc" },
      { key: "seasonEpisodes", label: "Episodes per season", kind: "seasons" },
      F("totalSeasons", "Total seasons", "number"), F("totalEpisodes", "Total episodes", "number"),
      F("episodeLength", "Episode length", "duration"),
      F("airStart", "First aired", "date"), F("airEnd", "Last aired / ended", "date"),
      SYNOPSIS_FIELD, F("publisher", "Network / platform"), ORIGIN_FIELD, FRANCHISE_FIELD, LINK_FIELD,
      WHEN_FIELD, FAVORITE_FIELD, NOTES_FIELD]
  }
};


/* 2. STORAGE: the only code that touches localStorage --------------------
   To move to another storage system later, rewrite Store (and keep
   the Library functions below as they are).                              */

const Store = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  },
  // Returns false (and warns) if the browser storage is full, e.g. too many covers.
  save(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; }
    catch (e) { alert("Could not save: the device storage is full. Try removing some cover images."); return false; }
  },
  clear() { localStorage.removeItem(STORAGE_KEY); }
};

const Library = {
  all()        { return Store.load(); },
  get(id)      { return Store.load().find((i) => i.id === id); },
  save(item, opts) {
    const items = Store.load();
    const index = items.findIndex((i) => i.id === item.id);
    const next = withHistory(item, items[index], opts && opts.when);   // records the progress event with its date
    if (index >= 0) items[index] = next; else items.push(next);
    return Store.save(items);
  },
  remove(id)       { Store.save(Store.load().filter((i) => i.id !== id)); },
  replaceAll(items){ Store.save(items.map(upgradeItem)); },
  // Progress saved before dated histories existed is kept as "earlier, date unknown" (nothing is invented or removed)
  migrate() {
    const items = Store.load();
    if (items.some(needsUpgrade)) Store.save(items.map((i) => (needsUpgrade(i) ? upgradeItem(i) : i)));
  },
  clear()          { Store.clear(); }
};


// Attached book files are kept in their own IndexedDB store, separate from the library data.
const Files = {
  db() {
    return this._db || (this._db = new Promise((resolve, reject) => {
      const r = indexedDB.open("my-library-files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  },
  async run(mode, fn) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction("files", mode);
      const req = fn(t.objectStore("files"));
      t.oncomplete = () => resolve(req.result);
      t.onerror = t.onabort = () => reject(t.error);
    });
  },
  put(id, blob) { return this.run("readwrite", (s) => s.put(blob, id)); },
  get(id)       { return this.run("readonly", (s) => s.get(id)); },
  remove(id)    { return this.run("readwrite", (s) => s.delete(id)); },
  clear()       { return this.run("readwrite", (s) => s.clear()); }
};


// Your own order of the covers (a list of item ids). Kept apart from the records, so rearranging never touches an item's data.
const ORDER_KEY = "myLibrary.order.v1";
const Order = {
  get() { try { const a = JSON.parse(localStorage.getItem(ORDER_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  set(ids) { try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); return true; } catch (e) { return false; } }
};

/* 3. HELPERS ------------------------------------------------------------ */

const $ = (selector) => document.querySelector(selector);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hasValue = (v) => v !== undefined && v !== null && v !== "";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function statusLabel(type, status) {
  if (status === "active") return MEDIA[type].activeLabel;
  if (type === "movie" && status === "planned") return "Planning to watch";
  if (type === "movie" && status === "completed") return "Already watched";
  return (STATUSES.find((s) => s.value === status) || STATUSES[0]).label;
}

function starsText(n) { return "★".repeat(n) + "☆".repeat(5 - n); }

// Short progress line for cards, e.g. "Page 120 / 300" or "Season 2 · Episode 5"
function progressText(item) {
  if (item.type === "book" && hasValue(item.currentPage))
    return "Page " + item.currentPage + (hasValue(item.totalPages) ? " / " + item.totalPages : "");
  if (item.type === "webtoon" && hasValue(item.currentChapter))
    return "Chapter " + item.currentChapter + (hasValue(item.totalChapters) ? " / " + item.totalChapters : "");
  if (item.type === "series" && (hasValue(item.currentSeason) || hasValue(item.currentEpisode)))
    return [hasValue(item.currentSeason) && "Season " + item.currentSeason,
            hasValue(item.currentEpisode) && "Episode " + item.currentEpisode].filter(Boolean).join(" · ");
  return "";
}

const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

// "2026-09-30" -> "30 September 2026"
function fmtDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Episodes per season, e.g. [20, 20, 20]; null when the series has no season data (older items)
function seasonCounts(item) {
  return Array.isArray(item.seasonEpisodes) && item.seasonEpisodes.length ? item.seasonEpisodes.map((n) => Number(n) || 0) : null;
}

// Automatic series progress: episodes in the seasons before the current one + the current episode.
// Example: seasons [20,20,20], on Season 3 Episode 18 -> 40 + 18 = 58 of 60.
// What each season contributes. A season you marked Watched counts fully; one you marked Not watched counts as 0;
// without a mark it counts as watched when it is before your current season (or the series is Completed).
// The season you are in counts the episodes you reached.
function seasonAmounts(item) {
  const seasons = seasonCounts(item) || [];
  const ce = Number(item.currentEpisode) || 0, cs = Number(item.currentSeason) || (ce ? 1 : 0);
  return seasons.map((c, i) => {
    const v = item.seasonViews && item.seasonViews[i];
    const explicit = !!(v && typeof v.w === "boolean");
    const watched = explicit ? v.w : item.status === "completed" || i + 1 < cs;
    return { watched, explicit, amount: watched ? c : i + 1 === cs ? Math.min(ce, c) : 0 };
  });
}

function seriesProgress(item) {
  const seasons = seasonCounts(item);
  const total = seasons ? seasons.reduce((a, b) => a + b, 0) : 0;
  if (!(total > 0)) return null;
  return { done: seasonAmounts(item).reduce((n, s) => n + s.amount, 0), total };
}

// Uses the existing progress fields (see `percent` in MEDIA). Returns null if not enough data.
function progressPercent(item) {
  if (item.type === "series") {
    const sp = seriesProgress(item);
    if (sp) return { done: sp.done, total: sp.total, unit: "episodes", pct: Math.min(100, Math.round((sp.done / sp.total) * 1000) / 10) };
  }
  const p = MEDIA[item.type].percent;
  if (!hasValue(item[p.done]) || !hasValue(item[p.total])) return null;
  const done = Number(item[p.done]), total = Number(item[p.total]);
  if (!(total > 0) || !(done >= 0)) return null;
  return { done, total, unit: p.unit, pct: Math.min(100, Math.round((done / total) * 100)) };
}

function progressBar(p, full) {
  const label = full ? `${p.done} / ${p.total} ${p.unit} · ${p.pct}%` : `${p.pct}%`;
  return `<div class="pbar-wrap"><div class="pbar" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100"><div class="pbar-fill" style="width:${p.pct}%"></div></div><span class="pbar-label">${label}</span></div>`;
}

function starButtons(n) {
  return [1, 2, 3, 4, 5].map((i) =>
    `<button type="button" class="star-btn ${i <= n ? "on" : ""}" data-action="star" data-value="${i}" aria-label="${i} star${i > 1 ? "s" : ""}">★</button>`).join("");
}

// Cover images are shrunk before saving so localStorage does not fill up.
function resizeImage(file, maxSide = 480) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unreadable image")); };
    img.src = url;
  });
}

const isCover = (src) => typeof src === "string" && src.startsWith("data:image/");

// Categories are stored as an array. Older items stored free text ("Romance, fantasy"): both work.
function genreList(item) {
  const raw = Array.isArray(item.genre) ? item.genre : String(item.genre || "").split(/[,;/]+/);
  return raw.map((g) => String(g).trim()).filter(Boolean)
    .map((g) => CATEGORIES.find((c) => c.toLowerCase() === g.toLowerCase()) || g);
}

function displayValue(item, field) {
  if (field.kind === "seasons") return (seasonCounts(item) || []).map((n, i) => `S${i + 1}: ${n}`).join(" · ");
  if (field.kind === "viewing") return item.status === "completed" ? formatWhen(watchedWhenOf(item)) || "Date unknown" : "";
  if (field.kind === "bookfile") return item.file ? `${item.file.name} (${fmtSize(item.file.size)})` : "";
  if (field.kind === "genres") return genreList(item).join(", ");
  return hasValue(item[field.key]) ? String(item[field.key]) : "";
}

// "45", "45 min", "1h 20min", "1.5h" -> minutes
function parseMinutes(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").toLowerCase().trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/), m = s.match(/(\d+)\s*m/);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function fmtMinutes(min) {
  min = Math.round(min);
  if (min < 60) return min + " min";
  return Math.floor(min / 60) + "h" + (min % 60 ? " " + (min % 60) + "min" : "");
}

const doneDateKey = (type) => (type === "movie" ? "watchedDate" : "finishDate");

// Marking something Completed fills the finish/watched date (if empty) so statistics can place it in time.
function statusChanges(item, status) {
  const changes = { status };
  // a movie's date comes from the viewing-date window, never from today's date
  if (status === "completed" && item.type !== "movie" && !item[doneDateKey(item.type)]) changes[doneDateKey(item.type)] = today();
  return changes;
}

const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

// Only http(s) links are ever opened or shown as links
function safeUrl(u) {
  let t = String(u || "").trim();
  if (!t) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = "https://" + t;
  try { const x = new URL(t); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (e) { return ""; }
}

// A field as plain text, used to tell whether a value was changed by you after an online import
function fieldString(obj, key) {
  if (key === "genre") return genreList(obj).join("|");
  if (key === "seasonEpisodes") return (seasonCounts(obj) || []).join(",");
  return String(obj[key] ?? "").trim();
}

const franchiseNames = () => [...new Set(Library.all().map((i) => String(i.franchise || "").trim()).filter(Boolean))].sort();

// Seasons fully watched (from the per-season episode counts)
function seasonsDone(item) {
  const seasons = seasonCounts(item);
  if (!seasons) return 0;
  if (item.status === "completed") return seasons.length;
  let left = episodesDone(item), n = 0;
  for (const c of seasons) { if (c > 0 && left >= c) { n++; left -= c; } else break; }
  return n;
}

function fieldLabel(type, key) {
  const f = MEDIA[type].fields.find((x) => x.key === key);
  return f ? f.label : key;
}


/* 4. VIEWS: each returns an HTML string ---------------------------------- */

// Current screen + library filters (kept in memory only)
const ui = { lib: { section: "library", arc: "all" }, view: "home", id: null, type: null, editing: null, backTo: "library", stats: { area: "reading", period: "all" }, pendingCover: undefined, filters: { q: "", type: "all", status: "all" } };

function itemCard(item) {
  const m = MEDIA[item.type];
  const progress = progressText(item);
  const pct = progressPercent(item);
  return `
    <article class="card ${item.favorite ? "is-fav" : ""}" data-action="open" data-id="${item.id}" tabindex="0">
      ${isCover(item.cover) ? `<img class="card-cover" src="${esc(item.cover)}" alt="">` : ""}
      <div class="card-info">
        <div class="card-top"><h3>${esc(item.title)}</h3>${item.favorite ? '<span class="fav" title="Favorite">❤️</span>' : ""}</div>
        <div class="meta">${m.icon} ${m.label}</div>
        <div class="status status-${item.status}">${statusLabel(item.type, item.status)}</div>
        ${progress ? `<div class="progress">${esc(progress)}</div>` : ""}
        ${pct ? progressBar(pct, false) : ""}
        ${item.rating ? `<div class="stars" aria-label="${item.rating} out of 5">${starsText(item.rating)}</div>` : ""}
      </div>
    </article>`;
}

function homeView() {
  const items = Library.all();
  const tiles = Object.entries(MEDIA).map(([type, m]) => `
    <button class="cat" data-action="category" data-type="${type}">
      <span class="cat-icon">${m.icon}</span>
      <strong>${items.filter((i) => i.type === type).length}</strong>
      <span>${m.plural}</span>
    </button>`).join("");
  const active = items.filter((i) => i.status === "active");
  return `
    <h1>MY LIBRARY</h1>
    <div class="grid">${tiles}</div>
    <h2>Currently Reading / Watching</h2>
    ${active.length ? active.map(itemCard).join("") : '<p class="empty">Nothing in progress. Tap + Add to start tracking.</p>'}`;
}

function libraryView() {
  const f = ui.filters;
  const chips = [["all", "All"], ...Object.entries(MEDIA).map(([t, m]) => [t, m.plural])]
    .map(([value, label]) => `<button class="chip ${f.type === value ? "on" : ""}" data-action="filterType" data-type="${value}">${label}</button>`)
    .join("");
  const statusOptions = [`<option value="all">All statuses</option>`]
    .concat(STATUSES.map((s) => `<option value="${s.value}" ${f.status === s.value ? "selected" : ""}>${s.label || "Currently Reading / Watching"}</option>`))
    .join("");
  return `
    <h1>List</h1>
    <input id="search" class="search" type="search" placeholder="🔍 Search titles" value="${esc(f.q)}" autocomplete="off">
    <div class="chips">${chips}</div>
    <div class="toolbar-status"><select id="statusFilter" aria-label="Filter by status">${statusOptions}</select></div>
    <div id="list"></div>`;
}

// Fills only the list, so typing in the search box never loses focus.
function fillLibraryList() {
  const f = ui.filters;
  const q = f.q.trim().toLowerCase();
  const items = Library.all()
    .filter((i) => f.type === "all" || i.type === f.type)
    .filter((i) => f.status === "all" || i.status === f.status)
    .filter((i) => !q || String(i.title).toLowerCase().includes(q))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("#list").innerHTML = items.length
    ? items.map(itemCard).join("")
    : '<p class="empty">No items match. Try another search or filter.</p>';
}

function pickView() {
  const buttons = Object.entries(MEDIA).map(([type, m]) =>
    `<button class="btn" data-action="pickType" data-type="${type}">${m.icon} ${m.label}</button>`).join("");
  return `<h1>Add</h1><p class="meta">What do you want to add?</p><div class="pick">${buttons}</div>`;
}

function formView() {
  const type = ui.type;
  const item = ui.id ? Library.get(ui.id) : { status: "planned", rating: 0, favorite: false };
  const fieldsHtml = MEDIA[type].fields.map((f) => {
    const value = item[f.key];
    switch (f.kind) {
      case "status":
        return `<label class="field"><span class="lbl">${f.label}</span><select name="status">${
          STATUSES.map((s) => `<option value="${s.value}" ${item.status === s.value ? "selected" : ""}>${statusLabel(type, s.value)}</option>`).join("")
        }</select></label>`;
      case "rating":
        return `<div class="field"><span class="lbl">${f.label}</span>
          <div class="rating-input" data-rating="${item.rating || 0}">${
            [1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn ${n <= (item.rating || 0) ? "on" : ""}" data-action="star" data-value="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")
          }</div></div>`;
      case "favorite":
        return `<label class="check"><input type="checkbox" name="favorite" ${item.favorite ? "checked" : ""}> ❤️ ${f.label}</label>`;
      case "genres": {
        const chosen = genreList(item);
        const all = [...CATEGORIES, ...chosen.filter((g) => !CATEGORIES.includes(g))];
        return `<div class="field"><span class="lbl">${f.label}</span><div class="tags">${all.map((g) =>
          `<label class="tag"><input type="checkbox" name="genre" value="${esc(g)}" ${chosen.includes(g) ? "checked" : ""}><span>${esc(g)}</span></label>`).join("")}</div></div>`;
      }
      case "language": {
        const opts = [...LANGUAGES, ...(value && !LANGUAGES.includes(value) ? [value] : [])];
        return `<label class="field"><span class="lbl">${f.label}</span><select name="language"><option value="">Not set</option>${
          opts.map((l) => `<option value="${esc(l)}" ${value === l ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
      }
      case "duration":
        return `<label class="field"><span class="lbl">${f.label} <small>(optional, e.g. 45 or 1h 20min)</small></span><input type="text" name="${f.key}" value="${esc(value)}" placeholder="45 min"></label>`;
      case "franchise":
        return `<label class="field"><span class="lbl">${f.label} <small>(items with the same name are linked)</small></span>
          <input type="text" name="franchise" list="franchiseList" value="${esc(value)}">
          <datalist id="franchiseList">${franchiseNames().map((n) => `<option value="${esc(n)}">`).join("")}</datalist></label>`;
      case "bookfile":
        return `<div class="field"><span class="lbl">${f.label} <small>(kept on this device only)</small></span>
          <div id="fileInfo" class="meta"></div>
          <div class="actions"><button type="button" class="btn" data-action="pickFile">Attach file</button>
          <button type="button" class="btn" id="removeFileBtn" data-action="removeFile">Remove file</button></div>
          <input id="bookFile" type="file" hidden></div>`;
      case "viewing": {
        const w = watchedWhenOf(item);
        return `<div class="field" id="viewingBox" ${item.status === "completed" ? "" : "hidden"}><span class="lbl">${f.label}</span>
          <div class="actions"><span id="viewingText" class="meta">${esc(formatWhen(w) || "Date unknown")}</span>
          <button type="button" class="btn" data-action="editViewing">Change date</button></div>
          <input type="hidden" name="watchedWhen" value="${esc(JSON.stringify(w || null))}"></div>`;
      }
      case "when":
        return `<label class="field"><span class="lbl">When did this progress happen? <small>(for the statistics, only if you changed progress above)</small></span>
          <select name="_when"><option value="today" ${ui.id ? "selected" : ""}>Just now: count it in this period</option>
          <option value="earlier" ${ui.id ? "" : "selected"}>Earlier, date unknown: all-time totals only</option></select></label>`;
      case "find":
        return ui.id ? "" : `<div class="field find-box">
          <button type="button" class="btn" data-action="findOnline">🔍 Find this ${MEDIA[type].label.toLowerCase()} online</button>
          <p class="meta">Type the title above, then search ${esc(PROVIDERS[type].name)}. Needs an internet connection.</p>
          <div id="findResults"></div></div>`;
      case "calc":
        return '<div id="seriesCalc" class="calc"></div>';
      case "seasons":
        return `<div class="field"><span class="lbl">${f.label} <small>(used to calculate your progress; edit freely)</small></span>
          <div id="seasonRows">${seasonRows(seasonCounts(item) || [], item.seasonViews || [])}</div>
          <button type="button" class="btn" data-action="addSeason">+ Add season</button></div>`;
      case "textarea":
        return `<label class="field"><span class="lbl">${f.label}</span><textarea name="${f.key}">${esc(value)}</textarea></label>`;
      default: {
        const required = f.key === "title" ? "required" : "";
        const extra = f.kind === "number" ? 'min="0" inputmode="numeric"' : "";
        return `<label class="field"><span class="lbl">${f.label}</span><input type="${f.kind}" name="${f.key}" value="${esc(value)}" ${required} ${extra}></label>`;
      }
    }
  }).join("");
  return `
    <h1>${ui.id ? "Edit" : "Add"} ${MEDIA[type].icon} ${MEDIA[type].label}</h1>
    <form id="itemForm" autocomplete="off">
      <div class="field">
        <span class="lbl">Cover</span>
        <div class="cover-row">
          <div id="coverPreview" class="cover-preview"></div>
          <div class="stack">
            <button type="button" id="pickCoverBtn" class="btn" data-action="pickCover"></button>
            <button type="button" id="removeCoverBtn" class="btn" data-action="removeCover">Remove image</button>
          </div>
        </div>
        <input id="coverFile" type="file" accept="image/*" hidden>
      </div>
      ${fieldsHtml}
      <div class="actions">
        <button class="btn primary" type="submit">Save</button>
        <button class="btn" type="button" data-action="cancelForm">Cancel</button>
      </div>
    </form>`;
}

function predictionPanel(item) {
  let body;
  if (ui.editing === "prediction") {
    body = `<form id="predictionForm" autocomplete="off">
      <label class="field"><span class="lbl">What do you expect?</span><textarea name="text">${esc(item.predictionText)}</textarea></label>
      <div class="field"><span class="lbl">Predicted rating (optional)</span>
        <div class="rating-input" data-rating="${item.predictionRating || 0}">${starButtons(item.predictionRating || 0)}</div></div>
      <div class="actions"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-action="cancelEdit">Cancel</button></div>
    </form>`;
  } else if (item.predictionText || item.predictionRating) {
    body = `${item.predictionText ? `<p class="quote">${esc(item.predictionText)}</p>` : ""}
      ${item.predictionRating ? `<div class="meta">Predicted rating</div><div class="stars">${starsText(item.predictionRating)}</div>` : ""}
      <div class="actions"><button class="btn" data-action="editPrediction">Edit</button></div>`;
  } else {
    body = `<p class="empty">Write what you expect from this one.</p><button class="btn" data-action="editPrediction">Write prediction</button>`;
  }
  return `<div class="panel"><h2>My Prediction</h2>${body}</div>`;
}

function journalPanel(item) {
  const m = MEDIA[item.type];
  const title = (m.activeLabel.includes("Reading") ? "Reading" : "Watching") + " Journal";
  const entries = [...(item.journal || [])].sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") || (a.createdAt || 0) - (b.createdAt || 0));
  const form = (entry) => `
    <form id="journalForm" data-eid="${entry ? entry.id : "new"}" autocomplete="off">
      <div class="quick">
        <label class="field"><span class="lbl">Date</span><input type="date" name="date" value="${esc(entry ? entry.date : today())}"></label>
        <label class="field"><span class="lbl">${m.unit} (optional)</span><input type="number" name="progress" min="0" inputmode="numeric" value="${esc(entry ? entry.progress : "")}"></label>
      </div>
      <label class="field"><span class="lbl">Note</span><textarea name="text" required>${esc(entry ? entry.text : "")}</textarea></label>
      <div class="actions"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-action="cancelEdit">Cancel</button></div>
    </form>`;
  const list = entries.map((e) => ui.editing === "journal:" + e.id
    ? `<div class="entry">${form(e)}</div>`
    : `<div class="entry">
        <div class="entry-head">${esc(fmtDate(e.date))}${hasValue(e.progress) ? " — " + m.unit + " " + esc(e.progress) : ""}</div>
        <p class="entry-text">${esc(e.text)}</p>
        <button class="link" data-action="editEntry" data-eid="${e.id}">Edit</button>
        <button class="link danger" data-action="deleteEntry" data-eid="${e.id}">Delete</button>
      </div>`).join("");
  return `<div class="panel"><h2>${title}</h2>
    ${ui.editing === "journal:new" ? form(null) : '<button class="btn" data-action="addEntry">+ Add entry</button>'}
    ${list || (ui.editing === "journal:new" ? "" : '<p class="empty">No entries yet.</p>')}
  </div>`;
}

function detailView() {
  const item = Library.get(ui.id);
  if (!item) return '<p class="empty">This item no longer exists.</p>';
  const m = MEDIA[item.type];
  const pct = progressPercent(item);
  const rows = m.fields
    .filter((f) => !["status", "rating", "favorite"].includes(f.kind) && displayValue(item, f) !== "")
    .map((f) => `<div class="row"><span>${f.label}</span><span>${esc(displayValue(item, f))}</span></div>`).join("");
  const quickProgress = m.progress.map((key) =>
    `<label class="field"><span class="lbl">${fieldLabel(item.type, key)}</span>
       <input type="number" min="0" inputmode="numeric" data-quick="${key}" value="${esc(item[key])}"></label>`).join("");
  return `
    <button class="back" data-action="back">‹ Back</button>
    ${isCover(item.cover) ? `<img class="detail-cover" src="${esc(item.cover)}" alt="Cover of ${esc(item.title)}">` : ""}
    <h1>${esc(item.title)}</h1>
    <div class="meta">${m.icon} ${m.label}</div>
    <div class="status status-${item.status}">${statusLabel(item.type, item.status)}</div>
    ${item.rating ? `<div class="stars">${starsText(item.rating)}</div>` : ""}
    <div id="progressBox">${pct ? progressBar(pct, true) : ""}</div>
    ${mediaActions(item)}
    <div class="actions">
      <button class="btn" data-action="toggleFav">${item.favorite ? "❤️ Favorite" : "🤍 Mark as favorite"}</button>
    </div>

    <div class="panel">
      <h2>Update</h2>
      <label class="field"><span class="lbl">Status</span>
        <select data-quick="status">${STATUSES.map((s) => `<option value="${s.value}" ${item.status === s.value ? "selected" : ""}>${statusLabel(item.type, s.value)}</option>`).join("")}</select>
      </label>
      ${quickProgress ? `<div class="quick">${quickProgress}</div>` : ""}
    </div>

    <div id="watchBox">${watchPanel(item)}</div>
    ${seasonsPanel(item)}
    ${predictionPanel(item)}
    ${journalPanel(item)}
    ${franchisePanel(item)}

    ${rows ? `<div class="panel"><h2>Details</h2>${rows}</div>` : ""}
    ${infoPanel(item)}

    <div class="actions">
      <button class="btn primary" data-action="edit">Edit</button>
      <button class="btn danger" data-action="delete">Delete</button>
    </div>`;
}

// Set when Chrome says the app can be installed as a real app (see START-UP)
let installPrompt = null;

function settingsView() {
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const installHelp = standalone ? "✅ Running as an installed app."
    : installPrompt ? "Tap “Install app” to add My Library to your phone as a real app."
    : "Running in the browser. In Chrome, open the ⋮ menu and choose “Install app”, then open it from the new icon.";
  return `
    <h1>Settings</h1>
    <div class="stack">
      <button class="btn" data-action="export">⬇️ Export my library</button>
      <button class="btn" data-action="import">⬆️ Import my library</button>
      <button class="btn danger" data-action="clear">🗑️ Clear all data</button>
    </div>
    <input id="importFile" type="file" accept="application/json,.json" hidden>
    <p class="meta">Your data is stored only on this device, in this browser.</p>
    <h2>App</h2>
    ${installPrompt && !standalone ? '<button class="btn" data-action="installApp">📲 Install app</button>' : ""}
    <p class="meta">${installHelp}</p>`;
}

/* Statistics: everything is calculated from the saved items each time the tab opens, so it is always up to date.
   Periods (always counted up to today):
     This month    = the 1st of this month .. today
     Last 3 months = a ROLLING window: today's date, 3 months ago .. today (4 Oct -> 4 Jul .. 4 Oct). Never a calendar quarter.
     This year     = 1 January .. today
     All time      = everything recorded */
const PERIODS = [["month", "This month"], ["3months", "Last 3 months"], ["year", "This year"], ["all", "All time"]];
const READING_TYPES = ["book", "webtoon"], WATCHING_TYPES = ["movie", "series"];

// Same day of the month, n months later. A missing day moves to the month's last day (31 May - 3 months = 28 Feb).
function shiftMonths(date, n) {
  const first = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last));
}

function periodStart(key) {
  const now = new Date();
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (key === "3months") return shiftMonths(now, -3).getTime();
  if (key === "year") return new Date(now.getFullYear(), 0, 1).getTime();
  return 0;
}

// Shown under the period buttons so the exact range is always visible
function periodText(key) {
  if (key === "all") return "All recorded consumption";
  const s = new Date(periodStart(key)), n = new Date();
  const f = (d) => formatWhen({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  return f(s) + " – " + f(n);
}

const dayAfterToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime(); };

// Does a dated span belong to the period [a, b)? Time after today is cut off first. An exact date is simply inside or
// outside. A month or year that is only partly inside counts when most of it is (a year is never placed in a month).
function inWindow(range, a, b) {
  if (!range) return false;
  const today1 = dayAfterToday(), lo = range[0], hi = Math.min(range[1], today1);
  if (hi <= lo) return false;
  const overlap = Math.min(hi, b === Infinity ? today1 : Math.min(b, today1)) - Math.max(lo, a);
  return overlap > 0 && overlap / (hi - lo) >= 0.5;
}

function activityTime(item) {
  const [y, m, d] = String(item[doneDateKey(item.type)] || "").split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d).getTime();
  return item.updatedAt || item.createdAt || 0;
}
/* Viewing dates. A date can be exact (15 March 2024), a month (March 2024) or only a year (2024):
   { y, m, d } with m and d optional. null = watched, but when is unknown. */
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function parseIso(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? { y, m, d } : null;
}
// The span of time a date can refer to: [start, end) in ms. Less precise dates cover more time.
function whenRange(w) {
  if (!w || !w.y || w.y < 1900) return null;
  const lo = w.d && w.m ? new Date(w.y, w.m - 1, w.d) : w.m ? new Date(w.y, w.m - 1, 1) : new Date(w.y, 0, 1);
  const hi = w.d && w.m ? new Date(w.y, w.m - 1, w.d + 1) : w.m ? new Date(w.y, w.m, 1) : new Date(w.y + 1, 0, 1);
  return [lo.getTime(), hi.getTime()];
}
function formatWhen(w) {
  if (!w || !w.y) return "";
  return w.d && w.m ? `${w.d} ${MONTH_NAMES[w.m - 1]} ${w.y}` : w.m ? `${MONTH_NAMES[w.m - 1]} ${w.y}` : String(w.y);
}
const whenIso = (w) => (w && w.y && w.m && w.d ? w.y + "-" + String(w.m).padStart(2, "0") + "-" + String(w.d).padStart(2, "0") : "");
// A movie's viewing date: the one you entered, or the older exact "date watched" it already had
const watchedWhenOf = (item) => (item.watchedWhen !== undefined ? item.watchedWhen : parseIso(item.watchedDate));

// A finished item belongs to a period through its real viewing / finish date. Without a date it only counts in All time.
// A date that is less precise only counts in a period that fully contains it (2024 is never placed in a month).
const completedRange = (item) => whenRange(item.type === "movie" ? watchedWhenOf(item) : parseIso(item.finishDate));
const inPeriod = (item, key) => {
  if (item.status !== "completed") return false;
  if (key === "all") return true;
  const r = completedRange(item);
  return inWindow(r, periodStart(key), Infinity);
};

// Episodes watched: the saved number, or all episodes when a series is Completed with a known total.
function episodesDone(item) {
  const sp = item.type === "series" && seriesProgress(item);
  if (sp) return sp.done;
  if (hasValue(item.episodesWatched)) return Number(item.episodesWatched) || 0;
  if (item.status === "completed" && hasValue(item.totalEpisodes)) return Number(item.totalEpisodes) || 0;
  return 0;
}

function watchedMinutes(item) {
  if (item.type === "movie") return Number(item.status === "completed" ? item.totalMinutes : item.minutesWatched) || 0;
  if (item.type === "series") return episodesDone(item) * parseMinutes(item.episodeLength);
  return 0;
}

function unitsRead(item, type, currentKey, totalKey) {
  if (item.type !== type) return 0;
  return Math.max(Number(item[currentKey]) || 0, item.status === "completed" ? Number(item[totalKey]) || 0 : 0);
}

function barRows(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => `<div class="bar-row"><div class="bar-top"><span>${esc(r.label)}</span><span>${r.value}${r.note ? ` <em>${esc(r.note)}</em>` : ""}</span></div><div class="pbar"><div class="pbar-fill" style="width:${(r.value / max) * 100}%"></div></div></div>`).join("");
}

const statTile = (n, label) => `<div class="tile"><strong>${n}</strong><span>${label}</span></div>`;
const statRow = (k, v) => `<div class="row"><span>${k}</span><span>${v}</span></div>`;
const noData = '<p class="empty">Nothing for this period.</p>';

function readingStats(period) {
  const all = Library.all().filter((i) => READING_TYPES.includes(i.type));
  const doneIn = all.filter((i) => inPeriod(i, period));
  const count = (st) => all.filter((i) => i.status === st).length;
  const label = PERIODS.find((p) => p[0] === period)[1];
  const completedCells = [["month", "This month"], ["3months", "Last 3 mo."], ["year", "This year"], ["all", "Total"]]
    .map(([k, l]) => `<div class="${k === period ? "on" : ""}"><strong>${all.filter((i) => inPeriod(i, k)).length}</strong><span>${l}</span></div>`).join("");
  const sum = (type, a, b) => all.filter((i) => i.type === type).reduce((n, i) => n + consumedBetween(i, a, b), 0);
  const pages = sum("book", periodStart(period), Infinity), chapters = sum("webtoon", periodStart(period), Infinity);
  const prev = prevPeriod(period);
  const diff = (now, before) => (now - before === 0 ? "" : (now > before ? "+" : "−") + Math.abs(now - before).toLocaleString());
  const change = prev ? [["pages", pages, sum("book", prev[0], prev[1])], ["chapters", chapters, sum("webtoon", prev[0], prev[1])]]
    .filter(([, n, p]) => n !== p).map(([u, n, p]) => diff(n, p) + " " + u).join(" · ") : "";
  const undated = all.filter((i) => undatedAmount(i) > 0).length;
  const running = all.filter((i) => i.status === "active").map(progressPercent).filter(Boolean);
  const avg = running.length ? Math.round(running.reduce((n, p) => n + p.pct, 0) / running.length) : null;
  return `
    <div class="stat-grid">${statTile(count("active"), "Currently reading")}${statTile(count("onhold"), "Paused")}${statTile(count("dropped"), "Dropped")}${statTile(count("planned"), "Want to read")}</div>
    <div class="panel"><h2>Completed</h2><div class="mini-row">${completedCells}</div></div>
    <div class="panel"><h2>By type · ${label}</h2>${barRows([
      { label: "📚 Books completed", value: doneIn.filter((i) => i.type === "book").length, note: pages ? pages.toLocaleString() + " pages read" : "" },
      { label: "📖 Webtoons completed", value: doneIn.filter((i) => i.type === "webtoon").length, note: chapters ? chapters.toLocaleString() + " chapters read" : "" }])}</div>
    <details class="more" open><summary>Pages &amp; chapters · ${label}</summary><div class="panel">
      ${statRow("Pages read", pages.toLocaleString())}${statRow("Chapters read", chapters.toLocaleString())}
      ${change ? statRow("Compared with the previous " + (period === "3months" ? "3 months" : period), change) : ""}
      ${avg === null ? "" : statRow("Reading progress", avg + "% average across " + running.length + " in progress")}
    </div></details>
    <p class="foot">${period !== "all" && undated ? undatedText(undated) : ""}</p>`;
}

function watchingStats(period) {
  const all = Library.all().filter((i) => WATCHING_TYPES.includes(i.type));
  const label = PERIODS.find((p) => p[0] === period)[1];
  const amt = (i) => periodAmounts(i, period);
  const movies = all.filter((i) => i.type === "movie" && inPeriod(i, period)).length;
  const series = all.filter((i) => i.type === "series" && inPeriod(i, period)).length;
  const seriesAll = all.filter((i) => i.type === "series");
  const episodes = seriesAll.reduce((n, i) => n + amt(i).units, 0);
  const timeOf = (type, p) => all.filter((i) => !type || i.type === type).reduce((n, i) => n + (p ? periodAmountsBetween(i, p[0], p[1]).minutes : amt(i).minutes), 0);
  const seasons = seriesAll.reduce((n, i) => n + seasonsCompletedIn(i, period), 0);
  const missingLength = seriesAll.filter((i) => amt(i).units > 0 && !parseMinutes(i.episodeLength)).length;
  const prev = prevPeriod(period);
  const prevEpisodes = prev ? seriesAll.reduce((n, i) => n + periodAmountsBetween(i, prev[0], prev[1]).units, 0) : 0;
  const dm = prev ? Math.round(timeOf(null) - timeOf(null, prev)) : 0, de = episodes - prevEpisodes;
  const change = prev ? [de && (de > 0 ? "+" : "−") + Math.abs(de) + " episodes", dm && (dm > 0 ? "+" : "−") + fmtMinutes(Math.abs(dm))].filter(Boolean).join(" · ") : "";
  const titles = all.filter((i) => amt(i).units > 0 || inPeriod(i, period))
    .sort((a, b) => amt(b).minutes - amt(a).minutes || String(a.title).localeCompare(String(b.title)));
  const titleRow = (i) => {
    const pct = progressPercent(i), a = amt(i);
    const sub = (i.type === "series"
      ? [a.units && a.units + " episodes", a.minutes && fmtMinutes(a.minutes), pct && pct.pct + "% overall"]
      : [a.minutes && fmtMinutes(a.minutes), i.status === "completed" && "Watched"]
    ).filter(Boolean).join(" · ");
    return `<div class="trow" data-action="open" data-id="${i.id}"><span>${MEDIA[i.type].icon} ${esc(i.title)}</span><small>${esc(sub)}</small></div>`;
  };
  return `
    <div class="stat-grid">
      ${statTile(movies, "Movies watched")}${statTile(series, "Series watched")}
      ${statTile(episodes, "Episodes watched")}${statTile(fmtMinutes(timeOf()), "Estimated watching time")}
      ${statTile(all.filter((i) => i.status === "active").length, "Currently watching")}${statTile(movies + series, "Completed")}
      ${statTile(seasons, "Seasons completed")}${statTile(all.filter((i) => i.type === "movie" && i.status !== "completed").length, "Movies to watch")}
    </div>
    ${change ? `<p class="meta">Compared with the previous ${period === "3months" ? "3 months" : period}: ${change}</p>` : ""}
    <div class="panel"><h2>By type · ${label}</h2>${barRows([
      { label: "🎬 Movies", value: movies, note: fmtMinutes(timeOf("movie")) },
      { label: "📺 Series", value: series, note: fmtMinutes(timeOf("series")) }])}</div>
    <details class="more"><summary>Individual titles · ${label}</summary><div class="panel">${titles.length ? titles.map(titleRow).join("") : noData}</div></details>
    <p class="foot">${missingLength ? `Series without an episode length are not counted in watching time (${missingLength}). ` : ""}${period !== "all" && all.some((i) => undatedAmount(i) > 0) ? undatedText(all.filter((i) => undatedAmount(i) > 0).length) : ""}</p>`;
}

// Same as periodAmounts but for any [a, b) range (used for "previous period")
function periodAmountsBetween(item, a, b) {
  const c = CONSUMPTION[item.type], units = c ? consumedBetween(item, a, b) : 0;
  return { units, minutes: !c ? 0 : c.minutes ? units * c.minutes(item) : c.unit === "minutes" ? units : 0 };
}

/* Language focus. Consumption is counted from PROGRESS, not from finished items: 150 of 400 pages
   already counts as 150 pages. To answer "this month / 3 months / this year", each item keeps a small
   history of its progress: item.log = [{ d: "2026-10-03", v: 150 }]  (v = amount consumed so far, in the
   item's own unit). It is updated automatically whenever an item is saved. */

// The most meaningful measurable unit of each media type. A new media type only needs an entry here.
const CONSUMPTION = {
  book:    { unit: "pages",    amount: (i) => unitsRead(i, "book", "currentPage", "totalPages") },
  webtoon: { unit: "chapters", amount: (i) => unitsRead(i, "webtoon", "currentChapter", "totalChapters") },
  movie:   { unit: "minutes",  amount: (i) => watchedMinutes(i) || Number(i.minutesWatched) || 0 },
  series:  { unit: "episodes", amount: (i) => episodesDone(i), minutes: (i) => parseMinutes(i.episodeLength) }
};
const UNIT_INFO = { pages: ["📚", "pages"], chapters: ["📖", "chapters"], minutes: ["🎬", "watch time"], episodes: ["📺", "episodes"] };
const FOCUS_UNITS = ["pages", "chapters", "minutes"];   // units used to work out a language's overall focus

const dayString = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const isoMs = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return y ? new Date(y, m - 1, d).getTime() : 0; };
const unitsOf = (item) => { const c = CONSUMPTION[item.type]; return c ? Math.max(0, Number(c.amount(item)) || 0) : 0; };

/* The history is a list of progress events: { d: "2026-10-03", t: 1790000000000, v: 62 } where v is the total
   consumed so far. d / t are the day and moment the progress was recorded. Progress whose date is unknown
   has d = null: it counts in All time but is never placed in a month or a year.
   Consumption in a period = the increases recorded (with a date) inside that period. */

// Old or missing histories: whatever was already consumed becomes one undated event (no dates are guessed).
function upgradeLog(item) {
  if (!Array.isArray(item.log)) { const cur = unitsOf(item); return cur > 0 ? [{ d: null, t: null, v: cur }] : []; }
  return item.log.map((e) => (e.est ? { d: null, t: null, v: e.v } : e));
}
const logOf = upgradeLog;

const PROGRESS_KEYS = (type) => (type === "series" ? [...MEDIA.series.progress] : [...(MEDIA[type] ? MEDIA[type].progress : []), "status"]);

// Called on every save. A change in the amount consumed becomes a dated event only when you actually moved
// your progress (page, chapter, episode, minutes or status). Fixing totals / season counts never counts as consuming.
const seasonMode = (item) => item.type === "series" && !!seasonCounts(item);
const hasSeasonLogs = (item) => Array.isArray(item.seasonViews) && item.seasonViews.some((v) => v && Array.isArray(v.log));

// Net progress chunks of a log: a correction downwards removes the most recent progress first.
function chunksOf(log) {
  const chunks = [];
  let prev = 0;
  (log || []).forEach((e) => {
    const delta = e.v - prev;
    prev = e.v;
    if (delta > 0) chunks.push({ t: e.t || (e.d ? isoMs(e.d) : 0), amt: delta });
    else {
      let cut = -delta;
      while (cut > 0 && chunks.length) { const c = chunks[chunks.length - 1]; if (c.amt > cut) { c.amt -= cut; cut = 0; } else { cut -= c.amt; chunks.pop(); } }
    }
  });
  return chunks;
}

// Adds one progress event to a log (same day merges into one event)
function appendEvent(log, cur, dated) {
  const out = log.slice(), last = out.length ? out[out.length - 1] : null;
  if (cur === (last ? last.v : 0)) return out;
  const d = dated ? today() : null;
  if (last && last.d === d) out[out.length - 1] = { ...last, v: cur, t: dated ? Date.now() : null };
  else out.push({ d, t: dated ? Date.now() : null, v: cur });
  return out;
}

// Series with season data keep one small history PER SEASON, so a season's episodes are dated on their own.
// An older single history is split across the seasons; progress without a date stays undated.
function splitSeriesLog(item, seasons) {
  const am = seasonAmounts(item), marks = item.seasonViews || [];
  const datedBySeason = seasons.map(() => []);
  let pos = 0;
  chunksOf(Array.isArray(item.log) ? item.log.map((e) => (e.est ? { ...e, d: null, t: null } : e)) : []).forEach((ch) => {
    for (let k = 0; k < ch.amt; k++) {
      let s = 0, acc = 0;
      while (s < seasons.length - 1 && pos + k >= acc + seasons[s]) { acc += seasons[s]; s++; }
      if (ch.t) datedBySeason[s].push(ch.t);
    }
    pos += ch.amt;
  });
  return seasons.map((c, i) => {
    const total = am[i].explicit && am[i].watched ? 0 : am[i].amount;   // seasons you marked Watched are dated by their own record
    const ts = datedBySeason[i].slice(0, total), log = [];
    const baseline = total - ts.length;
    let v = baseline;
    if (baseline > 0) log.push({ d: null, t: null, v: baseline });
    ts.forEach((t) => { v += 1; const last = log[log.length - 1]; if (last && last.t === t) last.v = v; else log.push({ d: dayString(new Date(t)), t, v }); });
    return { ...(marks[i] || {}), log };
  });
}

const needsUpgrade = (i) => (seasonMode(i) ? !hasSeasonLogs(i) || "log" in i : !Array.isArray(i.log) || i.log.some((e) => e.est));
function upgradeItem(item) {
  if (!seasonMode(item)) return { ...item, log: upgradeLog(item) };
  const { log, ...rest } = item;
  return hasSeasonLogs(item) ? rest : { ...rest, seasonViews: splitSeriesLog(item, seasonCounts(item)) };
}

// Called on every save. A change in the amount consumed becomes a dated event only when you actually moved
// your progress (page, chapter, episode, minutes or status). Fixing totals / season counts never counts as consuming.
function withHistory(item, prev, when) {
  if (seasonMode(item)) return withSeasonHistory(item, prev, when);
  if (item.type === "movie" && item.status === "completed")            // a watched movie is dated by its viewing date
    return { ...item, log: Array.isArray(item.log) ? item.log : (prev && prev.log) || [] };
  const src = Array.isArray(item.log) ? item : prev || null;
  const log = src ? upgradeLog(src) : [];
  const moved = !prev || PROGRESS_KEYS(item.type).some((k) => String(prev[k] ?? "") !== String(item[k] ?? ""));
  return { ...item, log: appendEvent(log, unitsOf(item), moved && when !== "earlier") };
}

function withSeasonHistory(item, prev, when) {
  const seasons = seasonCounts(item);
  let views;
  if (hasSeasonLogs(item)) views = item.seasonViews;
  else if (prev) views = upgradeItem(seasonMode(prev) ? prev : item).seasonViews;
  else views = seasons.map(() => ({ log: [] }));
  const moved = !prev || PROGRESS_KEYS("series").some((k) => String(prev[k] ?? "") !== String(item[k] ?? ""));
  const dated = moved && when !== "earlier";
  const marks = item.seasonViews || [];
  const am = seasonAmounts(item);
  const merged = seasons.map((c, i) => {
    const log = (views[i] && views[i].log) || [];
    return { ...marks[i], log: am[i].explicit && am[i].watched ? log : appendEvent(log, am[i].amount, dated) };
  });
  const { log, ...rest } = item;
  return { ...rest, seasonViews: merged };
}

const eventMs = (e) => e.t || (e.d ? isoMs(e.d) : 0);

// Every dated amount an item has consumed: { lo, hi, amt }, where lo..hi is the span of time it could have happened in.
// Dated sources: progress you recorded (exact moment), a movie's viewing date and each season's viewing date.
function ledger(item) {
  const out = [];
  const add = (range, amt) => { if (range && amt > 0) out.push({ lo: range[0], hi: range[1], amt }); };
  const fromLog = (log, cap) => {
    let left = cap;
    chunksOf(log).forEach((c) => { if (c.t && left > 0) { const a = Math.min(c.amt, left); add([c.t, c.t + 1], a); left -= a; } });
  };
  if (item.type === "movie" && item.status === "completed") add(whenRange(watchedWhenOf(item)), unitsOf(item));
  else if (seasonMode(item)) {
    const views = item.seasonViews || [];
    seasonAmounts(item).forEach((s, i) => {
      const v = views[i] || {};
      if (s.explicit && s.watched) add(whenRange(v.when), s.amount); else fromLog(v.log, s.amount);
    });
  } else fromLog(logOf(item), unitsOf(item));
  return out;
}

// Amount of one item consumed inside [a, b). All time (a = 0, b = Infinity) is simply the overall progress.
// A date counts in a period only when the period fully contains it, so a year-only date never lands in a month.
function consumedBetween(item, a, b) {
  if (a <= 0 && b === Infinity) return unitsOf(item);
  return ledger(item).reduce((n, e) => (inWindow([e.lo, e.hi], a, b) ? n + e.amt : n), 0);
}

// Overall progress that has no recorded date
function undatedAmount(item) {
  return Math.max(0, unitsOf(item) - ledger(item).reduce((n, e) => n + e.amt, 0));
}
const undatedText = (n) => `${n} item${n > 1 ? "s have" : " has"} earlier progress with no recorded date; it is included in All time only. `;

// One item's amounts in a period, used by both General and Language statistics
function periodAmounts(item, key) {
  const c = CONSUMPTION[item.type], units = c ? consumedBetween(item, periodStart(key), Infinity) : 0;
  return { units, minutes: !c ? 0 : c.minutes ? units * c.minutes(item) : c.unit === "minutes" ? units : 0 };
}

// Seasons finished inside a period, from their viewing dates (or the dated progress that finished them)
function seasonsCompletedIn(item, key) {
  const seasons = seasonCounts(item);
  if (!seasons) return 0;
  const a = periodStart(key), am = seasonAmounts(item);
  return seasons.reduce((n, c, i) => {
    if (!(c > 0) || !am[i].watched) return n;
    if (key === "all") return n + 1;
    const v = (item.seasonViews && item.seasonViews[i]) || {};
    let r = null;
    if (v.w === true) r = whenRange(v.when);
    else {
      const ch = chunksOf(v.log).filter((x) => x.t);
      if (ch.length && ch.reduce((sum, x) => sum + x.amt, 0) >= c) r = [ch[ch.length - 1].t, ch[ch.length - 1].t + 1];
    }
    return n + (inWindow(r, a, Infinity) ? 1 : 0);
  }, 0);
}

function prevPeriod(key) {
  const start = periodStart(key);
  if (!start) return null;
  const s = new Date(start);
  if (key === "month") return [new Date(s.getFullYear(), s.getMonth() - 1, 1).getTime(), start];
  if (key === "year") return [new Date(s.getFullYear() - 1, 0, 1).getTime(), start];
  return [shiftMonths(s, -3).getTime(), start];                  // the 3 months before the rolling window
}

// Most recent dated progress
function lastIncrease(item) {
  const ms = Math.max(0, ...ledger(item).map((e) => e.lo));
  return ms ? dayString(new Date(ms)) : "";
}

function addUnits(bucket, item, amount) {
  const c = CONSUMPTION[item.type];
  if (!amount) return;
  bucket[c.unit] = (bucket[c.unit] || 0) + amount;
  if (c.minutes) bucket.minutes = (bucket.minutes || 0) + amount * c.minutes(item);
}

function languageData(period) {
  const prev = prevPeriod(period), start = periodStart(period);
  const rows = {}, totals = {}, notes = { undated: 0, none: 0, noLength: 0 };
  Library.all().forEach((item) => {
    if (!CONSUMPTION[item.type]) return;
    const name = item.language || "Not set";
    const r = rows[name] || (rows[name] = { name, units: {}, prev: {}, active: 0, done: 0, last: "" });
    if (item.status === "active") r.active++;
    if (item.status === "completed" && inPeriod(item, period)) r.done++;
    addUnits(r.units, item, consumedBetween(item, start, Infinity));
    if (prev) addUnits(r.prev, item, consumedBetween(item, prev[0], prev[1]));
    const last = lastIncrease(item);
    if (last > r.last) r.last = last;
    const cur = unitsOf(item);
    if ((item.status === "active" || item.status === "completed") && !cur) notes.none++;
    if (item.type === "series" && cur && !parseMinutes(item.episodeLength)) notes.noLength++;
    if (undatedAmount(item) > 0) notes.undated++;
  });
  const list = Object.values(rows);
  list.forEach((r) => Object.entries(r.units).forEach(([u, n]) => { totals[u] = (totals[u] || 0) + n; }));
  list.forEach((r) => {
    r.any = Object.values(r.units).some((n) => n > 0);
    const shares = FOCUS_UNITS.filter((u) => totals[u] > 0).map((u) => (r.units[u] || 0) / totals[u]);
    r.focus = shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : 0;
  });
  return { rows: list, totals, notes };
}

function agoText(iso) {
  if (!iso) return "no dated progress yet";
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((now.getTime() - isoMs(iso)) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return days + " days ago";
  if (days < 365) { const m = Math.round(days / 30); return m + " month" + (m > 1 ? "s" : "") + " ago"; }
  const y = Math.round(days / 365); return y + " year" + (y > 1 ? "s" : "") + " ago";
}

const fmtUnit = (u, n) => (u === "minutes" ? fmtMinutes(n) : Math.round(n).toLocaleString() + " " + UNIT_INFO[u][1]);
const pctText = (x) => (x > 0 && x < 0.01 ? "<1%" : Math.round(x * 100) + "%");

function languagesStats(period) {
  const { rows, totals, notes } = languageData(period);
  const label = PERIODS.find((p) => p[0] === period)[1].toLowerCase();
  const units = Object.keys(UNIT_INFO).filter((u) => totals[u] > 0);
  const used = rows.filter((r) => r.any).sort((a, b) => b.focus - a.focus || a.name.localeCompare(b.name));
  const quiet = rows.filter((r) => !r.any && r.name !== "Not set").sort((a, b) => a.name.localeCompare(b.name));
  const card = (r) => {
    const lines = units.filter((u) => r.units[u] > 0).map((u) => `<div>${UNIT_INFO[u][0]} <strong>${esc(fmtUnit(u, r.units[u]))}</strong> <small>${pctText(r.units[u] / totals[u])} of all ${UNIT_INFO[u][1]}</small></div>`).join("");
    const change = ["pages", "chapters", "minutes"].map((u) => [u, (r.units[u] || 0) - (r.prev[u] || 0)]).filter(([, d]) => Math.round(d) !== 0)
      .map(([u, d]) => (d > 0 ? "+" : "−") + (u === "minutes" ? fmtMinutes(Math.abs(d)) : Math.round(Math.abs(d)) + " " + UNIT_INFO[u][1])).join(" · ");
    return `<div class="panel lang">
      <div class="lang-head"><strong>${esc(r.name)}</strong><span>Focus ${pctText(r.focus)}</span></div>
      <div class="pbar"><div class="pbar-fill" style="width:${Math.round(r.focus * 100)}%"></div></div>
      <div class="lang-units">${lines}</div>
      <p class="meta">${r.active} in progress · ${r.done} completed · last progress ${agoText(r.last)}</p>
      ${prevPeriod(period) && change ? `<p class="meta">Compared with the previous ${period === "3months" ? "3 months" : period}: ${change}</p>` : ""}
    </div>`;
  };
  return `
    <p class="meta">What you actually consumed in each language, counted from your progress (finished or not).</p>
    ${units.length ? `<div class="grid">${["pages", "chapters", "minutes"].filter((u) => totals[u] > 0).map((u) => statTile(u === "minutes" ? fmtMinutes(totals[u]) : Math.round(totals[u]).toLocaleString(), u === "pages" ? "Pages read" : u === "chapters" ? "Chapters read" : "Watched")).join("")}</div>` : ""}
    ${used.length ? used.map(card).join("") : `<p class="empty">No progress recorded for this period (${label}).</p>`}
    ${quiet.length ? `<div class="panel"><h2>Quiet in this period</h2>${quiet.map((r) => statRow(esc(r.name), "last progress " + agoText(r.last))).join("")}
      <p class="meta">Languages in your library with no progress in the selected period.</p></div>` : ""}
    <p class="foot">${notes.none ? notes.none + " item" + (notes.none > 1 ? "s have" : " has") + " no measurable progress yet (add pages, chapters or durations). " : ""}${notes.noLength ? notes.noLength + " series have no episode length, so their episodes are counted but not their minutes. " : ""}${notes.undated && period !== "all" ? undatedText(notes.undated) : ""}</p>`;
}

function statsView() {
  const { area, period } = ui.stats;
  const seg = [["reading", "📖 Reading"], ["watching", "🎬 Watching"], ["languages", "🌍 Languages"]]
    .map(([k, l]) => `<button class="${area === k ? "on" : ""}" data-action="statsArea" data-area="${k}">${l}</button>`).join("");
  const chips = PERIODS.map(([k, l]) => `<button class="chip ${period === k ? "on" : ""}" data-action="statsPeriod" data-period="${k}">${l}</button>`).join("");
  return `
    <h1>Statistics</h1>
    <div class="seg">${seg}</div>
    <div class="chips">${chips}</div>
    <p class="meta period-range">${esc(periodText(period))}</p>
    ${area === "reading" ? readingStats(period) : area === "watching" ? watchingStats(period) : languagesStats(period)}
    ${area === "languages" ? "" : '<p class="foot">Completed items are placed by their finish or watched date. Pages, chapters, episodes and minutes are counted from when the progress was recorded.</p>'}`;
}

// Per-item info for movies and series (language is already shown in Details)
function watchPanel(item) {
  const rows = [];
  if (item.type === "series") {
    const done = episodesDone(item), total = Number(item.totalEpisodes) || 0, len = parseMinutes(item.episodeLength);
    if (done || total) rows.push(statRow("Episodes watched", total ? done + " of " + total : done));
    if (total) rows.push(statRow("Episodes remaining", Math.max(0, total - done)));
    if (len && done) rows.push(statRow("Time watched", fmtMinutes(done * len)));
    if (len && total) rows.push(statRow("Estimated total time", fmtMinutes(total * len)));
  } else if (item.type === "movie") {
    rows.push(statRow("Watched", item.status === "completed" ? "Yes" : item.status === "active" ? "In progress" : "No"));
    if (Number(item.totalMinutes)) rows.push(statRow("Duration", fmtMinutes(item.totalMinutes)));
    if (item.status !== "completed" && Number(item.minutesWatched)) rows.push(statRow("Time watched", fmtMinutes(item.minutesWatched)));
  }
  return rows.length ? `<div class="panel"><h2>Watching info</h2>${rows.join("")}</div>` : "";
}

/* Library tab: the bookshelf, covers only.
     Library  = every title that is not Completed or Dropped
     Archives = Completed and Dropped titles
   The existing status decides, so changing a status moves a title by itself (nothing is copied or flagged).
   Your own order is a list of ids (Order); the shelves just draw that list. */

const SHELF = { minCover: 76, gap: 10, sidePad: 28, minRows: 3, maxCols: 8 };
const TYPE_ORDER = Object.keys(MEDIA);
const isArchived = (i) => i.status === "completed" || i.status === "dropped";
const byTypeTitle = (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || String(a.title).localeCompare(String(b.title));

// The saved order first, then anything not placed yet (new titles) by type and title
function customSequence(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const seq = [], seen = new Set();
  Order.get().forEach((id) => { if (byId.has(id) && !seen.has(id)) { seq.push(byId.get(id)); seen.add(id); } });
  items.filter((i) => !seen.has(i.id)).sort(byTypeTitle).forEach((i) => seq.push(i));
  return seq;
}

// What the current section shows, in your order
function visibleItems() {
  const L = ui.lib, arc = L.section === "archives", all = Library.all();
  const rank = new Map(customSequence(all).map((i, n) => [i.id, n]));
  return all.filter((i) => isArchived(i) === arc)
    .filter((i) => !arc || L.arc === "all" || i.status === L.arc)
    .sort((a, b) => rank.get(a.id) - rank.get(b.id));
}

function shelfBook(item) {
  const m = MEDIA[item.type];
  const face = isCover(item.cover)
    ? `<img src="${esc(item.cover)}" alt="" draggable="false">`
    : `<div class="book-ph t-${item.type}"><span class="i">${m.icon}</span><span class="t">${esc(item.title)}</span></div>`;
  return `<button class="book" data-action="open" data-id="${item.id}" aria-label="${esc(item.title)}, ${m.label}" title="${esc(item.title)}">${face}</button>`;
}

function shelfView() {
  const L = ui.lib, arc = L.section === "archives", n = visibleItems().length;
  const chip = (cur, v, label, act) => `<button class="chip ${cur === v ? "on" : ""}" data-action="${act}" data-value="${v}">${label}</button>`;
  const note = arc
    ? (n ? `${n} item${n === 1 ? "" : "s"} in the archive` : "Nothing archived yet. Completed and dropped titles move here by themselves.")
    : (n ? `${n} item${n === 1 ? "" : "s"} on your shelves` : "Your shelves are empty. Tap + Add to place your first one.");
  return `
    <h1>${arc ? "Archives" : "Library"}</h1>
    <div class="chips">${chip(L.section, "library", "Library", "libSection")}${chip(L.section, "archives", "Archives", "libSection")}</div>
    ${arc ? `<div class="chips">${chip(L.arc, "all", "All", "libArc")}${chip(L.arc, "completed", "Completed", "libArc")}${chip(L.arc, "dropped", "Dropped", "libArc")}</div>` : ""}
    <div class="room">
      <div class="bookcase" id="bookcase"></div>
      <p class="room-note">${note}</p>
    </div>`;
}

// Fills the shelves; the number of covers per shelf depends on the screen width.
function fillShelves() {
  const box = $("#bookcase");
  if (!box || drag) return;                  // never redraw under a cover that is being dragged
  const cols = Math.min(SHELF.maxCols, Math.max(3,
    Math.floor((box.clientWidth - SHELF.sidePad + SHELF.gap) / (SHELF.minCover + SHELF.gap))));
  const items = visibleItems();
  const rows = Math.max(SHELF.minRows, Math.ceil(items.length / cols));
  let html = "";
  for (let r = 0; r < rows; r++) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const item = items[r * cols + c];
      cells.push(item ? shelfBook(item) : '<span class="book-gap"></span>');
    }
    html += `<div class="shelf"><div class="shelf-books" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${cells.join("")}</div><div class="plank"></div></div>`;
  }
  box.innerHTML = html;
}

/* Press-and-hold reordering ---------------------------------------------------------------------------------- */

// Move one id before another (or after the last visible one) inside the full saved sequence
function moveInSequence(seq, id, beforeId, visible) {
  const rest = seq.filter((x) => x !== id);
  let at;
  if (beforeId && rest.includes(beforeId)) at = rest.indexOf(beforeId);
  else {
    const vis = visible.filter((x) => x !== id);
    at = vis.length ? rest.indexOf(vis[vis.length - 1]) + 1 : rest.length;
  }
  rest.splice(at, 0, id);
  return rest;
}

// Saves the new order and redraws, with a small animation (`from` = where the dropped cover was)
function reorder(id, beforeId, from) {
  const cards = () => [...document.querySelectorAll("#bookcase .book")];
  const visible = cards().map((c) => c.dataset.id);
  const seq = moveInSequence(customSequence(Library.all()).map((i) => i.id), id, beforeId, visible);
  const before = new Map(cards().map((c) => [c.dataset.id, c.getBoundingClientRect()]));
  if (from) before.set(id, from);
  if (!Order.set(seq)) { alert("The new order could not be saved (storage is full)."); return; }
  fillShelves();
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  cards().forEach((c) => {
    const a = before.get(c.dataset.id), b = c.getBoundingClientRect();
    if (!a || !c.animate) return;
    const dx = a.left - b.left, dy = a.top - b.top;
    if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
  });
}

// Keyboard alternative: Alt + arrow keys on a focused cover
function nudge(id, where) {
  const vis = [...document.querySelectorAll("#bookcase .book")].map((c) => c.dataset.id);
  const i = vis.indexOf(id);
  if (i < 0) return;
  if ((where === "earlier" || where === "start") && i === 0) return;
  if ((where === "later" || where === "end") && i === vis.length - 1) return;
  reorder(id, where === "earlier" ? vis[i - 1] : where === "later" ? vis[i + 2] || null : where === "start" ? vis[0] : null);
  const el = document.querySelector(`#bookcase .book[data-id="${id}"]`);
  if (el) el.focus();
}

let press = null, drag = null, suppressClickUntil = 0;

function cancelPress() { if (press) { clearTimeout(press.timer); press = null; } }

function beginDrag(x, y) {
  const card = press.card, r = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.classList.add("ghost");
  ghost.style.cssText = `width:${r.width}px;height:${r.height}px;left:${r.left}px;top:${r.top}px`;
  document.body.appendChild(ghost);
  card.classList.add("dragging");
  document.body.classList.add("is-dragging");
  const line = document.createElement("div");
  line.id = "dropLine";
  document.body.appendChild(line);
  drag = { id: card.dataset.id, card, ghost, line, offX: x - r.left, offY: y - r.top, x, y, target: null, speed: 0, raf: 0 };
  if (navigator.vibrate) navigator.vibrate(12);
  clearTimeout(press.timer);
  tickDrag();
}

// Which cover is the pointer nearest to, and on which side of it?
function dropTarget(x, y) {
  let best = null, bestD = Infinity;
  document.querySelectorAll("#bookcase .book:not(.dragging)").forEach((c) => {
    const r = c.getBoundingClientRect();
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    const d = dx * dx + dy * dy * 4;
    if (d < bestD) { bestD = d; best = { card: c, rect: r, side: x < r.left + r.width / 2 ? "before" : "after" }; }
  });
  return best;
}

function updateDrag() {
  const d = drag;
  d.ghost.style.left = d.x - d.offX + "px";
  d.ghost.style.top = d.y - d.offY + "px";
  d.target = dropTarget(d.x, d.y);
  if (d.target) {
    const r = d.target.rect, left = d.target.side === "before" ? r.left - SHELF.gap / 2 : r.right + SHELF.gap / 2;
    Object.assign(d.line.style, { display: "block", left: left - 1.5 + "px", top: r.top + "px", height: r.height + "px" });
  } else d.line.style.display = "none";
}

function tickDrag() {            // keeps the page scrolling while a cover is held near the top or bottom edge
  if (!drag) return;
  if (drag.speed) window.scrollBy(0, drag.speed);
  updateDrag();
  drag.raf = requestAnimationFrame(tickDrag);
}

function endDrag(drop) {
  const d = drag;
  drag = null;
  cancelAnimationFrame(d.raf);
  const from = d.ghost.getBoundingClientRect();
  d.ghost.remove(); d.line.remove();
  d.card.classList.remove("dragging");
  document.body.classList.remove("is-dragging");
  suppressClickUntil = Date.now() + 450;         // the tap that ends a drag must not open the cover
  if (!drop || !d.target) return;
  const cards = [...document.querySelectorAll("#bookcase .book:not(.dragging)")];
  const at = cards.indexOf(d.target.card);
  const beforeId = d.target.side === "before" ? cards[at].dataset.id : cards[at + 1] ? cards[at + 1].dataset.id : null;
  const visible = [...document.querySelectorAll("#bookcase .book")].map((c) => c.dataset.id);
  const nxt = visible[visible.indexOf(d.id) + 1] || null;
  if (beforeId === nxt) return;                  // dropped where it already was
  reorder(d.id, beforeId, from);
}

document.addEventListener("pointerdown", (e) => {
  const card = e.target.closest && e.target.closest("#bookcase .book");
  if (!card || (e.pointerType === "mouse" && e.button !== 0)) return;
  cancelPress();
  press = { card, x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse", timer: 0 };
  if (press.touch) press.timer = setTimeout(() => { if (press) beginDrag(press.x, press.y); }, 300);   // press and hold
});

document.addEventListener("pointermove", (e) => {
  if (drag) {
    drag.x = e.clientX; drag.y = e.clientY;
    const edge = 70, h = window.innerHeight;
    drag.speed = e.clientY < edge ? -Math.ceil((edge - e.clientY) / 6) : e.clientY > h - edge ? Math.ceil((e.clientY - (h - edge)) / 6) : 0;
    updateDrag();                                     // follow the finger right away
    e.preventDefault();
  } else if (press) {
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (press.touch) { if (moved > 10) cancelPress(); }          // the finger is scrolling: leave it alone
    else if (moved > 5) beginDrag(e.clientX, e.clientY);         // mouse: press and drag
  }
});
document.addEventListener("pointerup", (e) => {
  if (drag) { drag.x = e.clientX; drag.y = e.clientY; updateDrag(); endDrag(true); }
  cancelPress();
});
document.addEventListener("pointercancel", () => { if (drag) endDrag(false); cancelPress(); });
// Once a drag has started, stop the page from scrolling under the finger (needs a non-passive listener)
document.addEventListener("touchmove", (e) => { if (drag) e.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest("#bookcase .book")) e.preventDefault(); });
document.addEventListener("selectstart", (e) => { if (drag) e.preventDefault(); });
document.addEventListener("click", (e) => { if (Date.now() < suppressClickUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("keydown", (e) => {
  const card = e.target.closest && e.target.closest("#bookcase .book");
  if (!card || !e.altKey) return;
  const where = { ArrowLeft: "earlier", ArrowUp: "earlier", ArrowRight: "later", ArrowDown: "later", Home: "start", End: "end" }[e.key];
  if (where) { e.preventDefault(); nudge(card.dataset.id, where); }
});

const VIEWS = { home: homeView, stats: statsView, shelf: shelfView, library: libraryView, pick: pickView, form: formView, detail: detailView, settings: settingsView };
const NAV_FOR = { home: "home", stats: "stats", shelf: "shelf", library: "library", detail: "library", pick: "pick", form: "pick", settings: "settings" };


/* 5. ACTIONS: things that change data or screens -------------------------- */

function go(view, params = {}) {
  ui.view = view; ui.id = null; ui.type = null;
  ui.editing = null;            // which inline form is open on the details screen
  ui.pendingMeta = null; ui.formImported = {}; ui.coverAuto = false; ui.pendingFile = undefined; ui.review = null;
  ui.pendingCover = undefined;  // undefined = cover unchanged, null = removed, string = new image
  Object.assign(ui, params);
  render();
  window.scrollTo(0, 0);
}

function render() {
  $("#app").innerHTML = VIEWS[ui.view]();
  if (ui.view === "library") fillLibraryList();
  if (ui.view === "shelf") fillShelves();
  if (ui.view === "form") { setCoverPreview(ui.id ? Library.get(ui.id).cover : null); refreshSeriesCalc(); refreshFileInfo();
    const st = $("#itemForm").elements.status;
    if (st && ui.type === "movie") st.dataset.prev = st.value;
  }
  // A detail page opened from the bookshelf keeps the Library tab highlighted
  const navKey = ui.view === "detail" && ["shelf", "stats"].includes(ui.backTo) ? ui.backTo : NAV_FOR[ui.view];
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.nav === navKey));
}

function saveForm(form) {
  const type = ui.type;
  const item = ui.id ? { ...Library.get(ui.id) } : { id: newId(), type, createdAt: Date.now() };
  MEDIA[type].fields.forEach((f) => {
    if (f.kind === "rating") item.rating = Number(form.querySelector(".rating-input").dataset.rating) || 0;
    else if (f.kind === "favorite") item.favorite = form.elements.favorite.checked;
    else if (f.kind === "find" || f.kind === "calc" || f.kind === "bookfile" || f.kind === "when") { /* helpers, nothing to save */ }
    else if (f.kind === "seasons") {
      item.seasonEpisodes = readSeasons(form);
      item.seasonViews = readMarks(form).map((m, i) => ({ ...m, ...(item.seasonViews && item.seasonViews[i] && item.seasonViews[i].log ? { log: item.seasonViews[i].log } : {}) }));
    }
    else if (f.kind === "viewing") {
      const w = JSON.parse(form.elements.watchedWhen.value || "null");
      item.watchedWhen = w; item.watchedDate = whenIso(w);
    }
    else if (f.kind === "genres") item.genre = [...form.querySelectorAll('input[name="genre"]:checked')].map((i) => i.value);
    else {
      let v = form.elements[f.key].value.trim();
      if (f.kind === "number") v = v === "" ? "" : Number(v);
      item[f.key] = v;
    }
  });
  if (!item.title) { alert("Please enter a title."); return; }
  if (seasonCounts(item)) {                       // totals follow the per-season numbers
    item.totalSeasons = item.seasonEpisodes.length;
    item.totalEpisodes = item.seasonEpisodes.reduce((a, b) => a + b, 0);
  }
  if (item.status === "completed" && type !== "movie" && !item[doneDateKey(type)]) item[doneDateKey(type)] = today();
  if (ui.pendingCover === null) delete item.cover;
  else if (ui.pendingCover) item.cover = ui.pendingCover;
  if (ui.pendingMeta) {                           // remember where the info came from, and what was imported
    item.meta = ui.pendingMeta;
    item.imported = { ...(item.imported || {}), ...ui.formImported };
  }
  const file = ui.pendingFile;
  if (file === null) delete item.file;
  else if (file) item.file = { name: file.name, type: file.type || "", size: file.size };
  item.updatedAt = Date.now();
  if (!Library.save(item, { when: form.elements._when ? form.elements._when.value : "today" })) return;
  if (file === null) Files.remove(item.id).catch(() => {});
  else if (file) Files.put(item.id, file).catch(() => alert("The book file could not be stored on this device."));
  go("detail", { id: item.id });
}

// Returns the updated item, or null if it could not be saved.
function updateItem(id, changes) {
  const item = Library.get(id);
  if (!item) return null;
  const updated = { ...item, ...changes, updatedAt: Date.now() };
  return Library.save(updated) ? updated : null;
}

function setCoverPreview(src) {
  $("#coverPreview").innerHTML = src ? `<img src="${esc(src)}" alt="Cover preview">` : "<span>No cover</span>";
  $("#pickCoverBtn").textContent = src ? "Change image" : "Choose image";
  $("#removeCoverBtn").hidden = !src;
}

function saveJournalEntry(form) {
  const item = Library.get(ui.id);
  const text = form.elements.text.value.trim();
  if (!text) { alert("Please write a note."); return; }
  const progress = form.elements.progress.value.trim();
  const data = { date: form.elements.date.value || today(), progress: progress === "" ? "" : Number(progress), text };
  const journal = [...(item.journal || [])];
  const eid = form.dataset.eid;
  if (eid === "new") journal.push({ id: newId(), createdAt: Date.now(), ...data });
  else { const i = journal.findIndex((e) => e.id === eid); if (i >= 0) journal[i] = { ...journal[i], ...data }; }
  if (updateItem(ui.id, { journal })) { ui.editing = null; render(); }
}

function savePrediction(form) {
  const rating = Number(form.querySelector(".rating-input").dataset.rating) || 0;
  if (updateItem(ui.id, { predictionText: form.elements.text.value.trim(), predictionRating: rating })) {
    ui.editing = null; render();
  }
}

function exportLibrary() {
  const data = { app: "My Library", version: 1, exportedAt: new Date().toISOString(), items: Library.all(), order: Order.get() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "my-library-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Accepts either {items: [...]} (our export) or a bare array.
function importLibrary(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const list = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(list)) throw new Error("No items found");
      const valid = list
        .filter((i) => i && MEDIA[i.type] && typeof i.title === "string" && i.title.trim())
        .map((i) => ({
          ...i,
          id: i.id || newId(),
          status: STATUSES.some((s) => s.value === i.status) ? i.status : "planned",
          createdAt: i.createdAt || Date.now()
        }));
      if (!valid.length) throw new Error("No valid items");
      if (!confirm(`Import ${valid.length} item(s)? This replaces your current library.`)) return;
      Library.replaceAll(valid);
      if (Array.isArray(parsed.order)) Order.set(parsed.order.filter((id) => valid.some((i) => i.id === id)));
      go("library");
    } catch (e) {
      alert("Could not import this file. Please choose a JSON file exported from My Library.");
    }
  };
  reader.readAsText(file);
}


/* Series: per-season episode counts, live calculation and online search (TVmaze) ---- */

const seasonRows = (list, marks = []) => list.map((n, i) => `
  <div class="season-row" data-w="${marks[i] && typeof marks[i].w === "boolean" ? (marks[i].w ? 1 : 0) : ""}" data-when="${esc(JSON.stringify((marks[i] && marks[i].when) || null))}">
    <span>Season ${i + 1}</span>
    <input type="number" min="0" inputmode="numeric" data-season value="${esc(n)}" aria-label="Episodes in season ${i + 1}">
    <button type="button" class="link danger" data-action="removeSeason" data-i="${i}">Remove</button>
    <div class="season-view-row"><div class="seg2" role="group" aria-label="Season ${i + 1} status">
      <button type="button" data-action="rowNot" data-i="${i}">Not watched</button><button type="button" data-action="rowYes" data-i="${i}">Watched</button></div>
      <small class="sv-when"></small></div>
  </div>`).join("");

// Per-season viewing marks currently shown in the form: {} = no mark, or { w, when }
const readMarks = (form) => [...form.querySelectorAll(".season-row")].map((r) => (r.dataset.w === "" ? {} : { w: r.dataset.w === "1", when: JSON.parse(r.dataset.when || "null") }));

function formInference(form, i) {      // would this season count as watched without a mark?
  const ce = Number(form.elements.currentEpisode.value) || 0, cs = Number(form.elements.currentSeason.value) || (ce ? 1 : 0);
  return form.elements.status.value === "completed" || i + 1 < cs;
}

function paintSeasonRows(form) {
  form.querySelectorAll(".season-row").forEach((row, i) => {
    const explicit = row.dataset.w !== "", watched = explicit ? row.dataset.w === "1" : formInference(form, i);
    const [no, yes] = row.querySelectorAll(".seg2 button");
    no.classList.toggle("on", !watched);
    yes.classList.toggle("on", watched);
    const when = explicit && watched ? JSON.parse(row.dataset.when || "null") : null;
    row.querySelector(".sv-when").textContent = !watched ? "" : explicit ? "Watched · " + (formatWhen(when) || "date unknown") : "Counted as watched (no date recorded)";
  });
}

const readSeasons = (form) => [...form.querySelectorAll("[data-season]")].map((i) => Number(i.value) || 0);

function setSeasons(list, marks) {
  $("#seasonRows").innerHTML = seasonRows(list, marks || readMarks($("#itemForm")));
  refreshSeriesCalc();
}

// Keeps the calculated fields of the series form up to date while you type.
function refreshSeriesCalc() {
  const form = $("#itemForm");
  if (!form || !$("#seasonRows")) return;
  const seasons = readSeasons(form);
  const { totalSeasons, totalEpisodes } = form.elements;
  if (totalSeasons && totalEpisodes) {
    totalSeasons.readOnly = totalEpisodes.readOnly = seasons.length > 0;   // calculated when season data exists
    if (seasons.length) { totalSeasons.value = seasons.length; totalEpisodes.value = seasons.reduce((a, b) => a + b, 0); }
  }
  paintSeasonRows(form);
  const sp = seriesProgress({ seasonEpisodes: seasons, seasonViews: readMarks(form), status: form.elements.status.value,
    currentSeason: form.elements.currentSeason.value, currentEpisode: form.elements.currentEpisode.value });
  $("#seriesCalc").innerHTML = sp
    ? `Episodes watched: <strong>${sp.done} / ${sp.total}</strong> · ${Math.round((sp.done / sp.total) * 1000) / 10}%`
    : "Add the episodes of each season below and your episode progress is calculated automatically.";
}

/* Online metadata. One small "provider" per media type:
     search(query) -> [{ id, title, sub, img }]      load(id) -> normalised metadata
   Everything found is mapped onto the fields of that media type (metaToFields), so only relevant
   fields are filled. To add a source or a new media type, add an entry here and its fields in MEDIA. */

const httpsUrl = (u) => String(u || "").replace(/^http:\/\//, "https://");

async function getJson(url, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html || "").replace(/<\/p>\s*<p>|<br\s*\/?>/gi, "\n"), "text/html");
  return (doc.body.textContent || "").trim();
}

const COUNTRIES = { KR: "South Korea", JP: "Japan", CN: "China", TW: "Taiwan" };
const COUNTRY_LANGUAGE = { KR: "Korean", JP: "Japanese", CN: "Chinese", TW: "Chinese" };
const LANGUAGE_CODES = { eng: "English", fre: "French", fra: "French", kor: "Korean", jpn: "Japanese", ara: "Arabic",
  spa: "Spanish", tur: "Turkish", chi: "Chinese", zho: "Chinese", ger: "German", deu: "German", ita: "Italian",
  por: "Portuguese", hin: "Hindi", rus: "Russian" };
const GENRE_WORDS = { "Sci-Fi": ["sci-fi", "science fiction", "science-fiction"], "Slice of Life": ["slice of life"],
  Historical: ["historical", "history"], Animation: ["animat"], Biography: ["biograph"], "Young Adult": ["young adult"] };

// Source genres -> your categories (unknown ones are kept only when the source's list is already clean)
function mapGenres(list, keepUnknown) {
  const out = [];
  (list || []).forEach((raw) => {
    const g = String(raw).toLowerCase();
    const hit = CATEGORIES.find((c) => (GENRE_WORDS[c] || [c.toLowerCase()]).some((w) => g.includes(w)));
    const name = hit || (keepUnknown ? String(raw) : null);
    if (name && !out.includes(name)) out.push(name);
  });
  return out;
}

const pad2 = (n) => String(n).padStart(2, "0");
const OL_FIELDS = "key,title,author_name,first_publish_year,number_of_pages_median,cover_i,language,publisher,subject,isbn";
const AL_FIELDS = `id siteUrl format countryOfOrigin genres chapters startDate{year month day} description(asHtml:false)
  title{romaji english} coverImage{large} staff(perPage:4,sort:RELEVANCE){edges{role node{name{full}}}}
  externalLinks{site url} relations{edges{relationType node{title{romaji english}}}}`;
const anilist = async (query, variables) => {
  const d = await getJson("https://graphql.anilist.co", { method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables }) });
  if (d.errors) throw new Error("AniList error");
  return d.data;
};
const wikidata = (params) => getJson("https://www.wikidata.org/w/api.php?format=json&origin=*&" + params);

const PROVIDERS = {
  // TV series: TVmaze
  series: {
    source: "tvmaze", name: "TVmaze",
    async search(q) {
      const hits = (await getJson("https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(q))).slice(0, 8);
      return hits.map(({ show: x }) => ({ id: String(x.id), title: x.name + (x.premiered ? " (" + x.premiered.slice(0, 4) + ")" : ""),
        sub: [x.language, (x.genres || []).slice(0, 3).join(", "), x.status].filter(Boolean).join(" · "), img: x.image && x.image.medium }));
    },
    async load(id) {
      const show = await getJson("https://api.tvmaze.com/shows/" + id + "?embed[]=episodes&embed[]=crew");
      const eps = (show._embedded && show._embedded.episodes) || [];
      const per = {};      // regular episodes per season (specials are left out; you can add them by hand)
      eps.forEach((e) => { if ((!e.type || e.type === "regular") && e.number != null) per[e.season] = (per[e.season] || 0) + 1; });
      const seasons = Array.from({ length: Math.max(0, ...Object.keys(per).map(Number)) }, (_, i) => per[i + 1] || 0);
      const runtimes = eps.map((e) => e.runtime).filter(Boolean).sort((a, b) => a - b);
      const crew = (show._embedded && show._embedded.crew) || [];
      const net = show.network || show.webChannel || {};
      return { sourceId: String(show.id), title: show.name, releaseDate: show.premiered || "", airEnd: show.ended || "",
        creator: crew.filter((c) => c.type === "Creator").map((c) => c.person.name).slice(0, 3).join(", "),
        origin: (net.country && net.country.name) || "", language: show.language || "", genres: mapGenres(show.genres, true),
        synopsis: htmlToText(show.summary), seasons, publisher: net.name || "",
        runtime: show.averageRuntime || show.runtime || runtimes[Math.floor(runtimes.length / 2)] || "",
        url: show.url, ids: { tvmaze: show.id, imdb: show.externals && show.externals.imdb },
        coverUrl: show.image ? httpsUrl(show.image.medium || show.image.original) : "" };
    }
  },

  // Books: Open Library
  book: {
    source: "openlibrary", name: "Open Library",
    async search(q) {
      const d = await getJson(`https://openlibrary.org/search.json?limit=8&fields=${OL_FIELDS}&q=` + encodeURIComponent(q));
      return (d.docs || []).map((x) => ({ id: x.key, title: x.title + (x.first_publish_year ? " (" + x.first_publish_year + ")" : ""),
        sub: [(x.author_name || []).slice(0, 2).join(", "), x.number_of_pages_median && x.number_of_pages_median + " pages"].filter(Boolean).join(" · "),
        img: x.cover_i && `https://covers.openlibrary.org/b/id/${x.cover_i}-S.jpg` }));
    },
    async load(key) {
      const [work, found] = await Promise.all([
        getJson("https://openlibrary.org" + key + ".json").catch(() => ({})),
        getJson(`https://openlibrary.org/search.json?limit=1&fields=${OL_FIELDS}&q=` + encodeURIComponent("key:" + key)).catch(() => ({ docs: [] }))]);
      const doc = (found.docs || [])[0] || {};
      const desc = work.description && typeof work.description === "object" ? work.description.value : work.description;
      const subjects = [...(doc.subject || []), ...(work.subjects || [])];
      const series = subjects.find((x) => /^series:/i.test(x));
      const cover = doc.cover_i || (work.covers || [])[0];
      return { sourceId: key, title: work.title || doc.title, creator: (doc.author_name || []).slice(0, 3).join(", "),
        releaseDate: doc.first_publish_year ? String(doc.first_publish_year) : "",
        language: doc.language && doc.language.length === 1 ? LANGUAGE_CODES[doc.language[0]] || "" : "",   // only when unambiguous
        genres: mapGenres(subjects, false).slice(0, 4),
        synopsis: String(desc || "").split(/\r?\n\r?\n-{5,}/)[0].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim(),
        pages: doc.number_of_pages_median || "", publisher: (doc.publisher || [])[0] || "",
        franchise: series ? series.replace(/^series:/i, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "",
        url: "https://openlibrary.org" + key, ids: { openLibrary: key, isbn: (doc.isbn || [])[0] },
        coverUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : "" };
    }
  },

  // Webtoons / manhwa / manga: AniList
  webtoon: {
    source: "anilist", name: "AniList",
    async search(q) {
      const d = await anilist(`query($q:String){Page(perPage:8){media(search:$q,type:MANGA,sort:SEARCH_MATCH){${AL_FIELDS}}}}`, { q });
      return d.Page.media.map((m) => ({ id: String(m.id), title: (m.title.english || m.title.romaji) + (m.startDate && m.startDate.year ? " (" + m.startDate.year + ")" : ""),
        sub: [m.format, COUNTRIES[m.countryOfOrigin], (m.genres || []).slice(0, 3).join(", ")].filter(Boolean).join(" · "), img: m.coverImage && m.coverImage.large }));
    },
    async load(id) {
      const m = (await anilist(`query($id:Int){Media(id:$id){${AL_FIELDS}}}`, { id: Number(id) })).Media;
      const people = [...new Set(((m.staff && m.staff.edges) || []).filter((e) => /story|art/i.test(e.role)).map((e) => e.node.name.full))];
      const sd = m.startDate || {};
      const platform = (m.externalLinks || []).find((l) => /webtoon|tapas|naver|kakao|lezhin|tappytoon|manta|pocket/i.test(l.site));
      const rel = ((m.relations && m.relations.edges) || []);
      const base = rel.find((e) => e.relationType === "PARENT") || rel.find((e) => e.relationType === "PREQUEL");   // best guess
      return { sourceId: String(m.id), title: m.title.english || m.title.romaji, creator: people.slice(0, 2).join(", "),
        releaseDate: sd.year ? [sd.year, sd.month && pad2(sd.month), sd.day && pad2(sd.day)].filter(Boolean).join("-") : "",
        origin: COUNTRIES[m.countryOfOrigin] || "", language: COUNTRY_LANGUAGE[m.countryOfOrigin] || "",
        genres: mapGenres(m.genres, true), synopsis: htmlToText(m.description), chapters: m.chapters || "",
        publisher: platform ? platform.site : "", link: platform ? platform.url : "",
        franchise: base ? base.node.title.english || base.node.title.romaji : "",
        url: m.siteUrl, ids: { anilist: m.id }, coverUrl: m.coverImage ? m.coverImage.large : "" };
    }
  },

  // Movies: Wikidata (facts) + Wikipedia (summary and poster)
  movie: {
    source: "wikidata", name: "Wikidata",
    async search(q) {
      const all = (await wikidata("action=wbsearchentities&type=item&language=en&uselang=en&limit=15&search=" + encodeURIComponent(q))).search || [];
      const films = all.filter((x) => /film|movie/i.test(x.description || ""));
      return (films.length ? films : all.slice(0, 5)).slice(0, 8).map((x) => ({ id: x.id, title: x.label, sub: x.description || "" }));
    },
    async load(id) {
      const e = (await wikidata("action=wbgetentities&props=claims|sitelinks|labels&languages=en&sitefilter=enwiki&ids=" + id)).entities[id];
      const claims = e.claims || {};
      const vals = (p) => (claims[p] || []).map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter(Boolean);
      const qids = (p) => vals(p).map((v) => v.id).filter(Boolean);
      const want = [...new Set(["P57", "P136", "P495", "P364", "P179", "P272"].flatMap(qids))].slice(0, 50);
      const lab = want.length ? (await wikidata("action=wbgetentities&props=labels&languages=en&ids=" + want.join("|"))).entities : {};
      const L = (p) => qids(p).map((q) => lab[q] && lab[q].labels && lab[q].labels.en && lab[q].labels.en.value).filter(Boolean);
      const dates = vals("P577").filter((v) => v.time).sort((a, b) => a.time.localeCompare(b.time));
      const d0 = dates[0], date = d0 ? d0.time.replace(/^\+/, "").slice(0, 10) : "";
      const dur = vals("P2047")[0];
      let minutes = dur ? Number(dur.amount) : 0;
      if (dur && /Q11574$/.test(dur.unit)) minutes /= 60; else if (dur && /Q25235$/.test(dur.unit)) minutes *= 60;
      const wiki = e.sitelinks && e.sitelinks.enwiki && e.sitelinks.enwiki.title;
      const sum = wiki ? await getJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wiki.replace(/ /g, "_"))).catch(() => null) : null;
      const img = vals("P18")[0];
      return { sourceId: id, title: (e.labels && e.labels.en && e.labels.en.value) || wiki || "",
        releaseDate: d0 ? (d0.precision && d0.precision < 11 ? date.slice(0, 4) : date) : "",
        creator: L("P57").slice(0, 3).join(", "), origin: L("P495")[0] || "", language: L("P364")[0] || "",
        genres: mapGenres(L("P136"), false), synopsis: sum ? sum.extract : "", runtime: minutes ? Math.round(minutes) : "",
        publisher: L("P272")[0] || "", franchise: L("P179")[0] || "",
        url: (sum && sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page) || "https://www.wikidata.org/wiki/" + id,
        ids: { wikidata: id, imdb: vals("P345")[0] },
        coverUrl: sum && sum.thumbnail ? sum.thumbnail.source : img ? "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(img) + "?width=400" : "" };
    }
  }
};

// Normalised metadata -> only the fields this media type really has
function metaToFields(type, m) {
  const has = (k) => MEDIA[type].fields.some((f) => f.key === k);
  const out = {};
  const put = (k, v) => { if (has(k) && hasValue(v) && !(Array.isArray(v) && !v.length)) out[k] = v; };
  const date = String(m.releaseDate || "");
  put("title", m.title);
  put(MEDIA[type].creatorKey, m.creator);
  if (type === "movie") put("year", Number(date.slice(0, 4)) || "");
  else if (type === "series") { put("airStart", date.length === 10 ? date : ""); put("airEnd", m.airEnd); }
  else put("publishedDate", date);
  put("origin", m.origin); put("language", m.language); put("genre", m.genres); put("synopsis", m.synopsis);
  put("publisher", m.publisher); put("franchise", m.franchise); put("link", m.link);
  put("totalPages", m.pages); put("totalChapters", m.chapters); put("seasonEpisodes", m.seasons);
  put(type === "series" ? "episodeLength" : "totalMinutes", m.runtime);
  return out;
}

const metaRecord = (type, m) => ({ source: PROVIDERS[type].source, sourceName: PROVIDERS[type].name, id: m.sourceId,
  url: safeUrl(m.url), ids: Object.fromEntries(Object.entries(m.ids || {}).filter(([, v]) => hasValue(v))), updatedAt: Date.now() });

// Cover picture -> small local picture. Tries the picture directly, then a free image proxy (some hosts block direct reads).
async function posterToCover(url) {
  for (const u of [url, "https://wsrv.nl/?w=400&url=" + encodeURIComponent(url)]) {
    try {
      const res = await fetch(u);
      if (res.ok) return await resizeImage(await res.blob());
    } catch (e) { /* try the next way */ }
  }
  return null;
}

// Search (new item: uses the Title box; existing item: uses the search box on its details page)
async function runSearch() {
  const inForm = ui.view === "form";
  const type = inForm ? ui.type : Library.get(ui.id).type;
  const q = (inForm ? $("#itemForm").elements.title.value : $("#findQuery").value).trim();
  const box = $("#findResults");
  if (!q) { box.innerHTML = "<p class=\"meta\">Type the title first.</p>"; return; }
  if (!navigator.onLine) { box.innerHTML = '<p class="meta">You are offline. Searching needs internet, but you can still fill in the form by hand.</p>'; return; }
  box.innerHTML = '<p class="meta">Searching…</p>';
  try {
    const hits = await PROVIDERS[type].search(q);
    box.innerHTML = hits.length ? hits.map((h) => `
      <button type="button" class="result" data-action="pickResult" data-id="${esc(h.id)}">
        ${h.img ? `<img src="${esc(httpsUrl(h.img))}" alt="">` : `<span class="noimg">${MEDIA[type].icon}</span>`}
        <span><strong>${esc(h.title)}</strong><small>${esc(h.sub || "")}</small></span>
      </button>`).join("") : '<p class="meta">No matching titles found. You can still fill in the form by hand.</p>';
  } catch (e) {
    box.innerHTML = '<p class="meta">Could not reach the online database. Check your connection and try again.</p>';
  }
}

// -- Form helpers: read / write one field of the add/edit form by its key
function formString(form, key) {
  if (key === "genre") return [...form.querySelectorAll('input[name="genre"]:checked')].map((i) => i.value).join("|");
  if (key === "seasonEpisodes") return readSeasons(form).join(",");
  const el = form.elements[key];
  return el ? String(el.value).trim() : "";
}

function setInForm(form, key, val) {
  if (key === "genre") {
    const tags = form.querySelector(".tags");
    form.querySelectorAll('input[name="genre"]').forEach((i) => { i.checked = false; });
    val.forEach((g) => {
      let input = [...form.querySelectorAll('input[name="genre"]')].find((i) => i.value.toLowerCase() === g.toLowerCase());
      if (!input) {
        tags.insertAdjacentHTML("beforeend", `<label class="tag"><input type="checkbox" name="genre" value="${esc(g)}"><span>${esc(g)}</span></label>`);
        input = tags.lastElementChild.querySelector("input");
      }
      input.checked = true;
    });
  } else if (key === "seasonEpisodes") setSeasons(val);
  else if (key === "language") {
    const sel = form.elements.language;
    if (![...sel.options].some((o) => o.value === val)) sel.add(new Option(val, val));
    sel.value = val;
  } else if (form.elements[key]) form.elements[key].value = val;
}

// New item: fill the form. Anything you typed yourself is left alone; earlier imports can be replaced.
async function importIntoForm(res) {
  const type = ui.type, form = $("#itemForm"), box = $("#findResults");
  box.innerHTML = '<p class="meta">Importing…</p>';
  let meta;
  try { meta = await PROVIDERS[type].load(res.id); }
  catch (e) { box.innerHTML = '<p class="meta">Could not load this title. Please try again.</p>'; return; }
  const fields = metaToFields(type, meta);
  let kept = 0;
  for (const [k, v] of Object.entries(fields)) {
    const cur = formString(form, k);
    if (k !== "title" && cur !== "" && cur !== ui.formImported[k]) { kept++; continue; }
    setInForm(form, k, v);
    ui.formImported[k] = fieldString({ [k]: v }, k);
  }
  ui.pendingMeta = metaRecord(type, meta);
  let note = "Imported" + (kept ? ` (kept the ${kept} field${kept > 1 ? "s" : ""} you had filled in yourself)` : "") + ". Check the details, then tap Save.";
  if (meta.coverUrl && (ui.pendingCover === undefined || ui.coverAuto)) {
    const cover = await posterToCover(meta.coverUrl);
    if (cover) { ui.pendingCover = cover; ui.coverAuto = true; setCoverPreview(cover); }
    else note += " The cover could not be saved; you can choose a picture from your gallery.";
  }
  if (type === "series" && !fields.seasonEpisodes) note += " No episode list was found; add the seasons by hand to get automatic progress.";
  box.innerHTML = `<p class="meta">✨ ${esc(note)}</p>`;
}

// Existing item: show what the online source says and let you tick what to apply
async function startReview(res) {
  const item = Library.get(ui.id), box = $("#findResults");
  box.innerHTML = '<p class="meta">Loading…</p>';
  try {
    const meta = await PROVIDERS[item.type].load(res.id);
    ui.review = { meta: metaRecord(item.type, meta), fields: metaToFields(item.type, meta), coverUrl: meta.coverUrl };
    ui.editing = null;
    render();
  } catch (e) { box.innerHTML = '<p class="meta">Could not load the online info. Check your connection and try again.</p>'; }
}

async function applyReview() {
  const item = Library.get(ui.id), r = ui.review;
  if (!item || !r) return;
  const changes = {}, imported = { ...(item.imported || {}) };
  [...document.querySelectorAll('input[name="rv"]:checked')].forEach((i) => {
    changes[i.value] = r.fields[i.value];
    imported[i.value] = fieldString({ [i.value]: r.fields[i.value] }, i.value);
  });
  if (changes.seasonEpisodes) {
    changes.totalSeasons = changes.seasonEpisodes.length;
    changes.totalEpisodes = changes.seasonEpisodes.reduce((a, b) => a + b, 0);
  }
  const wantCover = document.querySelector('input[name="rvCover"]:checked');
  if (wantCover && r.coverUrl) {
    const cover = await posterToCover(r.coverUrl);
    if (cover) changes.cover = cover; else alert("The cover could not be saved.");
  }
  if (updateItem(ui.id, { ...changes, imported, meta: r.meta })) { ui.review = null; render(); }
}

function reviewHtml(item) {
  const r = ui.review;
  if (!r) return "";
  const imported = item.imported || {};
  const rows = Object.entries(r.fields).map(([k, v]) => {
    const cur = fieldString(item, k), nw = fieldString({ [k]: v }, k);
    if (cur === nw) return "";
    const f = MEDIA[item.type].fields.find((x) => x.key === k) || { key: k, label: k, kind: "text" };
    const show = (o) => displayValue(o, f) || "—";
    const safe = cur === "" || cur === imported[k];       // empty or still exactly as imported -> safe to update
    return `<label class="check rv"><input type="checkbox" name="rv" value="${esc(k)}" ${safe ? "checked" : ""}>
      <span><strong>${esc(f.label)}</strong><small>${esc(show(item))} → ${esc(show({ ...item, [k]: v }))}</small>
      ${safe ? "" : "<small>You edited this yourself, so it is not ticked.</small>"}</span></label>`;
  }).filter(Boolean);
  const cover = r.coverUrl ? `<label class="check rv"><input type="checkbox" name="rvCover" ${item.cover ? "" : "checked"}>
    <span><strong>Cover</strong><small>${item.cover ? "Replace your cover with the online one" : "Add the online cover"}</small></span></label>` : "";
  return `<div class="review">
    <p class="meta">Found on ${esc(r.meta.sourceName)}. Tick what to apply; your own edits stay unless you tick them.</p>
    ${rows.join("") || '<p class="meta">Everything is already up to date.</p>'}${cover}
    <div class="actions"><button class="btn primary" data-action="applyReview">Apply</button>
      <button class="btn" data-action="reviewAll">Tick all</button><button class="btn" data-action="cancelReview">Cancel</button></div></div>`;
}

const ID_LABELS = { tvmaze: "TVmaze ID", anilist: "AniList ID", wikidata: "Wikidata ID", openLibrary: "Open Library key", isbn: "ISBN" };

function infoPanel(item) {
  const m = item.meta, rows = [];
  const row = (k, v) => `<div class="row"><span>${k}</span><span>${v}</span></div>`;
  if (m && m.url) rows.push(row("Source", `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.sourceName)}</a>`));
  Object.entries((m && m.ids) || {}).forEach(([k, v]) => {
    if (k === "imdb") rows.push(row("IMDb", `<a href="https://www.imdb.com/title/${esc(v)}/" target="_blank" rel="noopener">${esc(v)}</a>`));
    else rows.push(row(ID_LABELS[k] || esc(k), esc(v)));
  });
  const controls = ui.editing === "find"
    ? `<div class="field"><input id="findQuery" type="text" value="${esc(item.title)}" aria-label="Title to search"></div>
       <div class="actions"><button class="btn primary" data-action="findOnline">🔍 Search ${esc(PROVIDERS[item.type].name)}</button>
       <button class="btn" data-action="cancelEdit">Cancel</button></div>`
    : `<div class="actions"><button class="btn" data-action="${m ? "refreshInfo" : "startFind"}">${m ? "🔄 Refresh online info" : "🔍 Find info online"}</button>
       ${m ? '<button class="btn" data-action="startFind">Choose another match</button>' : ""}</div>`;
  return `<div class="panel"><h2>Online info</h2>${rows.join("")}${controls}<div id="findResults"></div>${reviewHtml(item)}</div>`;
}

// Other works (any type) with the same franchise name
function franchisePanel(item) {
  const name = String(item.franchise || "").trim().toLowerCase();
  if (!name) return "";
  const related = Library.all().filter((i) => i.id !== item.id && String(i.franchise || "").trim().toLowerCase() === name);
  return `<div class="panel"><h2>Franchise · ${esc(item.franchise)}</h2>${related.length
    ? related.map((i) => `<div class="trow" data-action="open" data-id="${i.id}"><span>${MEDIA[i.type].icon} ${esc(i.title)}</span><small>${MEDIA[i.type].label} · ${statusLabel(i.type, i.status)}</small></div>`).join("")
    : '<p class="empty">No other works linked yet. Give another item the same franchise name to link them.</p>'}</div>`;
}

/* Read / Watch / Start actions ---------------------------------------------- */

function mediaActions(item) {
  const b = [];
  const btn = (a, label) => `<button class="btn" data-action="${a}">${label}</button>`;
  const link = safeUrl(item.link);
  if (item.type === "book" && (item.file || link)) b.push(btn("openMedia", item.file ? "📖 Open book" : "📖 Read online"));
  if (item.type === "webtoon" && link) b.push(btn("openMedia", "📖 Read"));
  if ((item.type === "series" || item.type === "movie") && link) b.push(btn("openMedia", "▶ Watch"));
  if (item.status !== "active" && item.status !== "completed") b.push(btn("startItem", item.type === "book" || item.type === "webtoon" ? "▶ Start reading" : "▶ Start watching"));
  if (item.type === "series" && item.status !== "completed") b.push(btn("nextUnit", "⏭ Next episode"));
  if (item.type === "webtoon" && item.status !== "completed") b.push(btn("nextUnit", "⏭ Next chapter"));
  if (item.type === "movie" && item.status !== "completed") b.push(btn("markWatched", "✔ Mark as watched"));
  return b.length ? `<div class="actions">${b.join("")}</div>` : "";
}

function startItem() {
  const it = Library.get(ui.id), changes = statusChanges(it, "active");
  if (it.type !== "movie" && !it.startDate) changes.startDate = today();
  updateItem(ui.id, changes);
  render();
}

// One more chapter / episode. For series the next season starts when the current one is finished.
function nextUnit() {
  const it = Library.get(ui.id);
  const changes = it.status === "active" ? {} : statusChanges(it, "active");
  if (!it.startDate) changes.startDate = today();
  if (it.type === "webtoon") {
    const n = (Number(it.currentChapter) || 0) + 1, total = Number(it.totalChapters) || 0;
    changes.currentChapter = total ? Math.min(n, total) : n;
  } else {
    const seasons = seasonCounts(it) || [];
    let s = Number(it.currentSeason) || 1, e = (Number(it.currentEpisode) || 0) + 1;
    if (seasons[s - 1] && e > seasons[s - 1]) { if (s < seasons.length) { s++; e = 1; } else e = seasons[s - 1]; }
    changes.currentSeason = s; changes.currentEpisode = e;
  }
  updateItem(ui.id, changes);
  render();
}

function openLink(url) {
  const u = safeUrl(url);
  if (!u) { alert("This link does not look valid. Check it in Edit."); return; }
  window.open(u, "_blank", "noopener");
}

// A browser cannot open a path on your phone, so the book file is kept inside the app and opened from there.
async function openBook(item) {
  try {
    const blob = await Files.get(item.id);
    if (!blob) { alert("This book file is not stored on this device (files are not part of exports). Attach it again in Edit."); return; }
    const url = URL.createObjectURL(blob);
    if (/pdf/i.test(item.file.type) || /\.pdf$/i.test(item.file.name)) window.open(url, "_blank");
    else {                                   // e.g. EPUB: the phone saves it, then offers its reader apps
      const a = document.createElement("a");
      a.href = url; a.download = item.file.name;
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { alert("Could not open the book file."); }
}

const openMedia = (item) => (item.type === "book" && item.file ? openBook(item) : openLink(item.link));

function refreshFileInfo() {
  const el = $("#fileInfo");
  if (!el) return;
  const stored = ui.id ? (Library.get(ui.id) || {}).file : null;
  const file = ui.pendingFile === null ? null : ui.pendingFile || stored;
  el.textContent = file ? `${file.name} (${fmtSize(file.size)})` : "No file attached.";
  $("#removeFileBtn").hidden = !file;
}


/* Viewing dates: the small window, the per-season status and the movie status ---- */

// Asks "when?". Resolves to { y, m?, d? }, null (watched, date unknown) or undefined (cancelled).
// `initial`: undefined = new (today suggested), null = unknown, or an existing date.
function askWhen(title, initial) {
  return new Promise((resolve) => {
    const now = new Date();
    const w = initial || { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    const kind0 = initial === null ? "none" : w.d ? "day" : w.m ? "month" : "year";
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>
      <p class="meta">Say as much as you remember. An exact date is not required.</p>
      <label class="field"><span class="lbl">How exactly do you remember?</span>
        <select id="whenKind"><option value="day">Exact date</option><option value="month">Month and year</option>
        <option value="year">Year only</option><option value="none">I don't remember</option></select></label>
      <div id="whenDay" class="field"><input id="whenDate" type="date" value="${esc(w.d && w.m ? whenIso(w) : whenIso({ y: w.y, m: w.m || now.getMonth() + 1, d: now.getDate() }))}"></div>
      <div id="whenMonth" class="field" hidden><div class="quick">
        <select id="whenM" aria-label="Month">${MONTH_NAMES.map((n, i) => `<option value="${i + 1}" ${(w.m || now.getMonth() + 1) === i + 1 ? "selected" : ""}>${n}</option>`).join("")}</select>
        <input id="whenY1" type="number" min="1900" max="2100" inputmode="numeric" placeholder="Year" value="${w.y || ""}"></div></div>
      <div id="whenYear" class="field" hidden><input id="whenY2" type="number" min="1900" max="2100" inputmode="numeric" placeholder="Year" value="${w.y || ""}"></div>
      <p id="whenError" class="meta" hidden></p>
      <div class="actions"><button type="button" class="btn primary" id="whenSave">Save</button><button type="button" class="btn" id="whenCancel">Cancel</button></div></div>`;
    document.body.appendChild(back);
    const q = (id) => back.querySelector("#" + id);
    const finish = (v) => { document.removeEventListener("keydown", onKey); back.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") finish(undefined); };
    const sync = () => {
      const k = q("whenKind").value;
      q("whenDay").hidden = k !== "day"; q("whenMonth").hidden = k !== "month"; q("whenYear").hidden = k !== "year";
      q("whenError").hidden = true;
    };
    const year = (v) => { const y = Number(v); return Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : 0; };
    q("whenKind").value = kind0;
    q("whenKind").addEventListener("change", sync);
    q("whenSave").addEventListener("click", () => {
      const k = q("whenKind").value;
      let result;
      if (k === "none") result = null;
      else if (k === "day") result = parseIso(q("whenDate").value);
      else if (k === "month") result = year(q("whenY1").value) ? { y: year(q("whenY1").value), m: Number(q("whenM").value) } : undefined;
      else result = year(q("whenY2").value) ? { y: year(q("whenY2").value) } : undefined;
      if (result === undefined || (k === "day" && !result)) {
        q("whenError").textContent = k === "day" ? "Choose a date, or pick a less exact option." : "Enter a year between 1900 and 2100.";
        q("whenError").hidden = false;
        return;
      }
      finish(result);
    });
    q("whenCancel").addEventListener("click", () => finish(undefined));
    back.addEventListener("click", (e) => { if (e.target === back) finish(undefined); });
    document.addEventListener("keydown", onKey);
    sync();
    q("whenKind").focus();
  });
}

function setSeasonView(item, i, patch) {
  const views = (seasonCounts(item) || []).map((_, k) => (item.seasonViews || [])[k] || {});
  views[i] = { ...views[i], ...patch };
  updateItem(item.id, { seasonViews: views });
  render();
}

// Per-season "Not watched / Watched" on the details page
function seasonsPanel(item) {
  const seasons = seasonCounts(item);
  if (!seasons) return "";
  const am = seasonAmounts(item);
  const rows = seasons.map((c, i) => {
    const v = (item.seasonViews || [])[i] || {}, a = am[i];
    const info = !a.watched ? "" : a.explicit
      ? `Watched · ${esc(formatWhen(v.when) || "date unknown")} <button class="link" data-action="seasonYes" data-i="${i}">Change date</button>`
      : `Counted as watched (no date recorded) <button class="link" data-action="seasonYes" data-i="${i}">Add date</button>`;
    return `<div class="season-view"><div class="sv-head"><strong>Season ${i + 1}</strong><small>${c} episodes${!a.watched && a.amount ? " · " + a.amount + " watched" : ""}</small></div>
      <div class="seg2" role="group" aria-label="Season ${i + 1} status">
        <button class="${a.watched ? "" : "on"}" data-action="seasonNot" data-i="${i}">Not watched</button>
        <button class="${a.watched ? "on" : ""}" data-action="seasonYes" data-i="${i}">Watched</button></div>
      ${info ? `<small class="sv-when">${info}</small>` : ""}</div>`;
  }).join("");
  return `<div class="panel"><h2>Seasons</h2>${rows}</div>`;
}

// Movies: "Already watched" asks for the viewing date; the status stays unchanged if you cancel
async function quickStatus(value) {
  const it = Library.get(ui.id);
  if (it.type === "movie" && value === "completed") {
    const w = await askWhen("When did you watch it?", watchedWhenOf(it) || undefined);
    if (w === undefined) { render(); return; }
    updateItem(ui.id, { status: "completed", watchedWhen: w, watchedDate: whenIso(w) });
  } else updateItem(ui.id, statusChanges(it, value));
  render();
}

async function movieStatusChanged(sel) {
  const form = sel.form, box = $("#viewingBox");
  if (sel.value !== "completed") { box.hidden = true; sel.dataset.prev = sel.value; return; }
  const cur = JSON.parse(form.elements.watchedWhen.value || "null");
  const w = await askWhen("When did you watch it?", cur || undefined);
  if (w === undefined) { sel.value = sel.dataset.prev || "planned"; return; }
  form.elements.watchedWhen.value = JSON.stringify(w);
  $("#viewingText").textContent = formatWhen(w) || "Date unknown";
  box.hidden = false;
  sel.dataset.prev = "completed";
}


/* 6. EVENTS: one listener per event type (event delegation) --------------- */

const ACTIONS = {
  open:       (el) => go("detail", { id: el.dataset.id, backTo: ["shelf", "stats"].includes(ui.view) ? ui.view : "library" }),
  category:   (el) => { ui.filters = { q: "", type: el.dataset.type, status: "all" }; go("library"); },
  filterType: (el) => { ui.filters.type = el.dataset.type; render(); },
  pickType:   (el) => go("form", { type: el.dataset.type }),
  cancelForm: () => (ui.id ? go("detail", { id: ui.id }) : go("home")),
  back:       () => go(ui.backTo || "library"),
  libSection: (el) => { ui.lib.section = el.dataset.value; ui.lib.arc = "all"; render(); },
  libArc:     (el) => { ui.lib.arc = el.dataset.value; render(); },
  pickCover:  () => $("#coverFile").click(),
  removeCover: () => { ui.pendingCover = null; ui.coverAuto = false; setCoverPreview(null); },
  findOnline: () => runSearch(),
  pickResult: (el) => (ui.view === "form" ? importIntoForm : startReview)({ id: el.dataset.id }),
  startFind:  () => { ui.editing = "find"; render(); },
  refreshInfo: () => startReview({ id: Library.get(ui.id).meta.id }),
  applyReview: () => applyReview(),
  reviewAll:  () => document.querySelectorAll('input[name="rv"],input[name="rvCover"]').forEach((i) => { i.checked = true; }),
  cancelReview: () => { ui.review = null; render(); },
  pickFile:   () => $("#bookFile").click(),
  removeFile: () => { ui.pendingFile = null; refreshFileInfo(); },
  openMedia:  () => openMedia(Library.get(ui.id)),
  startItem:  () => startItem(),
  nextUnit:   () => nextUnit(),
  markWatched: () => quickStatus("completed"),
  addSeason:  () => { const list = readSeasons($("#itemForm")); list.push(list.length ? list[list.length - 1] : 10); setSeasons(list); },
  removeSeason: (el) => { const f = $("#itemForm"), list = readSeasons(f), marks = readMarks(f), i = Number(el.dataset.i); list.splice(i, 1); marks.splice(i, 1); setSeasons(list, marks); },
  rowYes: async (el) => {
    const f = $("#itemForm"), row = el.closest(".season-row"), i = Number(el.dataset.i);
    const was = row.dataset.w === "1" ? JSON.parse(row.dataset.when || "null") : row.dataset.w === "" && formInference(f, i) ? null : undefined;
    const w = await askWhen(`When did you watch Season ${i + 1}?`, was);
    if (w === undefined) return;
    row.dataset.w = "1"; row.dataset.when = JSON.stringify(w);
    refreshSeriesCalc();
  },
  rowNot: (el) => { const row = el.closest(".season-row"); row.dataset.w = "0"; row.dataset.when = "null"; refreshSeriesCalc(); },
  editViewing: async () => {
    const f = $("#itemForm"), cur = JSON.parse(f.elements.watchedWhen.value || "null");
    const w = await askWhen("When did you watch it?", cur || undefined);
    if (w === undefined) return;
    f.elements.watchedWhen.value = JSON.stringify(w);
    $("#viewingText").textContent = formatWhen(w) || "Date unknown";
  },
  seasonYes: async (el) => {
    const it = Library.get(ui.id), i = Number(el.dataset.i), v = (it.seasonViews || [])[i] || {}, am = seasonAmounts(it)[i];
    const w = await askWhen(`When did you watch Season ${i + 1}?`, v.w === true ? v.when || null : am.watched ? null : undefined);
    if (w === undefined) return;
    setSeasonView(it, i, { w: true, when: w });
  },
  seasonNot: (el) => setSeasonView(Library.get(ui.id), Number(el.dataset.i), { w: false, when: null }),
  editPrediction: () => { ui.editing = "prediction"; render(); },
  addEntry:   () => { ui.editing = "journal:new"; render(); },
  editEntry:  (el) => { ui.editing = "journal:" + el.dataset.eid; render(); },
  cancelEdit: () => { ui.editing = null; render(); },
  statsArea:   (el) => { ui.stats.area = el.dataset.area; render(); },
  statsPeriod: (el) => { ui.stats.period = el.dataset.period; render(); },
  deleteEntry: (el) => {
    if (!confirm("Delete this journal entry?")) return;
    const journal = (Library.get(ui.id).journal || []).filter((e) => e.id !== el.dataset.eid);
    if (updateItem(ui.id, { journal })) render();
  },
  edit:       () => go("form", { id: ui.id, type: Library.get(ui.id).type }),
  toggleFav:  () => { updateItem(ui.id, { favorite: !Library.get(ui.id).favorite }); render(); },
  delete:     () => {
    if (confirm("Delete this item? This cannot be undone.")) { Files.remove(ui.id).catch(() => {}); Library.remove(ui.id); go(ui.backTo || "library"); }
  },
  star: (el) => {
    const box = el.closest(".rating-input");
    const value = Number(el.dataset.value);
    const next = Number(box.dataset.rating) === value ? 0 : value;   // tap the same star again to clear
    box.dataset.rating = next;
    box.querySelectorAll(".star-btn").forEach((b) => b.classList.toggle("on", Number(b.dataset.value) <= next));
  },
  export: exportLibrary,
  import: () => $("#importFile").click(),
  installApp: async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    render();
  },
  clear:  () => {
    if (confirm("Delete ALL your data? This cannot be undone. Consider exporting first.")) {
      Library.clear(); Order.set([]); Files.clear().catch(() => {}); go("home");
    }
  }
};

document.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) return go(nav.dataset.nav);
  const el = e.target.closest("[data-action]");
  if (el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el);
});

document.addEventListener("keydown", (e) => {          // open cards with keyboard
  if (e.key === "Enter" && e.target.matches(".card")) ACTIONS.open(e.target);
});

document.addEventListener("submit", (e) => {
  if (e.target.id === "itemForm") { e.preventDefault(); saveForm(e.target); }
  else if (e.target.id === "journalForm") { e.preventDefault(); saveJournalEntry(e.target); }
  else if (e.target.id === "predictionForm") { e.preventDefault(); savePrediction(e.target); }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "search") { ui.filters.q = e.target.value; fillLibraryList(); }
  else if (e.target.closest("#itemForm")) refreshSeriesCalc();
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "statusFilter") { ui.filters.status = t.value; fillLibraryList(); }
  else if (t.id === "importFile" && t.files[0]) { importLibrary(t.files[0]); t.value = ""; }
  else if (t.id === "coverFile" && t.files[0]) {
    resizeImage(t.files[0])
      .then((src) => { ui.pendingCover = src; ui.coverAuto = false; setCoverPreview(src); })
      .catch(() => alert("Could not read this image. Please try another one."));
    t.value = "";
  }
  else if (t.id === "bookFile" && t.files[0]) { ui.pendingFile = t.files[0]; refreshFileInfo(); t.value = ""; }
  else if (t.name === "status" && ui.view === "form" && ui.type === "movie") movieStatusChanged(t);
  else if (t.dataset.quick === "status") quickStatus(t.value);
  else if (t.dataset.quick) {                           // progress fields: save without re-rendering
    const updated = updateItem(ui.id, { [t.dataset.quick]: t.value === "" ? "" : Number(t.value) });
    const pct = updated && progressPercent(updated);
    $("#progressBox").innerHTML = pct ? progressBar(pct, true) : "";
    if (updated) $("#watchBox").innerHTML = watchPanel(updated);
  }
});


// Re-flow the shelves when the phone is rotated or the window is resized
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (ui.view === "shelf") fillShelves(); }, 150);
});


/* 7. START-UP ------------------------------------------------------------- */

Library.migrate();
render();

// Chrome fires this only when it can install the app for real (standalone, own icon)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  if (ui.view === "settings") render();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  if (ui.view === "settings") render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => console.warn("Service worker failed:", err));
  });
}

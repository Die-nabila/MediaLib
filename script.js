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
      FAVORITE_FIELD, NOTES_FIELD]
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
      FAVORITE_FIELD, NOTES_FIELD]
  },
  movie: {
    icon: "🎬", label: "Movie", plural: "Movies", activeLabel: "Currently Watching",
    creatorKey: "director",
    progress: ["minutesWatched"],
    unit: "Minute", percent: { done: "minutesWatched", total: "totalMinutes", unit: "min" },
    fields: [F("title", "Title"), FIND_FIELD, F("director", "Director"), F("year", "Year", "number"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("watchedDate", "Date watched", "date"),
      F("minutesWatched", "Minutes watched", "number"), F("totalMinutes", "Total duration (minutes)", "number"),
      F("publisher", "Studio"), ORIGIN_FIELD, FRANCHISE_FIELD, SYNOPSIS_FIELD, LINK_FIELD,
      FAVORITE_FIELD, NOTES_FIELD]
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
      FAVORITE_FIELD, NOTES_FIELD]
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
  save(item) {
    const items = Store.load();
    const index = items.findIndex((i) => i.id === item.id);
    const next = withHistory(item, items[index]);          // adds today's progress to the item's history
    if (index >= 0) items[index] = next; else items.push(next);
    return Store.save(items);
  },
  remove(id)       { Store.save(Store.load().filter((i) => i.id !== id)); },
  replaceAll(items){ Store.save(items.map((i) => (Array.isArray(i.log) ? i : { ...i, log: baselineLog(i) }))); },
  // Items saved before progress history existed get a best-guess history once (nothing else is changed)
  migrate() {
    const items = Store.load();
    if (items.some((i) => !Array.isArray(i.log))) Store.save(items.map((i) => (Array.isArray(i.log) ? i : { ...i, log: baselineLog(i) })));
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
function seriesProgress(item) {
  const seasons = seasonCounts(item);
  const total = seasons ? seasons.reduce((a, b) => a + b, 0) : 0;
  if (!(total > 0)) return null;
  if (item.status === "completed") return { done: total, total };
  const ep = Number(item.currentEpisode) || 0;
  const season = Number(item.currentSeason) || (ep ? 1 : 0);
  const before = seasons.slice(0, Math.max(0, season - 1)).reduce((a, b) => a + b, 0);
  return { done: season > 0 ? Math.min(total, before + ep) : 0, total };
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
  if (status === "completed" && !item[doneDateKey(item.type)]) changes[doneDateKey(item.type)] = today();
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
const ui = { view: "home", id: null, type: null, editing: null, backTo: "library", stats: { area: "reading", period: "all" }, pendingCover: undefined, filters: { q: "", type: "all", status: "all" } };

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
      case "find":
        return ui.id ? "" : `<div class="field find-box">
          <button type="button" class="btn" data-action="findOnline">🔍 Find this ${MEDIA[type].label.toLowerCase()} online</button>
          <p class="meta">Type the title above, then search ${esc(PROVIDERS[type].name)}. Needs an internet connection.</p>
          <div id="findResults"></div></div>`;
      case "calc":
        return '<div id="seriesCalc" class="calc"></div>';
      case "seasons":
        return `<div class="field"><span class="lbl">${f.label} <small>(used to calculate your progress; edit freely)</small></span>
          <div id="seasonRows">${seasonRows(seasonCounts(item) || [])}</div>
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

/* Statistics: everything is calculated from the saved items each time the tab opens,
   so it is always up to date. A period uses the finish/watched date, or the last
   update when no date is set. */
const PERIODS = [["month", "Month"], ["3months", "3 months"], ["year", "Year"], ["all", "All time"]];
const READING_TYPES = ["book", "webtoon"], WATCHING_TYPES = ["movie", "series"];

function periodStart(key) {
  const now = new Date();
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (key === "3months") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime();
  if (key === "year") return new Date(now.getFullYear(), 0, 1).getTime();
  return 0;
}

function activityTime(item) {
  const [y, m, d] = String(item[doneDateKey(item.type)] || "").split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d).getTime();
  return item.updatedAt || item.createdAt || 0;
}
const inPeriod = (item, key) => activityTime(item) >= periodStart(key);

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

function languageRows(items) {
  const map = {};
  items.forEach((i) => {
    const key = i.language || "Not set";
    map[key] = map[key] || { done: 0, active: 0 };
    if (i.status === "completed") map[key].done++;
    else if (i.status === "active") map[key].active++;
  });
  return Object.entries(map).filter(([, v]) => v.done || v.active)
    .sort((a, b) => b[1].done + b[1].active - (a[1].done + a[1].active))
    .map(([label, v]) => ({ label, value: v.done, note: v.active ? "+" + v.active + " in progress" : "" }));
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
  const inP = all.filter((i) => inPeriod(i, period));
  const doneIn = inP.filter((i) => i.status === "completed");
  const count = (st) => all.filter((i) => i.status === st).length;
  const label = PERIODS.find((p) => p[0] === period)[1];
  const completedCells = [["month", "This month"], ["3months", "3 months"], ["year", "This year"], ["all", "Total"]]
    .map(([k, l]) => `<div class="${k === period ? "on" : ""}"><strong>${all.filter((i) => i.status === "completed" && inPeriod(i, k)).length}</strong><span>${l}</span></div>`).join("");
  const langs = languageRows(inP);
  const pages = inP.reduce((n, i) => n + unitsRead(i, "book", "currentPage", "totalPages"), 0);
  const chapters = inP.reduce((n, i) => n + unitsRead(i, "webtoon", "currentChapter", "totalChapters"), 0);
  const running = all.filter((i) => i.status === "active").map(progressPercent).filter(Boolean);
  const avg = running.length ? Math.round(running.reduce((n, p) => n + p.pct, 0) / running.length) : null;
  return `
    <div class="stat-grid">${statTile(count("active"), "Currently reading")}${statTile(count("onhold"), "Paused")}${statTile(count("dropped"), "Dropped")}${statTile(count("planned"), "Want to read")}</div>
    <div class="panel"><h2>Completed</h2><div class="mini-row">${completedCells}</div></div>
    <div class="panel"><h2>By language · ${label}</h2>${langs.length ? barRows(langs) : noData}</div>
    <div class="panel"><h2>By type · ${label}</h2>${barRows([
      { label: "📚 Books completed", value: doneIn.filter((i) => i.type === "book").length },
      { label: "📖 Webtoons completed", value: doneIn.filter((i) => i.type === "webtoon").length }])}</div>
    <details class="more"><summary>Pages &amp; chapters · ${label}</summary><div class="panel">
      ${statRow("Pages read", pages.toLocaleString())}${statRow("Chapters read", chapters.toLocaleString())}
      ${avg === null ? "" : statRow("Reading progress", avg + "% average across " + running.length + " in progress")}
    </div></details>`;
}

function watchingStats(period) {
  const all = Library.all().filter((i) => WATCHING_TYPES.includes(i.type));
  const inP = all.filter((i) => inPeriod(i, period));
  const label = PERIODS.find((p) => p[0] === period)[1];
  const movies = inP.filter((i) => i.type === "movie" && i.status === "completed").length;
  const series = inP.filter((i) => i.type === "series" && i.status === "completed").length;
  const episodes = inP.filter((i) => i.type === "series").reduce((n, i) => n + episodesDone(i), 0);
  const timeOf = (type) => inP.filter((i) => !type || i.type === type).reduce((n, i) => n + watchedMinutes(i), 0);
  const missingLength = inP.filter((i) => i.type === "series" && episodesDone(i) > 0 && !parseMinutes(i.episodeLength)).length;
  const langs = languageRows(inP);
  const titles = inP.filter((i) => i.status === "completed" || i.status === "active" || watchedMinutes(i) > 0)
    .sort((a, b) => watchedMinutes(b) - watchedMinutes(a) || String(a.title).localeCompare(String(b.title)));
  const titleRow = (i) => {
    const pct = progressPercent(i), mins = watchedMinutes(i);
    const sub = (i.type === "series"
      ? [i.language, (episodesDone(i) || i.totalEpisodes) && episodesDone(i) + (i.totalEpisodes ? " / " + i.totalEpisodes : "") + " episodes", pct && pct.pct + "%", mins && fmtMinutes(mins)]
      : [i.language, Number(i.totalMinutes) && fmtMinutes(i.totalMinutes), i.status === "completed" && "Watched"]
    ).filter(Boolean).join(" · ");
    return `<div class="trow" data-action="open" data-id="${i.id}"><span>${MEDIA[i.type].icon} ${esc(i.title)}</span><small>${esc(sub)}</small></div>`;
  };
  return `
    <div class="stat-grid">
      ${statTile(movies, "Movies watched")}${statTile(series, "Series watched")}
      ${statTile(episodes, "Episodes watched")}${statTile(fmtMinutes(timeOf()), "Estimated watching time")}
      ${statTile(all.filter((i) => i.status === "active").length, "Currently watching")}${statTile(movies + series, "Completed")}
      ${statTile(inP.filter((i) => i.type === "series").reduce((n, i) => n + seasonsDone(i), 0), "Seasons completed")}${statTile(all.filter((i) => i.type === "movie" && i.status !== "completed").length, "Movies to watch")}
    </div>
    <div class="panel"><h2>Watching by language · ${label}</h2>${langs.length ? barRows(langs) : noData}</div>
    <div class="panel"><h2>By type · ${label}</h2>${barRows([
      { label: "🎬 Movies", value: movies, note: fmtMinutes(timeOf("movie")) },
      { label: "📺 Series", value: series, note: fmtMinutes(timeOf("series")) }])}</div>
    <details class="more"><summary>Individual titles · ${label}</summary><div class="panel">${titles.length ? titles.map(titleRow).join("") : noData}</div></details>
    ${missingLength ? `<p class="foot">Series without an episode length are not counted in watching time (${missingLength}).</p>` : ""}`;
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

// Best-guess history for items recorded before histories existed: dated journal entries, then the
// item's finish / watched / last-update date (the same dates the other statistics already use).
function baselineLog(item) {
  const cur = unitsOf(item), log = [];
  let top = 0;
  if (item.type !== "series") {
    (item.journal || []).filter((e) => e.date && hasValue(e.progress)).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
      const v = Math.min(Number(e.progress) || 0, cur);
      if (v > top) { top = v; log.push({ d: e.date, v, est: 1 }); }
    });
  }
  if (cur > top) {
    const d = dayString(new Date(activityTime(item) || Date.now())), last = log.length ? log[log.length - 1].d : "";
    log.push({ d: d < last ? last : d, v: cur, est: 1 });
  }
  return log;
}

// Called on every save: if the amount consumed changed, record it for today.
function withHistory(item, prev) {
  const log = (Array.isArray(item.log) ? item.log : prev ? (Array.isArray(prev.log) ? prev.log : baselineLog(prev)) : []).slice();
  const cur = unitsOf(item), last = log.length ? log[log.length - 1] : null;
  if (cur !== (last ? last.v : 0)) {
    const d = today();
    if (last && last.d === d && !last.est) last.v = cur; else log.push({ d, v: cur });
  }
  return { ...item, log };
}

const logOf = (item) => (Array.isArray(item.log) ? item.log : baselineLog(item));

// Amount consumed from the start of one day-range to the end (b = Infinity means "until now")
function consumedBetween(item, a, b) {
  const log = logOf(item);
  const at = (t) => (t === Infinity ? unitsOf(item) : log.reduce((v, e) => (isoMs(e.d) < t ? e.v : v), 0));
  return Math.max(0, at(b) - at(a));
}

function prevPeriod(key) {
  if (!periodStart(key)) return null;
  const s = new Date(periodStart(key));
  if (key === "month") return [new Date(s.getFullYear(), s.getMonth() - 1, 1).getTime(), s.getTime()];
  if (key === "year") return [new Date(s.getFullYear() - 1, 0, 1).getTime(), s.getTime()];
  return [new Date(s.getFullYear(), s.getMonth() - 3, s.getDate()).getTime(), s.getTime()];
}

function lastIncrease(item) {
  let prev = 0, last = "";
  logOf(item).forEach((e) => { if (e.v > prev) last = e.d; prev = e.v; });
  return last;
}

function addUnits(bucket, item, amount) {
  const c = CONSUMPTION[item.type];
  if (!amount) return;
  bucket[c.unit] = (bucket[c.unit] || 0) + amount;
  if (c.minutes) bucket.minutes = (bucket.minutes || 0) + amount * c.minutes(item);
}

function languageData(period) {
  const prev = prevPeriod(period), start = periodStart(period);
  const rows = {}, totals = {}, notes = { estimated: 0, none: 0, noLength: 0 };
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
    if (logOf(item).some((e) => e.est)) notes.estimated++;
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
  if (!iso) return "no progress recorded yet";
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
    <p class="foot">${notes.none ? notes.none + " item" + (notes.none > 1 ? "s have" : " has") + " no measurable progress yet (add pages, chapters or durations). " : ""}${notes.noLength ? notes.noLength + " series have no episode length, so their episodes are counted but not their minutes. " : ""}${notes.estimated && period !== "all" ? "Progress recorded before history existed is placed on its finish or last-update date; from now on every change is tracked." : ""}</p>`;
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
    ${area === "reading" ? readingStats(period) : area === "watching" ? watchingStats(period) : languagesStats(period)}
    ${area === "languages" ? "" : '<p class="foot">Periods use the finish or watched date, or the last update when no date is set.</p>'}`;
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

/* Bookshelf ("Library" tab): every item's cover on wooden shelves.
   Rebuilt from storage each time the tab opens, so it is always up to date. */
const SHELF = { minCover: 76, gap: 10, sidePad: 28, minRows: 3, maxCols: 8 };

function shelfBook(item) {
  const m = MEDIA[item.type];
  const face = isCover(item.cover)
    ? `<img src="${esc(item.cover)}" alt="">`
    : `<div class="book-ph t-${item.type}"><span class="i">${m.icon}</span><span class="t">${esc(item.title)}</span></div>`;
  return `<button class="book" data-action="open" data-id="${item.id}" aria-label="${esc(item.title)}, ${m.label}" title="${esc(item.title)}">${face}</button>`;
}

function shelfView() {
  const n = Library.all().length;
  return `
    <h1>Library</h1>
    <div class="room">
      <div class="bookcase" id="bookcase"></div>
      <p class="room-note">${n ? `${n} item${n === 1 ? "" : "s"} on your shelves` : "Your shelves are empty. Tap + Add to place your first one."}</p>
    </div>`;
}

// Fills the shelves; the number of covers per shelf depends on the screen width.
function fillShelves() {
  const box = $("#bookcase");
  if (!box) return;
  const cols = Math.min(SHELF.maxCols, Math.max(3,
    Math.floor((box.clientWidth - SHELF.sidePad + SHELF.gap) / (SHELF.minCover + SHELF.gap))));
  const order = Object.keys(MEDIA);
  const items = Library.all().sort((a, b) =>
    order.indexOf(a.type) - order.indexOf(b.type) || String(a.title).localeCompare(String(b.title)));
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
  if (ui.view === "form") { setCoverPreview(ui.id ? Library.get(ui.id).cover : null); refreshSeriesCalc(); refreshFileInfo(); }
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
    else if (f.kind === "find" || f.kind === "calc" || f.kind === "bookfile") { /* helpers, nothing to save */ }
    else if (f.kind === "seasons") item.seasonEpisodes = readSeasons(form);
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
  if (item.status === "completed" && !item[doneDateKey(type)]) item[doneDateKey(type)] = today();
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
  if (!Library.save(item)) return;
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
  const data = { app: "My Library", version: 1, exportedAt: new Date().toISOString(), items: Library.all() };
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
      go("library");
    } catch (e) {
      alert("Could not import this file. Please choose a JSON file exported from My Library.");
    }
  };
  reader.readAsText(file);
}


/* Series: per-season episode counts, live calculation and online search (TVmaze) ---- */

const seasonRows = (list) => list.map((n, i) => `
  <div class="season-row"><span>Season ${i + 1}</span>
    <input type="number" min="0" inputmode="numeric" data-season value="${esc(n)}" aria-label="Episodes in season ${i + 1}">
    <button type="button" class="link danger" data-action="removeSeason" data-i="${i}">Remove</button></div>`).join("");

const readSeasons = (form) => [...form.querySelectorAll("[data-season]")].map((i) => Number(i.value) || 0);

function setSeasons(list) {
  $("#seasonRows").innerHTML = seasonRows(list);
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
  const sp = seriesProgress({ seasonEpisodes: seasons, status: form.elements.status.value,
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


/* 6. EVENTS: one listener per event type (event delegation) --------------- */

const ACTIONS = {
  open:       (el) => go("detail", { id: el.dataset.id, backTo: ["shelf", "stats"].includes(ui.view) ? ui.view : "library" }),
  category:   (el) => { ui.filters = { q: "", type: el.dataset.type, status: "all" }; go("library"); },
  filterType: (el) => { ui.filters.type = el.dataset.type; render(); },
  pickType:   (el) => go("form", { type: el.dataset.type }),
  cancelForm: () => (ui.id ? go("detail", { id: ui.id }) : go("home")),
  back:       () => go(ui.backTo || "library"),
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
  markWatched: () => { updateItem(ui.id, statusChanges(Library.get(ui.id), "completed")); render(); },
  addSeason:  () => { const list = readSeasons($("#itemForm")); list.push(list.length ? list[list.length - 1] : 10); setSeasons(list); },
  removeSeason: (el) => { const list = readSeasons($("#itemForm")); list.splice(Number(el.dataset.i), 1); setSeasons(list); },
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
      Library.clear(); Files.clear().catch(() => {}); go("home");
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
  else if (t.dataset.quick === "status") { updateItem(ui.id, statusChanges(Library.get(ui.id), t.value)); render(); }
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

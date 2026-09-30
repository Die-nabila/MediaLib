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

// To add a media type or field later, edit this object only.
const MEDIA = {
  book: {
    icon: "📚", label: "Book", plural: "Books", activeLabel: "Currently Reading",
    progress: ["currentPage"],
    unit: "Page", percent: { done: "currentPage", total: "totalPages", unit: "pages" },
    fields: [F("title", "Title"), F("author", "Author"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("totalPages", "Total pages", "number"), F("currentPage", "Current page", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  webtoon: {
    icon: "📖", label: "Webtoon", plural: "Webtoons", activeLabel: "Currently Reading",
    progress: ["currentChapter"],
    unit: "Chapter", percent: { done: "currentChapter", total: "totalChapters", unit: "chapters" },
    fields: [F("title", "Title"), F("author", "Author"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentChapter", "Current chapter", "number"), F("totalChapters", "Total chapters", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  movie: {
    icon: "🎬", label: "Movie", plural: "Movies", activeLabel: "Currently Watching",
    progress: ["minutesWatched"],
    unit: "Minute", percent: { done: "minutesWatched", total: "totalMinutes", unit: "min" },
    fields: [F("title", "Title"), F("year", "Year", "number"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("watchedDate", "Date watched", "date"),
      F("minutesWatched", "Minutes watched", "number"), F("totalMinutes", "Total duration (minutes)", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  series: {
    icon: "📺", label: "Series", plural: "Series", activeLabel: "Currently Watching",
    progress: ["currentSeason", "currentEpisode", "episodesWatched"],
    unit: "Episode", percent: { done: "episodesWatched", total: "totalEpisodes", unit: "episodes" },
    fields: [F("title", "Title"), GENRE_FIELD, LANGUAGE_FIELD, STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentSeason", "Current season", "number"), F("currentEpisode", "Current episode", "number"),
      F("totalSeasons", "Total seasons", "number"),
      F("episodesWatched", "Episodes watched", "number"), F("totalEpisodes", "Total episodes", "number"),
      F("episodeLength", "Episode length", "duration"),
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
    if (index >= 0) items[index] = item; else items.push(item);
    return Store.save(items);
  },
  remove(id)       { Store.save(Store.load().filter((i) => i.id !== id)); },
  replaceAll(items){ Store.save(items); },
  clear()          { Store.clear(); }
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

// Uses the existing progress fields (see `percent` in MEDIA). Returns null if not enough data.
function progressPercent(item) {
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

    ${watchPanel(item)}
    ${predictionPanel(item)}
    ${journalPanel(item)}

    ${rows ? `<div class="panel"><h2>Details</h2>${rows}</div>` : ""}

    <div class="actions">
      <button class="btn primary" data-action="edit">Edit</button>
      <button class="btn danger" data-action="delete">Delete</button>
    </div>`;
}

function settingsView() {
  return `
    <h1>Settings</h1>
    <div class="stack">
      <button class="btn" data-action="export">⬇️ Export my library</button>
      <button class="btn" data-action="import">⬆️ Import my library</button>
      <button class="btn danger" data-action="clear">🗑️ Clear all data</button>
    </div>
    <input id="importFile" type="file" accept="application/json,.json" hidden>
    <p class="meta">Your data is stored only on this device, in this browser.</p>`;
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
    </div>
    <div class="panel"><h2>Watching by language · ${label}</h2>${langs.length ? barRows(langs) : noData}</div>
    <div class="panel"><h2>By type · ${label}</h2>${barRows([
      { label: "🎬 Movies", value: movies, note: fmtMinutes(timeOf("movie")) },
      { label: "📺 Series", value: series, note: fmtMinutes(timeOf("series")) }])}</div>
    <details class="more"><summary>Individual titles · ${label}</summary><div class="panel">${titles.length ? titles.map(titleRow).join("") : noData}</div></details>
    ${missingLength ? `<p class="foot">Series without an episode length are not counted in watching time (${missingLength}).</p>` : ""}`;
}

function statsView() {
  const { area, period } = ui.stats;
  const seg = [["reading", "📖 Reading"], ["watching", "🎬 Watching"]]
    .map(([k, l]) => `<button class="${area === k ? "on" : ""}" data-action="statsArea" data-area="${k}">${l}</button>`).join("");
  const chips = PERIODS.map(([k, l]) => `<button class="chip ${period === k ? "on" : ""}" data-action="statsPeriod" data-period="${k}">${l}</button>`).join("");
  return `
    <h1>Statistics</h1>
    <div class="seg">${seg}</div>
    <div class="chips">${chips}</div>
    ${area === "reading" ? readingStats(period) : watchingStats(period)}
    <p class="foot">Periods use the finish or watched date, or the last update when no date is set.</p>`;
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
  ui.pendingCover = undefined;  // undefined = cover unchanged, null = removed, string = new image
  Object.assign(ui, params);
  render();
  window.scrollTo(0, 0);
}

function render() {
  $("#app").innerHTML = VIEWS[ui.view]();
  if (ui.view === "library") fillLibraryList();
  if (ui.view === "shelf") fillShelves();
  if (ui.view === "form") setCoverPreview(ui.id ? Library.get(ui.id).cover : null);
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
    else if (f.kind === "genres") item.genre = [...form.querySelectorAll('input[name="genre"]:checked')].map((i) => i.value);
    else {
      let v = form.elements[f.key].value.trim();
      if (f.kind === "number") v = v === "" ? "" : Number(v);
      item[f.key] = v;
    }
  });
  if (!item.title) { alert("Please enter a title."); return; }
  if (item.status === "completed" && !item[doneDateKey(type)]) item[doneDateKey(type)] = today();
  if (ui.pendingCover === null) delete item.cover;
  else if (ui.pendingCover) item.cover = ui.pendingCover;
  item.updatedAt = Date.now();
  if (!Library.save(item)) return;
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


/* 6. EVENTS: one listener per event type (event delegation) --------------- */

const ACTIONS = {
  open:       (el) => go("detail", { id: el.dataset.id, backTo: ["shelf", "stats"].includes(ui.view) ? ui.view : "library" }),
  category:   (el) => { ui.filters = { q: "", type: el.dataset.type, status: "all" }; go("library"); },
  filterType: (el) => { ui.filters.type = el.dataset.type; render(); },
  pickType:   (el) => go("form", { type: el.dataset.type }),
  cancelForm: () => (ui.id ? go("detail", { id: ui.id }) : go("home")),
  back:       () => go(ui.backTo || "library"),
  pickCover:  () => $("#coverFile").click(),
  removeCover: () => { ui.pendingCover = null; setCoverPreview(null); },
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
    if (confirm("Delete this item? This cannot be undone.")) { Library.remove(ui.id); go(ui.backTo || "library"); }
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
  clear:  () => {
    if (confirm("Delete ALL your data? This cannot be undone. Consider exporting first.")) {
      Library.clear(); go("home");
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
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "statusFilter") { ui.filters.status = t.value; fillLibraryList(); }
  else if (t.id === "importFile" && t.files[0]) { importLibrary(t.files[0]); t.value = ""; }
  else if (t.id === "coverFile" && t.files[0]) {
    resizeImage(t.files[0])
      .then((src) => { ui.pendingCover = src; setCoverPreview(src); })
      .catch(() => alert("Could not read this image. Please try another one."));
    t.value = "";
  }
  else if (t.dataset.quick === "status") { updateItem(ui.id, statusChanges(Library.get(ui.id), t.value)); render(); }
  else if (t.dataset.quick) {                           // progress fields: save without re-rendering
    const updated = updateItem(ui.id, { [t.dataset.quick]: t.value === "" ? "" : Number(t.value) });
    const pct = updated && progressPercent(updated);
    $("#progressBox").innerHTML = pct ? progressBar(pct, true) : "";
  }
});


// Re-flow the shelves when the phone is rotated or the window is resized
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (ui.view === "shelf") fillShelves(); }, 150);
});


/* 7. START-UP ------------------------------------------------------------- */

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => console.warn("Service worker failed:", err));
  });
}

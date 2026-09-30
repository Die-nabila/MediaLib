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

// Field helper: kind = text | number | date | textarea
const F = (key, label, kind = "text") => ({ key, label, kind });
const STATUS_FIELD   = { key: "status",   label: "Status",   kind: "status" };
const RATING_FIELD   = { key: "rating",   label: "Rating",   kind: "rating" };
const FAVORITE_FIELD = { key: "favorite", label: "Favorite", kind: "favorite" };
const NOTES_FIELD    = F("notes", "Notes", "textarea");

// To add a media type or field later, edit this object only.
const MEDIA = {
  book: {
    icon: "📚", label: "Book", plural: "Books", activeLabel: "Currently Reading",
    progress: ["currentPage"],
    unit: "Page", percent: { done: "currentPage", total: "totalPages", unit: "pages" },
    fields: [F("title", "Title"), F("author", "Author"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("totalPages", "Total pages", "number"), F("currentPage", "Current page", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  webtoon: {
    icon: "📖", label: "Webtoon", plural: "Webtoons", activeLabel: "Currently Reading",
    progress: ["currentChapter"],
    unit: "Chapter", percent: { done: "currentChapter", total: "totalChapters", unit: "chapters" },
    fields: [F("title", "Title"), F("author", "Author"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentChapter", "Current chapter", "number"), F("totalChapters", "Total chapters", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  movie: {
    icon: "🎬", label: "Movie", plural: "Movies", activeLabel: "Currently Watching",
    progress: ["minutesWatched"],
    unit: "Minute", percent: { done: "minutesWatched", total: "totalMinutes", unit: "min" },
    fields: [F("title", "Title"), F("year", "Year", "number"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("watchedDate", "Date watched", "date"),
      F("minutesWatched", "Minutes watched", "number"), F("totalMinutes", "Total duration (minutes)", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  series: {
    icon: "📺", label: "Series", plural: "Series", activeLabel: "Currently Watching",
    progress: ["currentSeason", "currentEpisode", "episodesWatched"],
    unit: "Episode", percent: { done: "episodesWatched", total: "totalEpisodes", unit: "episodes" },
    fields: [F("title", "Title"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentSeason", "Current season", "number"), F("currentEpisode", "Current episode", "number"),
      F("totalSeasons", "Total seasons", "number"),
      F("episodesWatched", "Episodes watched", "number"), F("totalEpisodes", "Total episodes", "number"),
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

function fieldLabel(type, key) {
  const f = MEDIA[type].fields.find((x) => x.key === key);
  return f ? f.label : key;
}


/* 4. VIEWS: each returns an HTML string ---------------------------------- */

// Current screen + library filters (kept in memory only)
const ui = { view: "home", id: null, type: null, editing: null, pendingCover: undefined, filters: { q: "", type: "all", status: "all" } };

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
    <h1>Library</h1>
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
    .filter((f) => !["status", "rating", "favorite"].includes(f.kind) && hasValue(item[f.key]))
    .map((f) => `<div class="row"><span>${f.label}</span><span>${esc(item[f.key])}</span></div>`).join("");
  const quickProgress = m.progress.map((key) =>
    `<label class="field"><span class="lbl">${fieldLabel(item.type, key)}</span>
       <input type="number" min="0" inputmode="numeric" data-quick="${key}" value="${esc(item[key])}"></label>`).join("");
  return `
    <button class="back" data-action="back">‹ Library</button>
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

const VIEWS = { home: homeView, library: libraryView, pick: pickView, form: formView, detail: detailView, settings: settingsView };
const NAV_FOR = { home: "home", library: "library", detail: "library", pick: "pick", form: "pick", settings: "settings" };


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
  if (ui.view === "form") setCoverPreview(ui.id ? Library.get(ui.id).cover : null);
  document.querySelectorAll("#nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.nav === NAV_FOR[ui.view]));
}

function saveForm(form) {
  const type = ui.type;
  const item = ui.id ? { ...Library.get(ui.id) } : { id: newId(), type, createdAt: Date.now() };
  MEDIA[type].fields.forEach((f) => {
    if (f.kind === "rating") item.rating = Number(form.querySelector(".rating-input").dataset.rating) || 0;
    else if (f.kind === "favorite") item.favorite = form.elements.favorite.checked;
    else {
      let v = form.elements[f.key].value.trim();
      if (f.kind === "number") v = v === "" ? "" : Number(v);
      item[f.key] = v;
    }
  });
  if (!item.title) { alert("Please enter a title."); return; }
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
  open:       (el) => go("detail", { id: el.dataset.id }),
  category:   (el) => { ui.filters = { q: "", type: el.dataset.type, status: "all" }; go("library"); },
  filterType: (el) => { ui.filters.type = el.dataset.type; render(); },
  pickType:   (el) => go("form", { type: el.dataset.type }),
  cancelForm: () => (ui.id ? go("detail", { id: ui.id }) : go("home")),
  back:       () => go("library"),
  pickCover:  () => $("#coverFile").click(),
  removeCover: () => { ui.pendingCover = null; setCoverPreview(null); },
  editPrediction: () => { ui.editing = "prediction"; render(); },
  addEntry:   () => { ui.editing = "journal:new"; render(); },
  editEntry:  (el) => { ui.editing = "journal:" + el.dataset.eid; render(); },
  cancelEdit: () => { ui.editing = null; render(); },
  deleteEntry: (el) => {
    if (!confirm("Delete this journal entry?")) return;
    const journal = (Library.get(ui.id).journal || []).filter((e) => e.id !== el.dataset.eid);
    if (updateItem(ui.id, { journal })) render();
  },
  edit:       () => go("form", { id: ui.id, type: Library.get(ui.id).type }),
  toggleFav:  () => { updateItem(ui.id, { favorite: !Library.get(ui.id).favorite }); render(); },
  delete:     () => {
    if (confirm("Delete this item? This cannot be undone.")) { Library.remove(ui.id); go("library"); }
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
  else if (t.dataset.quick === "status") { updateItem(ui.id, { status: t.value }); render(); }
  else if (t.dataset.quick) {                           // progress fields: save without re-rendering
    const updated = updateItem(ui.id, { [t.dataset.quick]: t.value === "" ? "" : Number(t.value) });
    const pct = updated && progressPercent(updated);
    $("#progressBox").innerHTML = pct ? progressBar(pct, true) : "";
  }
});


/* 7. START-UP ------------------------------------------------------------- */

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => console.warn("Service worker failed:", err));
  });
}

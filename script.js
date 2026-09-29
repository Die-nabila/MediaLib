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
    fields: [F("title", "Title"), F("author", "Author"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("totalPages", "Total pages", "number"), F("currentPage", "Current page", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  webtoon: {
    icon: "📖", label: "Webtoon", plural: "Webtoons", activeLabel: "Currently Reading",
    progress: ["currentChapter"],
    fields: [F("title", "Title"), F("author", "Author"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentChapter", "Current chapter", "number"), F("totalChapters", "Total chapters", "number"),
      FAVORITE_FIELD, NOTES_FIELD]
  },
  movie: {
    icon: "🎬", label: "Movie", plural: "Movies", activeLabel: "Currently Watching",
    progress: [],
    fields: [F("title", "Title"), F("year", "Year", "number"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("watchedDate", "Date watched", "date"), FAVORITE_FIELD, NOTES_FIELD]
  },
  series: {
    icon: "📺", label: "Series", plural: "Series", activeLabel: "Currently Watching",
    progress: ["currentSeason", "currentEpisode"],
    fields: [F("title", "Title"), F("genre", "Genre"), STATUS_FIELD, RATING_FIELD,
      F("startDate", "Start date", "date"), F("finishDate", "Finish date", "date"),
      F("currentSeason", "Current season", "number"), F("currentEpisode", "Current episode", "number"),
      F("totalSeasons", "Total seasons", "number"), FAVORITE_FIELD, NOTES_FIELD]
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
  save(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); },
  clear() { localStorage.removeItem(STORAGE_KEY); }
};

const Library = {
  all()        { return Store.load(); },
  get(id)      { return Store.load().find((i) => i.id === id); },
  save(item) {
    const items = Store.load();
    const index = items.findIndex((i) => i.id === item.id);
    if (index >= 0) items[index] = item; else items.push(item);
    Store.save(items);
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

function fieldLabel(type, key) {
  const f = MEDIA[type].fields.find((x) => x.key === key);
  return f ? f.label : key;
}


/* 4. VIEWS: each returns an HTML string ---------------------------------- */

// Current screen + library filters (kept in memory only)
const ui = { view: "home", id: null, type: null, filters: { q: "", type: "all", status: "all" } };

function itemCard(item) {
  const m = MEDIA[item.type];
  const progress = progressText(item);
  return `
    <article class="card ${item.favorite ? "is-fav" : ""}" data-action="open" data-id="${item.id}" tabindex="0">
      <div class="card-top"><h3>${esc(item.title)}</h3>${item.favorite ? '<span class="fav" title="Favorite">❤️</span>' : ""}</div>
      <div class="meta">${m.icon} ${m.label}</div>
      <div class="status status-${item.status}">${statusLabel(item.type, item.status)}</div>
      ${progress ? `<div class="progress">${esc(progress)}</div>` : ""}
      ${item.rating ? `<div class="stars" aria-label="${item.rating} out of 5">${starsText(item.rating)}</div>` : ""}
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
      ${fieldsHtml}
      <div class="actions">
        <button class="btn primary" type="submit">Save</button>
        <button class="btn" type="button" data-action="cancelForm">Cancel</button>
      </div>
    </form>`;
}

function detailView() {
  const item = Library.get(ui.id);
  if (!item) return '<p class="empty">This item no longer exists.</p>';
  const m = MEDIA[item.type];
  const rows = m.fields
    .filter((f) => !["status", "rating", "favorite"].includes(f.kind) && hasValue(item[f.key]))
    .map((f) => `<div class="row"><span>${f.label}</span><span>${esc(item[f.key])}</span></div>`).join("");
  const quickProgress = m.progress.map((key) =>
    `<label class="field"><span class="lbl">${fieldLabel(item.type, key)}</span>
       <input type="number" min="0" inputmode="numeric" data-quick="${key}" value="${esc(item[key])}"></label>`).join("");
  return `
    <button class="back" data-action="back">‹ Library</button>
    <h1>${esc(item.title)}</h1>
    <div class="meta">${m.icon} ${m.label}</div>
    <div class="status status-${item.status}">${statusLabel(item.type, item.status)}</div>
    ${item.rating ? `<div class="stars">${starsText(item.rating)}</div>` : ""}
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
  Object.assign(ui, params);
  render();
  window.scrollTo(0, 0);
}

function render() {
  $("#app").innerHTML = VIEWS[ui.view]();
  if (ui.view === "library") fillLibraryList();
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
  item.updatedAt = Date.now();
  Library.save(item);
  go("detail", { id: item.id });
}

function updateItem(id, changes) {
  const item = Library.get(id);
  if (item) Library.save({ ...item, ...changes, updatedAt: Date.now() });
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
});

document.addEventListener("input", (e) => {
  if (e.target.id === "search") { ui.filters.q = e.target.value; fillLibraryList(); }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "statusFilter") { ui.filters.status = t.value; fillLibraryList(); }
  else if (t.id === "importFile" && t.files[0]) { importLibrary(t.files[0]); t.value = ""; }
  else if (t.dataset.quick === "status") { updateItem(ui.id, { status: t.value }); render(); }
  else if (t.dataset.quick) {                           // progress fields: save without re-rendering
    updateItem(ui.id, { [t.dataset.quick]: t.value === "" ? "" : Number(t.value) });
  }
});


/* 7. START-UP ------------------------------------------------------------- */

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => console.warn("Service worker failed:", err));
  });
}

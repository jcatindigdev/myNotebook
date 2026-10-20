"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRESET_COLORS, UNCATEGORIZED, categorize, sortCategories, textOn } from "@/lib/categorize";

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "khaki", label: "Khaki" },
  { id: "pink", label: "Pink" },
  { id: "rainbow", label: "Rainbow" },
];

const fmt = (d) =>
  new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Signed out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function Tag({ cat, onClick, active, small }) {
  if (!cat) return null;
  const style = active === false
    ? { "--cat": cat.color }
    : { background: cat.color, color: textOn(cat.color), borderColor: cat.color };
  const cls = `tag ${small ? "tag-sm" : ""} ${active === false ? "tag-off" : ""}`;
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick}>{cat.label}</button>
  ) : (
    <span className={cls} style={style}>{cat.label}</span>
  );
}

/* ───────── Theme picker ───────── */
function ThemePicker() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);
  function pick(id) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem("nb-theme", id); } catch {}
  }
  return (
    <div className="themes" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={`${t.label} theme`}
          title={t.label}
          className={`swatch swatch-${t.id} ${theme === t.id ? "on" : ""}`}
          onClick={() => pick(t.id)}
        />
      ))}
    </div>
  );
}

/* ───────── Category manager ───────── */
function ColorPicker({ value, onChange }) {
  return (
    <div className="colors">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`color-dot ${value?.toLowerCase() === c ? "on" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
        />
      ))}
      <label className="color-custom" title="Custom color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span>Custom</span>
      </label>
    </div>
  );
}

function CategoryEditor({ cat, count, onSave, onDelete }) {
  const [label, setLabel] = useState(cat.label);
  const [keywords, setKeywords] = useState(cat.keywords.join(", "));
  const [color, setColor] = useState(cat.color);
  const [open, setOpen] = useState(false);

  // Keep in sync with the saved version
  useEffect(() => setLabel(cat.label), [cat.label]);
  useEffect(() => setKeywords(cat.keywords.join(", ")), [cat.keywords]);

  // Save color shortly after it stops changing (the custom picker fires continuously)
  useEffect(() => {
    if (color === cat.color) return;
    const t = setTimeout(() => onSave(cat.id, { color }), 350);
    return () => clearTimeout(t);
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveText = () => {
    const patch = {};
    if (label.trim() && label.trim() !== cat.label) patch.label = label.trim();
    if (keywords !== cat.keywords.join(", ")) patch.keywords = keywords;
    if (Object.keys(patch).length) onSave(cat.id, patch);
    else if (!label.trim()) setLabel(cat.label);
  };

  return (
    <div className="cat-edit" style={{ "--cat": color }}>
      <div className="cat-edit-row">
        <button type="button" className="color-btn" style={{ background: color }} onClick={() => setOpen((o) => !o)} aria-label="Change color" />
        <input
          className="cat-edit-name"
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveText}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Category name"
        />
        <span className="count">{count}</span>
        {cat.id === UNCATEGORIZED ? (
          <span className="muted small fallback">fallback</span>
        ) : (
          <button type="button" className="btn btn-link danger" onClick={() => onDelete(cat)}>Delete</button>
        )}
      </div>
      {open && <ColorPicker value={color} onChange={setColor} />}
      {cat.id !== UNCATEGORIZED && (
        <input
          className="cat-edit-kw"
          placeholder="Keywords for auto-sort, comma separated (optional)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          onBlur={saveText}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      )}
    </div>
  );
}

function CategoryManager({ categories, counts, onClose, onAdd, onSave, onDelete }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[categories.length % PRESET_COLORS.length]);
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [onClose]);

  async function add(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    if (await onAdd({ label: label.trim(), color, keywords })) {
      setLabel("");
      setKeywords("");
      setColor(PRESET_COLORS[(categories.length + 1) % PRESET_COLORS.length]);
    }
    setBusy(false);
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Manage categories">
        <div className="modal-head">
          <h3>Categories</h3>
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
        <p className="muted small modal-hint">
          Click a color to change it. Rename by editing the name. Keywords help auto-sort; you can also start a note with <code>#categoryname</code>.
        </p>

        <div className="cat-list">
          {categories.map((c) => (
            <CategoryEditor key={c.id} cat={c} count={counts[c.id] || 0} onSave={onSave} onDelete={onDelete} />
          ))}
        </div>

        <form className="cat-add" onSubmit={add} style={{ "--cat": color }}>
          <div className="side-title">Add a category</div>
          <div className="cat-edit-row">
            <span className="color-btn static" style={{ background: color }} />
            <input
              className="cat-edit-name"
              placeholder="Name, e.g. Rap Verses"
              value={label}
              maxLength={40}
              onChange={(e) => setLabel(e.target.value)}
            />
            <button className="btn btn-primary" disabled={!label.trim() || busy}>Add</button>
          </div>
          <ColorPicker value={color} onChange={setColor} />
          <input
            className="cat-edit-kw"
            placeholder="Keywords for auto-sort, comma separated (optional)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </form>
      </div>
    </div>
  );
}

/* ───────── Auto-growing textarea (no scrollbars) ───────── */
function AutoTextarea({ minHeight = 0, value, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(minHeight, el.scrollHeight + 2) + "px";
  }, [value, minHeight]);
  return <textarea ref={ref} value={value} rows={1} {...props} />;
}

/* ───────── Full note viewer / editor ───────── */
function NoteModal({ note, cat, categories, catOf, picked, onTogglePick, onSave, onDelete, onClose, onPrev, onNext, startInEdit }) {
  const [editing, setEditing] = useState(startInEdit);
  const [text, setText] = useState(note.content);
  const [catId, setCatId] = useState(cat?.id);

  useEffect(() => {
    setEditing(startInEdit);
    setText(note.content);
    setCatId(cat?.id);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") return editing ? setEditing(false) : onClose();
      if (editing) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        return;
      }
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  });

  async function save() {
    if (!text.trim()) return;
    const patch = { content: text };
    if (catId !== note.category) patch.category = catId;
    if (await onSave(note, patch)) setEditing(false);
  }

  const shown = editing ? catOf(catId) : cat;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <article className="modal note-modal" role="dialog" aria-modal="true" aria-label="Note" style={{ "--cat": shown?.color }}>
        <header className="nm-head">
          <Tag cat={shown} />
          <time className="muted small">{fmt(note.createdAt)}</time>
          <span className="spacer" />
          {!editing && (
            <span className="nm-nav">
              <button className="btn btn-ghost icon" onClick={onPrev} disabled={!onPrev} aria-label="Previous note">‹</button>
              <button className="btn btn-ghost icon" onClick={onNext} disabled={!onNext} aria-label="Next note">›</button>
            </span>
          )}
          <button className="btn btn-ghost icon" onClick={onClose} aria-label="Close">×</button>
        </header>

        {editing ? (
          <div className="nm-edit">
            <AutoTextarea minHeight={140} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <div className="edit-cats">
              <span className="muted small">Category</span>
              {categories.map((x) => (
                <Tag key={x.id} cat={x} small active={catId === x.id ? undefined : false} onClick={() => setCatId(x.id)} />
              ))}
            </div>
          </div>
        ) : (
          <div className={`nm-body ${note.category === "poetry" ? "verse" : ""}`}>{note.content}</div>
        )}

        <footer className="nm-foot">
          {editing ? (
            <>
              <span className="spacer" />
              <button className="btn btn-ghost" onClick={() => { setEditing(false); setText(note.content); setCatId(cat?.id); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!text.trim()}>Save</button>
            </>
          ) : (
            <>
              <label className="pick-all">
                <input type="checkbox" className="check" checked={picked} onChange={onTogglePick} />
                Select for export
              </label>
              <span className="spacer" />
              <button className="btn btn-link danger" onClick={() => onDelete(note.id)}>Delete</button>
              <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
            </>
          )}
        </footer>
      </article>
    </div>
  );
}

/* ───────── Pager ───────── */
function pageList(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push(n - nums[i - 1] === 2 ? n - 1 : `gap${n}`);
    out.push(n);
  });
  return out;
}

function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      <button className="pg-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹ Prev</button>
      <span className="pg-nums">
        {pageList(page, pages).map((n) =>
          typeof n === "string" ? (
            <span key={n} className="pg-gap">…</span>
          ) : (
            <button key={n} className={`pg-num ${n === page ? "on" : ""}`} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>
              {n}
            </button>
          )
        )}
      </span>
      <span className="pg-compact">Page {page} of {pages}</span>
      <button className="pg-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">Next ›</button>
    </nav>
  );
}

/* ───────── Main app ───────── */
const PAGE_SIZES = [12, 24, 48, 96];

export default function NotesApp() {
  // current page of notes (never the whole collection)
  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [sort, setSort] = useState("newest");
  const [fetching, setFetching] = useState(false);

  // category totals from the database
  const [counts, setCounts] = useState({});
  const [totalAll, setTotalAll] = useState(0);

  const [categories, setCategories] = useState([]);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [draft, setDraft] = useState("");
  const [draftCat, setDraftCat] = useState("auto");
  const [saving, setSaving] = useState(false);

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dq, setDq] = useState(""); // debounced search
  const [view, setView] = useState("grid");
  const [managing, setManaging] = useState(false);
  const [openNote, setOpenNote] = useState(null); // { id, edit }
  const pendingOpen = useRef(null); // "first" | "last" after a page flip from the popup

  const [pickedNotes, setPickedNotes] = useState(() => new Map()); // id -> category
  const [pickedCats, setPickedCats] = useState(() => new Set());
  const [format, setFormat] = useState("xlsx");
  const [exporting, setExporting] = useState(false);

  const listTop = useRef(null);
  const reqId = useRef(0);
  const toastTimer = useRef();
  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  /* ── loading ── */
  const loadCounts = useCallback(async () => {
    try {
      const d = await api("/api/notes/counts");
      setCounts(d.counts);
      setTotalAll(d.total);
    } catch {}
  }, []);

  const loadPage = useCallback(async () => {
    const id = ++reqId.current;
    setFetching(true);
    try {
      const qs = new URLSearchParams({ page, limit: pageSize, category: filter, q: dq, sort });
      const d = await api(`/api/notes?${qs}`);
      if (id !== reqId.current) return; // a newer request is on its way
      setNotes(d.notes);
      setTotal(d.total);
      setPages(d.pages);
      if (d.page !== page) setPage(d.page);
      setError("");
      if (pendingOpen.current && d.notes.length) {
        const n = pendingOpen.current === "first" ? d.notes[0] : d.notes[d.notes.length - 1];
        setOpenNote({ id: n.id, edit: false });
      }
      pendingOpen.current = null;
    } catch (e) {
      if (id === reqId.current) setError(e.message);
    } finally {
      if (id === reqId.current) {
        setFetching(false);
        setBooting(false);
      }
    }
  }, [page, pageSize, filter, dq, sort]);

  useEffect(() => {
    try {
      const v = localStorage.getItem("nb-view");
      if (v === "grid" || v === "list") setView(v);
      const ps = parseInt(localStorage.getItem("nb-page-size"), 10);
      if (PAGE_SIZES.includes(ps)) setPageSize(ps);
    } catch {}
    api("/api/categories").then((c) => setCategories(c.categories)).catch((e) => setError(e.message));
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // debounce search typing
  useEffect(() => {
    const t = setTimeout(() => setDq(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // back to page 1 whenever what you're looking at changes
  useEffect(() => {
    setPage(1);
  }, [filter, dq, sort, pageSize]);

  const refresh = () => {
    loadPage();
    loadCounts();
  };

  function goPage(p) {
    setPage(p);
    listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function changeView(v) {
    setView(v);
    try { localStorage.setItem("nb-view", v); } catch {}
  }
  function changePageSize(n) {
    setPageSize(n);
    try { localStorage.setItem("nb-page-size", String(n)); } catch {}
  }

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const catOf = (id) => catMap[id] || catMap[UNCATEGORIZED];
  const normCat = (id) => (catMap[id] ? id : UNCATEGORIZED);

  const suggestion = useMemo(() => categorize(draft, categories.length ? categories : undefined), [draft, categories]);

  // exact export total without loading every note:
  // whole ticked categories + ticked notes that aren't already inside one of them
  const exportCount = useMemo(() => {
    let n = 0;
    pickedCats.forEach((c) => (n += counts[c] || 0));
    pickedNotes.forEach((cat) => {
      if (!pickedCats.has(normCat(cat))) n++;
    });
    return n;
  }, [pickedNotes, pickedCats, counts, catMap]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── notes ── */
  async function addNote() {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      const { note } = await api("/api/notes", {
        method: "POST",
        body: JSON.stringify({ content, category: draftCat === "auto" ? undefined : draftCat }),
      });
      setDraft("");
      setDraftCat("auto");
      flash(`Saved to ${catOf(note.category)?.label}`);
      if (page !== 1 && sort === "newest") setPage(1);
      else loadPage();
      loadCounts();
    } catch (e) {
      flash(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveNote(n, patch) {
    try {
      const { note } = await api(`/api/notes/${n.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setNotes((prev) => prev.map((x) => (x.id === n.id ? note : x)));
      if (pickedNotes.has(n.id)) setPickedNotes((prev) => new Map(prev).set(n.id, note.category));
      if (patch.category) {
        loadCounts();
        if (filter !== "all") loadPage(); // it may have left this category
      } else if (dq) loadPage();
      flash("Note updated");
      return true;
    } catch (e) {
      flash(e.message);
      return false;
    }
  }

  async function deleteNote(id) {
    if (!confirm("Delete this note? This can't be undone.")) return false;
    try {
      await api(`/api/notes/${id}`, { method: "DELETE" });
      setPickedNotes((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
      if (openNote?.id === id) setOpenNote(null);
      refresh();
      flash("Note deleted");
      return true;
    } catch (e) {
      flash(e.message);
      return false;
    }
  }

  /* ── categories ── */
  async function addCategory(data) {
    try {
      const { category } = await api("/api/categories", { method: "POST", body: JSON.stringify(data) });
      setCategories((prev) => sortCategories([...prev, category]));
      flash(`Added ${category.label}`);
      return true;
    } catch (e) {
      flash(e.message);
      return false;
    }
  }

  async function saveCategory(id, patch) {
    try {
      const { category } = await api(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setCategories((prev) => sortCategories(prev.map((c) => (c.id === id ? category : c))));
    } catch (e) {
      flash(e.message);
    }
  }

  async function deleteCategory(cat) {
    const n = counts[cat.id] || 0;
    const msg = n
      ? `Delete "${cat.label}"? Its ${n} note${n === 1 ? "" : "s"} will move to "${catMap[UNCATEGORIZED]?.label}".`
      : `Delete "${cat.label}"?`;
    if (!confirm(msg)) return;
    try {
      await api(`/api/categories/${cat.id}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setPickedCats((prev) => {
        const s = new Set(prev);
        s.delete(cat.id);
        return s;
      });
      setPickedNotes((prev) => new Map([...prev].map(([k, v]) => [k, v === cat.id ? UNCATEGORIZED : v])));
      if (draftCat === cat.id) setDraftCat("auto");
      if (filter === cat.id) setFilter("all");
      refresh();
      flash(`Deleted ${cat.label}`);
    } catch (e) {
      flash(e.message);
    }
  }

  /* ── selection + export ── */
  function toggleNote(n) {
    setPickedNotes((prev) => {
      const m = new Map(prev);
      m.has(n.id) ? m.delete(n.id) : m.set(n.id, n.category);
      return m;
    });
  }
  function toggleCat(id) {
    setPickedCats((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }
  const allPagePicked = notes.length > 0 && notes.every((n) => pickedNotes.has(n.id));
  const togglePage = () =>
    setPickedNotes((prev) => {
      const m = new Map(prev);
      notes.forEach((n) => (allPagePicked ? m.delete(n.id) : m.set(n.id, n.category)));
      return m;
    });

  async function doExport() {
    if (!exportCount) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds: [...pickedNotes.keys()], categories: [...pickedCats], format }),
      });
      if (res.status === 401) return (window.location.href = "/login");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Export failed");
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] || `notes.${format}`;
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash(`Exported ${exportCount.toLocaleString()} note${exportCount === 1 ? "" : "s"}`);
    } catch (e) {
      flash(e.message);
    } finally {
      setExporting(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const sugg = catOf(suggestion.category);
  const filterCat = filter === "all" ? null : catOf(filter);
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  const openIdx = openNote ? notes.findIndex((n) => n.id === openNote.id) : -1;
  const opened = openIdx >= 0 ? notes[openIdx] : null;
  const open = (n, edit = false) => setOpenNote({ id: n.id, edit });
  const prevNote =
    openIdx > 0 ? () => open(notes[openIdx - 1])
    : openIdx === 0 && page > 1 ? () => { pendingOpen.current = "last"; setPage(page - 1); }
    : null;
  const nextNote =
    openIdx >= 0 && openIdx < notes.length - 1 ? () => open(notes[openIdx + 1])
    : openIdx === notes.length - 1 && page < pages ? () => { pendingOpen.current = "first"; setPage(page + 1); }
    : null;
  const cardKey = (n) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(n);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✎</span>
          <span className="brand-name">Notebook</span>
        </div>
        <input className="search" type="search" placeholder="Search all notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ThemePicker />
        <button className="btn btn-ghost" onClick={logout}>Lock</button>
      </header>

      <div className="layout">
        {/* ───── Sidebar ───── */}
        <aside className="sidebar">
          <div className="side-section">
            <div className="side-head">
              <div className="side-title">Categories</div>
              <button className="btn btn-link small" onClick={() => setManaging(true)}>Edit / Add</button>
            </div>
            <button className={`cat-row ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
              <span className="cat-check-spacer" />
              <span className="cat-name">All notes</span>
              <span className="count">{totalAll.toLocaleString()}</span>
            </button>
            {categories.map((c) => (
              <div key={c.id} className={`cat-row ${filter === c.id ? "active" : ""}`} style={{ "--cat": c.color }}>
                <input
                  type="checkbox"
                  className="check"
                  title="Tick to include this whole category in export"
                  checked={pickedCats.has(c.id)}
                  onChange={() => toggleCat(c.id)}
                  aria-label={`Include ${c.label} in export`}
                />
                <button className="cat-name" onClick={() => setFilter(c.id)}>
                  <span className="dot" />
                  <span className="cat-label">{c.label}</span>
                </button>
                <span className="count">{(counts[c.id] || 0).toLocaleString()}</span>
              </div>
            ))}
            <p className="hint">Tick a category to export all of it.</p>
          </div>

          <div className="side-section export-box">
            <div className="side-title">Export</div>
            <div className="seg">
              <button className={format === "xlsx" ? "on" : ""} onClick={() => setFormat("xlsx")}>Excel</button>
              <button className={format === "docx" ? "on" : ""} onClick={() => setFormat("docx")}>Word</button>
            </div>
            <p className="export-summary">
              <strong>{exportCount.toLocaleString()}</strong> note{exportCount === 1 ? "" : "s"} ready
              {pickedCats.size > 0 && <span className="muted"> · {pickedCats.size} categor{pickedCats.size === 1 ? "y" : "ies"}</span>}
            </p>
            <button className="btn btn-primary wide" disabled={!exportCount || exporting} onClick={doExport}>
              {exporting ? "Preparing…" : `Export .${format}`}
            </button>
            {(pickedNotes.size > 0 || pickedCats.size > 0) && (
              <button className="btn btn-link" onClick={() => { setPickedNotes(new Map()); setPickedCats(new Set()); }}>
                Clear selection
              </button>
            )}
          </div>
        </aside>

        {/* ───── Main ───── */}
        <main className="main">
          <section className="composer">
            <AutoTextarea
              minHeight={110}
              placeholder={"Write a note… a lyric, a title, a premise, anything.\nTip: start with #poem, #title, #story, #concept… to force a category."}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && addNote()}
            />
            <div className="composer-bar">
              <label className="select-wrap">
                <span className="muted small">Category</span>
                <select value={draftCat} onChange={(e) => setDraftCat(e.target.value)}>
                  <option value="auto">Auto-detect</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              {draftCat === "auto" && draft.trim() && sugg && (
                <span className="suggest">
                  Looks like <Tag cat={sugg} small />
                  <span className="muted small"> {suggestion.reason}</span>
                </span>
              )}
              <span className="spacer" />
              <span className="muted small kbd-hint">Ctrl + Enter</span>
              <button className="btn btn-primary" onClick={addNote} disabled={!draft.trim() || saving}>
                {saving ? "Saving…" : "Save note"}
              </button>
            </div>
          </section>

          <div className="list-head" ref={listTop}>
            <div className="tabs" role="tablist" aria-label="View">
              <button role="tab" aria-selected={view === "grid"} className={view === "grid" ? "on" : ""} onClick={() => changeView("grid")}>
                All notes
              </button>
              <button role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => changeView("list")}>
                List
              </button>
            </div>
            <select className="mobile-filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by category">
              <option value="all">All categories ({totalAll.toLocaleString()})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label} ({(counts[c.id] || 0).toLocaleString()})</option>
              ))}
            </select>
            <span className="spacer" />
            <div className="list-tools">
              <select className="mini-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <select className="mini-select" value={pageSize} onChange={(e) => changePageSize(Number(e.target.value))} aria-label="Notes per page">
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>
          </div>

          <div className="list-sub">
            <h2>
              {dq ? `“${dq}”` : filterCat ? filterCat.label : "Everything"}
              {dq && filterCat && <span className="muted"> in {filterCat.label}</span>}
            </h2>
            <span className="muted small range">
              {total ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}` : ""}
            </span>
            <span className="spacer" />
            {(filterCat || dq) && (
              <button className="btn btn-link small" onClick={() => { setFilter("all"); setQuery(""); }}>Clear</button>
            )}
            {notes.length > 0 && (
              <label className="pick-all">
                <input type="checkbox" className="check" checked={allPagePicked} onChange={togglePage} />
                Select page
              </label>
            )}
          </div>

          {booting && <p className="empty">Loading notes…</p>}
          {error && <p className="empty error">{error}</p>}
          {!booting && !error && total === 0 && (
            <p className="empty">{dq ? "No notes match your search." : totalAll ? "No notes in this category yet." : "No notes yet — write your first one above."}</p>
          )}

          <div className={`results ${fetching && !booting ? "busy" : ""}`}>
            {view === "grid" ? (
              <ul className="cards">
                {notes.map((n) => {
                  const c = catOf(n.category);
                  const picked = pickedNotes.has(n.id) || pickedCats.has(c?.id);
                  return (
                    <li
                      key={n.id}
                      className={`card ${picked ? "picked" : ""}`}
                      style={{ "--cat": c?.color }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open note: ${n.content.slice(0, 60)}`}
                      onClick={() => open(n)}
                      onKeyDown={cardKey(n)}
                    >
                      <div className="card-top">
                        <Tag cat={c} small />
                        <input
                          type="checkbox"
                          className="check"
                          checked={pickedNotes.has(n.id)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={() => toggleNote(n)}
                          aria-label="Select note for export"
                        />
                      </div>
                      <p className={`card-body ${n.category === "poetry" ? "verse" : ""}`}>{n.content}</p>
                      <time className="card-date">{fmt(n.createdAt)}</time>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="notes">
                {notes.map((n) => {
                  const c = catOf(n.category);
                  const picked = pickedNotes.has(n.id) || pickedCats.has(c?.id);
                  return (
                    <li key={n.id} className={`note ${picked ? "picked" : ""}`} style={{ "--cat": c?.color }}>
                      <input
                        type="checkbox"
                        className="check note-check"
                        checked={pickedNotes.has(n.id)}
                        onChange={() => toggleNote(n)}
                        aria-label="Select note for export"
                      />
                      <div className="note-tag"><Tag cat={c} small /></div>
                      <p
                        className={`note-body ${n.category === "poetry" ? "verse" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => open(n)}
                        onKeyDown={cardKey(n)}
                      >
                        {n.content}
                      </p>
                      <div className="note-meta">
                        <time className="muted small">{fmt(n.createdAt)}</time>
                        <span className="note-actions">
                          <button className="btn btn-link small" onClick={() => open(n, true)}>Edit</button>
                          <button className="btn btn-link small danger" onClick={() => deleteNote(n.id)}>Delete</button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Pager page={page} pages={pages} onPage={goPage} />
        </main>
      </div>

      {opened && (
        <NoteModal
          note={opened}
          cat={catOf(opened.category)}
          categories={categories}
          catOf={catOf}
          picked={pickedNotes.has(opened.id)}
          onTogglePick={() => toggleNote(opened)}
          onSave={saveNote}
          onDelete={deleteNote}
          onClose={() => setOpenNote(null)}
          onPrev={prevNote}
          onNext={nextNote}
          startInEdit={!!openNote?.edit}
        />
      )}

      {managing && (
        <CategoryManager
          categories={categories}
          counts={counts}
          onClose={() => setManaging(false)}
          onAdd={addCategory}
          onSave={saveCategory}
          onDelete={deleteCategory}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

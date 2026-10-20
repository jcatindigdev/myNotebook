// Default categories + a rule-based auto-categorizer.
// Shared by the browser (live suggestion while typing) and the server (on save).
// Categories themselves live in MongoDB so you can add / rename / recolor them.

export const UNCATEGORIZED = "uncategorized";

export const DEFAULT_CATEGORIES = [
  { id: "song-idea", label: "Song Idea", color: "#e07a5f", order: 1 },
  { id: "one-liner", label: "One-liners", color: "#f2a541", order: 2 },
  { id: "random", label: "Random Notes", color: "#8d99ae", order: 3 },
  { id: "concept", label: "Concepts (Film / Song / Movie)", color: "#5e60ce", order: 4 },
  { id: "poetry", label: "Poetry", color: "#c77dff", order: 5 },
  { id: "song-title", label: "Song Titles", color: "#2a9d8f", order: 6 },
  { id: "short-story", label: "Short Story", color: "#3a86ff", order: 7 },
  { id: UNCATEGORIZED, label: "Can't Categorize", color: "#9a8c98", order: 999 },
].map((c) => ({ ...c, keywords: [], builtin: true }));

export const PRESET_COLORS = [
  "#e07a5f", "#f2a541", "#e9c46a", "#2a9d8f", "#3a86ff",
  "#5e60ce", "#c77dff", "#ef476f", "#8d99ae", "#6b7a3a",
];

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function sortCategories(cats) {
  return [...cats].sort((a, b) => {
    if (a.id === UNCATEGORIZED) return 1;
    if (b.id === UNCATEGORIZED) return -1;
    return (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label);
  });
}

/** Black or white text, whichever reads better on the given background color. */
export function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? "#1d1a17" : "#ffffff";
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Built-in tags. Put them at the start of a note, e.g. "#poem ..." or "title: Midnight Static".
const BUILTIN_TAGS = [
  [/^\s*(#songidea|#song\b|song idea\s*:)/i, "song-idea"],
  [/^\s*(#oneliner|#one-liner|#joke|one[- ]?liner\s*:)/i, "one-liner"],
  [/^\s*(#note|#random|note\s*:|random\s*:)/i, "random"],
  [/^\s*(#concept|#film|#movie|concept\s*:|film\s*:|movie\s*:)/i, "concept"],
  [/^\s*(#poem|#poetry|poem\s*:|poetry\s*:)/i, "poetry"],
  [/^\s*(#title|#songtitle|title\s*:|song title\s*:)/i, "song-title"],
  [/^\s*(#story|#shortstory|story\s*:|short story\s*:)/i, "short-story"],
];

const kw = (list) => new RegExp(`\\b(${list.map(escapeRe).join("|")})s?\\b`, "gi");

const SONG_KW = kw([
  "chorus", "pre-chorus", "verse", "hook", "melody", "bpm", "beat", "lyric",
  "bridge", "chord", "riff", "key of", "tempo", "harmony", "vocal", "guitar",
  "piano", "drum", "bassline", "synth", "acoustic", "ballad", "duet", "sing",
  "falsetto", "outro", "intro", "rap", "bars", "track", "demo", "instrumental",
]);
const CONCEPT_KW = kw([
  "what if", "premise", "plot", "film", "movie", "screenplay", "script", "scene",
  "character", "protagonist", "antagonist", "music video", "concept", "logline",
  "trailer", "sci-fi", "thriller", "documentary", "series", "episode", "pilot",
  "a world where", "story about", "set in", "twist", "cinematic", "shot", "album concept",
]);
const RANDOM_KW = kw([
  "todo", "to do", "remember", "buy", "call", "remind", "meeting", "tomorrow",
  "groceries", "appointment", "email", "pay", "deadline", "list", "schedule",
  "password", "address", "link", "book", "check", "fix", "errand",
]);
const STORY_KW = kw([
  "once upon", "she said", "he said", "they said", "walked", "looked", "turned",
  "suddenly", "years later", "that night", "the next morning", "whispered",
]);
const PRONOUN_PAST = /\b(he|she|they|i|we)\s+(was|were|had|went|said|saw|felt|knew|thought|took)\b/gi;

const countMatches = (re, text) => (text.match(re) || []).length;

function lastWord(line) {
  const m = line.toLowerCase().replace(/[^a-z\s']/g, "").trim().split(/\s+/);
  return m[m.length - 1] || "";
}
function rhymes(a, b) {
  if (!a || !b || a === b || a.length < 2 || b.length < 2) return false;
  const tail = Math.min(3, a.length, b.length);
  return a.slice(-tail) === b.slice(-tail) || a.slice(-2) === b.slice(-2);
}
function isTitleCase(text) {
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (!words.length) return false;
  return words.filter((w) => /^[A-Z0-9"'(]/.test(w)).length / words.length >= 0.6;
}

/**
 * Returns { category, reason } for a note's text.
 * `categories` = the current category list (built-in + custom).
 */
export function categorize(raw, categories = DEFAULT_CATEGORIES) {
  const text = (raw || "").trim();
  if (!text) return { category: UNCATEGORIZED, reason: "Empty note" };

  const ids = new Set(categories.map((c) => c.id));

  // 1) Explicit tags: custom "#name" / "name:" first, then built-in tags
  for (const c of categories) {
    const slug = slugify(c.label).replace(/-/g, "");
    if (!slug) continue;
    const re = new RegExp(`^\\s*(#${escapeRe(slug)}\\b|${escapeRe(c.label)}\\s*:)`, "i");
    if (re.test(text)) return { category: c.id, reason: "Tagged" };
  }
  for (const [re, id] of BUILTIN_TAGS) {
    if (ids.has(id) && re.test(text)) return { category: id, reason: "Tagged" };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const wc = text.split(/\s+/).filter(Boolean).length;
  const avgLineWords = wc / Math.max(lines.length, 1);
  const endsWithPunct = /[.!?…]["')]?$/.test(text);

  const s = {};
  const why = {};
  const add = (id, pts, reason) => {
    s[id] = (s[id] || 0) + pts;
    if (pts > 0 && reason && !why[id]) why[id] = reason;
  };

  // 2) Built-in rules
  add("song-idea", countMatches(SONG_KW, text) * 3, "Music words (chorus, hook, beat…)");
  add("concept", countMatches(CONCEPT_KW, text) * 3, "Story/film concept words");
  add("random", countMatches(RANDOM_KW, text) * 2.5, "Reminder / everyday words");
  add("short-story", countMatches(STORY_KW, text) * 2, "Narrative phrasing");
  add("short-story", Math.min(countMatches(PRONOUN_PAST, text), 6), "Past-tense narration");

  if (/\b(song|track|tune)\s+(about|where|that|for|called)\b/i.test(text)) add("song-idea", 5, "Describes a song");
  if (/\b(concept|idea)\s+for\s+(a|an|the)?\s*(film|movie|song|video|album|show)\b/i.test(text)) add("concept", 6, "Concept for a film/song");

  if (lines.length >= 3 && avgLineWords <= 10) {
    add("poetry", 5, "Short stacked lines");
    let r = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      if (rhymes(lastWord(lines[i]), lastWord(lines[i + 1]))) r++;
      if (i < lines.length - 2 && rhymes(lastWord(lines[i]), lastWord(lines[i + 2]))) r++;
    }
    add("poetry", Math.min(r * 2, 8), "Rhyming lines");
  } else if (lines.length === 2 && avgLineWords <= 10 && rhymes(lastWord(lines[0]), lastWord(lines[1]))) {
    add("poetry", 4, "Rhyming couplet");
  }

  if (wc >= 120 && avgLineWords > 12) add("short-story", 6, "Long prose");
  else if (wc >= 70 && avgLineWords > 15) add("short-story", 3, "Prose passage");
  if (/["“”]/.test(text) && wc >= 50) add("short-story", 2, "Has dialogue");

  if (lines.length === 1 && wc <= 7 && !/[.!?]$/.test(text)) {
    add("song-title", 2, "Short single line");
    if (isTitleCase(text)) add("song-title", 3, "Title Case");
    if (/^["'“].*["'”]$/.test(text)) add("song-title", 2, "Quoted title");
  }

  if (lines.length === 1 && wc >= 5 && wc <= 30) {
    add("one-liner", 3, "Single punchy line");
    if (endsWithPunct) add("one-liner", 1);
    if (/\b(but|until|except|because|turns out|never|always)\b/i.test(text)) add("one-liner", 1.5, "Has a twist");
    if (/[!?]$/.test(text)) add("one-liner", 0.5);
  }

  if (/^\s*([-*•]|\d+[.)])\s+/m.test(text)) add("random", 3, "List format");
  if (wc >= 8 && wc < 120 && lines.length <= 4) add("random", 1, "General note");

  // 3) Your own keywords (any category, built-in or custom)
  for (const c of categories) {
    const words = (c.keywords || []).map((k) => k.trim()).filter(Boolean);
    if (words.length) add(c.id, countMatches(kw(words), text) * 4, "Matches your keywords");
  }

  // 4) Winner among categories that still exist
  let best = UNCATEGORIZED;
  let bestScore = 0;
  for (const c of categories) {
    if (c.id === UNCATEGORIZED) continue;
    if ((s[c.id] || 0) > bestScore) {
      best = c.id;
      bestScore = s[c.id];
    }
  }
  if (bestScore < 2.5) return { category: UNCATEGORIZED, reason: "Not enough clues" };
  return { category: best, reason: why[best] || "Best match" };
}

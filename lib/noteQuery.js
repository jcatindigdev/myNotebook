import { UNCATEGORIZED } from "./categorize";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds a MongoDB filter for the notes list.
 * - category "all" or empty = everything
 * - "uncategorized" also catches notes whose category was deleted / unknown
 * - q = case-insensitive text search (every word must appear)
 */
export function buildNoteFilter({ category, q, knownIds }) {
  const and = [];
  if (category && category !== "all") {
    if (category === UNCATEGORIZED) {
      and.push({ $or: [{ category: UNCATEGORIZED }, { category: { $nin: knownIds } }] });
    } else {
      and.push({ category });
    }
  }
  const words = String(q || "").trim().split(/\s+/).filter(Boolean).slice(0, 8);
  for (const w of words) and.push({ content: { $regex: escapeRe(w.slice(0, 100)), $options: "i" } });
  return and.length ? { $and: and } : {};
}

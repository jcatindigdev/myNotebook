import { getDb } from "./mongodb";
import { DEFAULT_CATEGORIES, sortCategories } from "./categorize";

export async function categoriesCollection() {
  return (await getDb()).collection("categories");
}

export const serializeCategory = (c) => ({
  id: c._id,
  label: c.label,
  color: c.color,
  keywords: c.keywords || [],
  order: c.order ?? 0,
  builtin: !!c.builtin,
});

/** All categories. Seeds the defaults the very first time (only if the collection is empty). */
export async function getCategories() {
  const col = await categoriesCollection();
  let docs = await col.find({}).toArray();
  if (!docs.length) {
    try {
      await col.insertMany(
        DEFAULT_CATEGORIES.map(({ id, ...rest }) => ({ _id: id, ...rest })),
        { ordered: false }
      );
    } catch {
      // another request seeded at the same time — fine
    }
    docs = await col.find({}).toArray();
  }
  return sortCategories(docs.map(serializeCategory));
}

export function cleanKeywords(input) {
  const list = Array.isArray(input) ? input : String(input || "").split(",");
  return [...new Set(list.map((k) => String(k).trim().toLowerCase()).filter(Boolean))]
    .map((k) => k.slice(0, 40))
    .slice(0, 40);
}

export const isColor = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ""));

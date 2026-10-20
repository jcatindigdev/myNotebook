import { NextResponse } from "next/server";
import { notesCollection } from "@/lib/mongodb";
import { categorize } from "@/lib/categorize";
import { getCategories } from "@/lib/categories";
import { buildNoteFilter } from "@/lib/noteQuery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const serialize = (n) => ({
  id: n._id.toString(),
  content: n.content,
  category: n.category,
  autoCategorized: !!n.autoCategorized,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

/**
 * GET /api/notes?page=1&limit=24&category=all&q=&sort=newest
 * Returns one page of notes + paging info. Never sends the whole collection.
 */
export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "24", 10) || 24));
    const sort = sp.get("sort") === "oldest" ? 1 : -1;
    const categories = await getCategories();
    const filter = buildNoteFilter({
      category: sp.get("category"),
      q: sp.get("q"),
      knownIds: categories.map((c) => c.id),
    });

    const col = await notesCollection();
    const total = await col.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(pages, Math.max(1, parseInt(sp.get("page") || "1", 10) || 1));

    const notes = await col
      .find(filter)
      .sort({ createdAt: sort, _id: sort })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({ notes: notes.map(serialize), total, page, pages, limit });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const content = String(body.content || "").trim();
    if (!content) return NextResponse.json({ error: "Note is empty" }, { status: 400 });
    if (content.length > 50000) return NextResponse.json({ error: "Note is too long" }, { status: 400 });

    const categories = await getCategories();
    let category = body.category;
    let autoCategorized = false;
    if (!categories.some((c) => c.id === category)) {
      category = categorize(content, categories).category;
      autoCategorized = true;
    }

    const now = new Date();
    const doc = { content, category, autoCategorized, createdAt: now, updatedAt: now };
    const col = await notesCollection();
    const { insertedId } = await col.insertOne(doc);
    return NextResponse.json({ note: serialize({ _id: insertedId, ...doc }) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { notesCollection } from "@/lib/mongodb";
import { getCategories } from "@/lib/categories";
import { UNCATEGORIZED } from "@/lib/categorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/notes/counts → { total, counts: { [categoryId]: number } } computed in the database. */
export async function GET() {
  try {
    const categories = await getCategories();
    const known = new Set(categories.map((c) => c.id));
    const col = await notesCollection();
    const rows = await col.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]).toArray();

    const counts = {};
    let total = 0;
    for (const r of rows) {
      const id = known.has(r._id) ? r._id : UNCATEGORIZED;
      counts[id] = (counts[id] || 0) + r.n;
      total += r.n;
    }
    return NextResponse.json({ total, counts });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

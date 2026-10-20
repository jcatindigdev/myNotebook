import { NextResponse } from "next/server";
import { categoriesCollection, cleanKeywords, getCategories, isColor } from "@/lib/categories";
import { PRESET_COLORS, slugify } from "@/lib/categorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ categories: await getCategories() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const label = String(body.label || "").trim().slice(0, 40);
    if (!label) return NextResponse.json({ error: "Give the category a name" }, { status: 400 });

    const existing = await getCategories();
    if (existing.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      return NextResponse.json({ error: "That category already exists" }, { status: 409 });
    }

    let id = slugify(label) || "category";
    while (existing.some((c) => c.id === id)) id = `${slugify(label) || "category"}-${Math.random().toString(36).slice(2, 6)}`;

    const doc = {
      _id: id,
      label,
      color: isColor(body.color) ? body.color.toLowerCase() : PRESET_COLORS[existing.length % PRESET_COLORS.length],
      keywords: cleanKeywords(body.keywords),
      order: Math.max(0, ...existing.filter((c) => c.order < 999).map((c) => c.order)) + 1,
      builtin: false,
    };
    await (await categoriesCollection()).insertOne(doc);
    const { _id, ...rest } = doc;
    return NextResponse.json({ category: { id: _id, ...rest } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

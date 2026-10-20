import { NextResponse } from "next/server";
import { categoriesCollection, cleanKeywords, getCategories, isColor, serializeCategory } from "@/lib/categories";
import { notesCollection } from "@/lib/mongodb";
import { UNCATEGORIZED } from "@/lib/categorize";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const $set = {};

    if (body.label !== undefined) {
      const label = String(body.label).trim().slice(0, 40);
      if (!label) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
      const all = await getCategories();
      if (all.some((c) => c.id !== id && c.label.toLowerCase() === label.toLowerCase())) {
        return NextResponse.json({ error: "Another category has that name" }, { status: 409 });
      }
      $set.label = label;
    }
    if (body.color !== undefined) {
      if (!isColor(body.color)) return NextResponse.json({ error: "Invalid color" }, { status: 400 });
      $set.color = body.color.toLowerCase();
    }
    if (body.keywords !== undefined) $set.keywords = cleanKeywords(body.keywords);

    const col = await categoriesCollection();
    const c = await col.findOneAndUpdate({ _id: id }, { $set }, { returnDocument: "after" });
    if (!c) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    return NextResponse.json({ category: serializeCategory(c) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (id === UNCATEGORIZED) {
    return NextResponse.json({ error: "\"Can't Categorize\" is the fallback and can't be deleted" }, { status: 400 });
  }
  try {
    await getCategories(); // make sure fallback exists
    const col = await categoriesCollection();
    const { deletedCount } = await col.deleteOne({ _id: id });
    if (!deletedCount) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    const notes = await notesCollection();
    const { modifiedCount } = await notes.updateMany(
      { category: id },
      { $set: { category: UNCATEGORIZED, updatedAt: new Date() } }
    );
    return NextResponse.json({ ok: true, movedNotes: modifiedCount });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

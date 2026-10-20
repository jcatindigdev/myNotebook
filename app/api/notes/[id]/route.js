import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { notesCollection } from "@/lib/mongodb";
import { getCategories } from "@/lib/categories";

export const runtime = "nodejs";

function toId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const _id = toId(id);
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  try {
    const body = await req.json();
    const $set = { updatedAt: new Date() };
    if (typeof body.content === "string") {
      const content = body.content.trim();
      if (!content) return NextResponse.json({ error: "Note is empty" }, { status: 400 });
      $set.content = content;
    }
    if (body.category !== undefined) {
      if (!(await getCategories()).some((c) => c.id === body.category)) {
        return NextResponse.json({ error: "Unknown category" }, { status: 400 });
      }
      $set.category = body.category;
      $set.autoCategorized = false;
    }

    const col = await notesCollection();
    const n = await col.findOneAndUpdate({ _id }, { $set }, { returnDocument: "after" });
    if (!n) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      note: {
        id: n._id.toString(),
        content: n.content,
        category: n.category,
        autoCategorized: !!n.autoCategorized,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  const _id = toId(id);
  if (!_id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  try {
    const col = await notesCollection();
    await col.deleteOne({ _id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

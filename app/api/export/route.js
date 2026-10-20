import { ObjectId } from "mongodb";
import ExcelJS from "exceljs";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType,
} from "docx";
import { notesCollection } from "@/lib/mongodb";
import { UNCATEGORIZED } from "@/lib/categorize";
import { getCategories } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmtDate = (d) =>
  new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: process.env.APP_TIMEZONE || "Asia/Manila",
  });

async function buildXlsx(notes, CATEGORIES) {
  const label = (id) => (CATEGORIES.find((c) => c.id === id) || CATEGORIES.find((c) => c.id === UNCATEGORIZED) || { label: id }).label;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Notebook";
  wb.created = new Date();

  const addSheet = (name, rows) => {
    const ws = wb.addWorksheet(name.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
    ws.columns = [
      { header: "Category", key: "category", width: 30 },
      { header: "Note", key: "content", width: 80 },
      { header: "Created", key: "createdAt", width: 22 },
      { header: "Last edited", key: "updatedAt", width: 22 },
    ];
    rows.forEach((n) =>
      ws.addRow({
        category: label(n.category),
        content: n.content,
        createdAt: fmtDate(n.createdAt),
        updatedAt: fmtDate(n.updatedAt),
      })
    );
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B2622" } };
    header.height = 22;
    ws.eachRow((row, i) => {
      row.alignment = { vertical: "top", wrapText: true };
      if (i > 1 && i % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F2EA" } };
      }
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: "D1" };
  };

  addSheet("All Notes", notes);
  for (const cat of CATEGORIES) {
    const rows = notes.filter((n) => n.category === cat.id);
    if (rows.length) addSheet(cat.label, rows);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function buildDocx(notes, CATEGORIES) {
  const children = [
    new Paragraph({ text: "My Notes", heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({ text: `Exported ${fmtDate(new Date())} · ${notes.length} note${notes.length === 1 ? "" : "s"}`, color: "777777", size: 20 }),
      ],
      spacing: { after: 300 },
    }),
  ];

  for (const cat of CATEGORIES) {
    const rows = notes.filter((n) => n.category === cat.id);
    if (!rows.length) continue;
    children.push(new Paragraph({ text: cat.label, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 160 } }));

    rows.forEach((n, idx) => {
      const lines = n.content.split(/\r?\n/);
      children.push(
        new Paragraph({
          children: lines.flatMap((line, i) => [
            ...(i > 0 ? [new TextRun({ break: 1 })] : []),
            new TextRun({ text: line, size: 24 }),
          ]),
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: fmtDate(n.createdAt), italics: true, color: "999999", size: 18 })],
          alignment: AlignmentType.LEFT,
          spacing: { after: 200 },
          border: idx < rows.length - 1
            ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 8 } }
            : undefined,
        })
      );
    });
  }

  const doc = new Document({
    creator: "Notebook",
    title: "My Notes",
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const format = body.format === "docx" ? "docx" : "xlsx";
    const ids = (Array.isArray(body.noteIds) ? body.noteIds : [])
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    const allCats = await getCategories();
    const cats = (Array.isArray(body.categories) ? body.categories : []).filter((c) => allCats.some((x) => x.id === c));

    if (!ids.length && !cats.length) {
      return Response.json({ error: "Tick at least one note or category." }, { status: 400 });
    }

    const or = [];
    if (ids.length) or.push({ _id: { $in: ids } });
    if (cats.length) or.push({ category: { $in: cats } });
    if (cats.includes(UNCATEGORIZED)) or.push({ category: { $nin: allCats.map((c) => c.id) } });

    const col = await notesCollection();
    const known = new Set(allCats.map((c) => c.id));
    const notes = (await col.find({ $or: or }).sort({ createdAt: -1 }).toArray())
      // notes whose category no longer exists are grouped under "Can't Categorize"
      .map((n) => (known.has(n.category) ? n : { ...n, category: UNCATEGORIZED }));
    if (!notes.length) return Response.json({ error: "Nothing to export." }, { status: 404 });

    const stamp = new Date().toISOString().slice(0, 10);
    const buf = format === "docx" ? await buildDocx(notes, allCats) : await buildXlsx(notes, allCats);
    const type = format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    return new Response(buf, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="notes-${stamp}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

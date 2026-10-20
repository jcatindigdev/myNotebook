# ✎ Notebook — private notes, auto-sorted

A password-protected notes app for Vercel + MongoDB. Type a note, it gets sorted into a category automatically (or pick one yourself), and export any mix of notes/categories to **Excel (.xlsx)** or **Word (.docx)**.

## Categories
Starts with: Song Idea · One-liners · Random Notes · Concepts (Film / Song / Movie) · Poetry · Song Titles · Short Story · Can't Categorize

- **Edit / Add** (sidebar) → add your own categories, rename, change colors, delete.
  Deleting a category moves its notes to "Can't Categorize" (that one is the fallback and can't be deleted).
- **Keywords** (optional, per category) help auto-sort, e.g. `flow, sixteen, cypher` for "Rap Verses".
- **Force a category** by starting a note with `#categoryname` (spaces removed, e.g. `#rapverses`) or `Category Name:`.
  Built-in shortcuts also work: `#song` `#oneliner` `#note` `#concept` `#film` `#poem` `#title` `#story`.
- To change a note's category, click **Edit** on the note and pick a tag.

## Viewing notes
- **All notes** tab: every note as a small, same-size preview card. Click one to open the full note (← → keys flip between notes; Edit / Delete / select-for-export are inside).
- **List** tab: slim rows with category tags. Click a row to open it.
- **Pages, not one endless list:** notes load 24 at a time (choose 12 / 24 / 48 / 96 per page), newest or oldest first. Search, category filters and counts run in the database, so it stays fast with thousands of notes.
- **Select page** ticks the notes on the current page; tick a category in the sidebar to export *all* of its notes across every page.
- Works on phones, tablets and desktops; scrollbars are hidden everywhere (you can still scroll).

## Themes
Light · Dark · Khaki · Pink · Rainbow — pick with the color circles in the top bar. Saved per browser.

---

## 🚀 Deploy (about 10 minutes)

### 1. MongoDB Atlas (free)
1. Go to <https://cloud.mongodb.com> → create a free **M0** cluster.
2. **Database Access** → add a user with a password.
3. **Network Access** → add IP `0.0.0.0/0` (needed because Vercel's IPs change).
4. **Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

> Tip: Vercel also has a one-click MongoDB Atlas integration (Vercel dashboard → Storage / Marketplace) that sets `MONGODB_URI` for you.

### 2. Push to GitHub
```bash
cd notebook
git init && git add . && git commit -m "Notebook"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/YOU/notebook.git
git push -u origin main
```

### 3. Vercel
1. <https://vercel.com/new> → import the repo (framework auto-detects as Next.js).
2. Add **Environment Variables**:

| Name | Value |
|---|---|
| `MONGODB_URI` | your Atlas connection string |
| `APP_PASSWORD` | the password you'll type to get in |
| `AUTH_SECRET` | a long random string (32+ chars) — see below |
| `MONGODB_DB` | *(optional)* database name, default `notebook` |
| `APP_TIMEZONE` | *(optional)* timezone for export dates, default `Asia/Manila` |

Generate `AUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
3. **Deploy** 🎉

## 🔒 How the password works
- Every page and every API route is blocked until you log in (Next.js middleware). Outsiders get redirected to `/login`; API calls return `401`.
- Logging in sets a signed, httpOnly cookie for 30 days. Click **Lock** to log out.
- **To kick out every logged-in device**, change `AUTH_SECRET` in Vercel and redeploy.
- The app tells search engines not to index it.

## 💻 Run locally
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

## 📤 Export
- Tick individual notes (checkbox on each card, or "Select all shown").
- And/or tick whole categories in the sidebar.
- Pick **Excel** or **Word** → **Export**. You get everything ticked, with no duplicates.
  - Excel: an "All Notes" sheet plus one sheet per category.
  - Word: notes grouped under category headings, line breaks preserved.

## Project layout
```
app/page.js               main screen
app/login/page.js         password screen
app/api/notes/...         create / list / edit / delete
app/api/export/route.js   Excel + Word generation
lib/categorize.js         categories + auto-sorting rules (tweak keywords here)
lib/auth.js               signed session cookie
middleware.js             blocks everything without a valid session
```

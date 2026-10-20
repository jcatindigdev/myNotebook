import { MongoClient } from "mongodb";
import dns from "node:dns";

// Some home routers/ISPs can't answer the SRV lookups that mongodb+srv:// needs
// (error: querySrv ECONNREFUSED). Use public DNS when running locally.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

// Reuse one connection across hot reloads (dev) and warm serverless invocations (Vercel).
let clientPromise = globalThis._mongoClientPromise;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI env var is missing.");

  if (!clientPromise) {
    const client = new MongoClient(uri, { maxPoolSize: 10 });
    clientPromise = client.connect();
    globalThis._mongoClientPromise = clientPromise;
  }
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "notebook");
}

export async function notesCollection() {
  const db = await getDb();
  const col = db.collection("notes");
  // Indexes keep paging/filtering fast with thousands of notes (created once per server instance).
  if (!globalThis._notesIndexed) {
    globalThis._notesIndexed = Promise.all([
      col.createIndex({ createdAt: -1, _id: -1 }),
      col.createIndex({ category: 1, createdAt: -1, _id: -1 }),
    ]).catch(() => (globalThis._notesIndexed = null));
  }
  return col;
}

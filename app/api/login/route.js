import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_DAYS, createSessionToken, safeEqual } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "APP_PASSWORD is not set on the server." }, { status: 500 });
  }

  let password = "";
  try {
    ({ password = "" } = await req.json());
  } catch {}

  if (!safeEqual(String(password), expected)) {
    // Small delay slows down guessing
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}

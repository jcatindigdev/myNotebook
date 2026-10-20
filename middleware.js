import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

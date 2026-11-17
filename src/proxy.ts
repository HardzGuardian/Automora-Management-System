import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic redirect only: checks that a session cookie EXISTS. This is NOT a security
// boundary — every page/action/service re-validates via getActor().
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/accept-invite"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js)$).*)"],
};

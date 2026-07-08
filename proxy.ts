import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";
import type { UserRole } from "@/lib/auth/types";
import { ROLE_DASHBOARDS } from "@/lib/auth/dashboards";

const PROTECTED: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/admin", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/teacher", roles: ["TEACHER"] },
  { prefix: "/student", roles: ["STUDENT"] },
];

const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

// Paths that require any authenticated session (no role restriction)
const AUTHENTICATED_PATHS = ["/change-password"];

// Forward the authenticated identity to server components via request headers,
// which getSession() reads. Must be set on the downstream request (not the
// response), otherwise the headers never reach the page.
function forwardIdentity(request: NextRequest, sub: string, role: UserRole) {
  const headers = new Headers(request.headers);
  headers.set("x-user-id", sub);
  headers.set("x-user-role", role);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("session")?.value;
  const payload = token ? await verifySessionToken(token) : null;

  if (
    AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) &&
    payload
  ) {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARDS[payload.role], request.url),
    );
  }

  // Authenticated-only paths: require a session but no role restriction
  if (
    AUTHENTICATED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    )
  ) {
    if (!payload) {
      const res = NextResponse.redirect(new URL("/login", request.url));
      if (token) res.cookies.delete("session");
      return res;
    }
    if (!payload.mustChangePassword) {
      return NextResponse.redirect(
        new URL(ROLE_DASHBOARDS[payload.role], request.url),
      );
    }
    return forwardIdentity(request, payload.sub, payload.role);
  }

  const match = PROTECTED.find((p) => pathname.startsWith(p.prefix));
  if (!match) return NextResponse.next();

  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    if (token) res.cookies.delete("session");
    return res;
  }

  if (!match.roles.includes(payload.role)) {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARDS[payload.role], request.url),
    );
  }

  if (payload.mustChangePassword) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  return forwardIdentity(request, payload.sub, payload.role);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/change-password",
  ],
};

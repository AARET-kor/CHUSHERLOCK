import { NextRequest, NextResponse } from "next/server";

async function sameSecret(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function suppliedToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      return decoded.slice(decoded.indexOf(":") + 1);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Local use stays zero-configuration. When CODEX_ACCESS_TOKEN is configured,
 * all pages and APIs require that token (Bearer for clients, Basic password
 * for a browser), preventing an accidentally exposed local server from
 * becoming an unauthenticated medical-data endpoint.
 */
export async function middleware(request: NextRequest) {
  const expected = process.env.CODEX_ACCESS_TOKEN;
  if (!expected || (await sameSecret(suppliedToken(request), expected))) {
    return NextResponse.next();
  }

  const headers = { "WWW-Authenticate": 'Basic realm="Cognitio", charset="UTF-8"' };
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  return new NextResponse("Authentication required", { status: 401, headers });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

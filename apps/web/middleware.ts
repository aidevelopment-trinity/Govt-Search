import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!password) {
    return NextResponse.next();
  }

  const username = process.env.APP_BASIC_AUTH_USERNAME || "admin";
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Basic ")) {
    const credentials = decodeBasicAuth(authorization);

    if (credentials?.username === username && credentials.password === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Gov Contract Finder", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function decodeBasicAuth(authorization: string) {
  try {
    const encoded = authorization.slice("Basic ".length);
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return undefined;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return undefined;
  }
}

import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const queryToken =
    request.nextUrl.searchParams.get("auth") ||
    request.nextUrl.searchParams.get("token");
  const cookieToken = request.cookies.get("viac_session")?.value;

  const activeToken = queryToken || cookieToken;

  const requestHeaders = new Headers(request.headers);
  if (activeToken) {
    requestHeaders.set("x-viac-session", activeToken);
  }

  // If queryToken was passed, rewrite without it to keep URL clean, otherwise next()
  let response: NextResponse;
  if (queryToken) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("auth");
    url.searchParams.delete("token");
    response = NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Ensure partitioned cross-site cookie is set on the response
  if (activeToken && (queryToken || !cookieToken)) {
    response.cookies.set("viac_session", activeToken, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      partitioned: true,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

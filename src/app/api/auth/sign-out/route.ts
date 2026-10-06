import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  await destroySession();
  const response = NextResponse.redirect(new URL("/sign-in", request.url), {
    status: 303,
  });
  response.cookies.set("viac_session", "", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    partitioned: true,
  });
  return response;
}

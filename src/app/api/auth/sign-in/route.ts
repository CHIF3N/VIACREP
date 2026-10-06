import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    let email = "";
    let password = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = body.email;
      password = body.password;
    } else {
      const formData = await request.formData();
      email = String(formData.get("email") || "");
      password = String(formData.get("password") || "");
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "That email and password don't match an account." },
        { status: 401 },
      );
    }

    const token = await createSession(user.id);
    const response = NextResponse.json({
      ok: true,
      token,
      redirect: "/dashboard",
    });

    response.cookies.set("viac_session", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      partitioned: true,
    });

    return response;
  } catch (error) {
    console.error("Sign-in failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

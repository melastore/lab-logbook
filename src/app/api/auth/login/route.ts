import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loginWithUsername } from "@/lib/logbook";
import { sessionCookieName } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const username = clean(body.username);
  const password = clean(body.password);

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  try {
    const session = await loginWithUsername(username, password);
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: session.maxAge,
    });

    return NextResponse.json({
      user: session.user,
      passwordChangeRequired: session.user.passwordChangeRequired,
    });
  } catch (e) {
    console.error("[login] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

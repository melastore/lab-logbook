import { NextResponse } from "next/server";
import {
  GENERATED_USERS,
  listProfiles,
  listProvisionedUsernames,
  provisionUser,
  resetUserPassword,
  deleteUser,
  updateUserCredentials,
} from "@/lib/logbook";
import { canReview, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  try {
    const [profiles, provisionedUsernames] = await Promise.all([
      listProfiles(),
      listProvisionedUsernames(),
    ]);
    return NextResponse.json({ profiles, provisionedUsernames });
  } catch (e) {
    return NextResponse.json({ profiles: [], provisionedUsernames: [], error: String(e) });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }

  const body = await request.json();
  if (body.action === "provisionAll") {
    let created = 0, skipped = 0;
    const provisioned = await listProvisionedUsernames();
    const provisionedSet = new Set(provisioned);
    for (const gen of GENERATED_USERS) {
      if (provisionedSet.has(gen.username)) { skipped++; continue; }
      try { await provisionUser(gen); created++; } catch { skipped++; }
    }
    return NextResponse.json({ created, skipped });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });

  if (body.action === "resetPassword") {
    const profiles = await listProfiles();
    const target = profiles.find((p) => p.username === username);
    const gen = GENERATED_USERS.find((u) => u.username === username || u.email === target?.email);
    if (!gen) return NextResponse.json({ error: "User not in generated list." }, { status: 404 });
    try {
      await resetUserPassword(username, gen.initialPassword);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (body.action === "updateCredentials") {
    const newUsername = typeof body.newUsername === "string" && body.newUsername.trim()
      ? body.newUsername.trim() : undefined;
    const newPassword = typeof body.newPassword === "string" && body.newPassword.trim()
      ? body.newPassword.trim() : undefined;
    if (!newUsername && !newPassword) {
      return NextResponse.json({ error: "Provide newUsername or newPassword." }, { status: 400 });
    }
    try {
      await updateUserCredentials(username, { newUsername, newPassword });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });
  if (username === user.username) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  try {
    await deleteUser(username);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

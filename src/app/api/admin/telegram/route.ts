import { NextResponse } from "next/server";
import { getTelegramConfig, setTelegramConfig } from "@/lib/logbook";
import { canReview, currentUser } from "@/lib/session";
import { sendTestMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const config = await getTelegramConfig();
  return NextResponse.json({
    configured: !!(config.botToken && config.chatId),
    botTokenSet: !!config.botToken,
    chatId: config.chatId,
  });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const updates: { botToken?: string; chatId?: string } = {};
  if (typeof body.botToken === "string" && body.botToken.trim()) {
    updates.botToken = body.botToken.trim();
  }
  if (typeof body.chatId === "string") {
    updates.chatId = body.chatId.trim();
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  await setTelegramConfig(updates, user.username || user.email);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  if (body.action === "test") {
    const result = await sendTestMessage();
    return NextResponse.json({ sent: result.sent, reason: result.reason });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

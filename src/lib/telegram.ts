import type { LogbookRecord } from "./logbook";
import { getTelegramConfig } from "./logbook";

type TelegramResult = { sent: boolean; reason?: string };

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<TelegramResult> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) return { sent: false, reason: await response.text() };
  return { sent: true };
}

async function resolveCredentials(): Promise<{ botToken: string; chatId: string }> {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  let chatId = process.env.TELEGRAM_CHAT_ID || "";
  try {
    const db = await getTelegramConfig();
    if (db.botToken) botToken = db.botToken;
    if (db.chatId) chatId = db.chatId;
  } catch {
    // fall through to env vars
  }
  return { botToken, chatId };
}

export async function notifySupervisor(record: LogbookRecord): Promise<TelegramResult> {
  const { botToken, chatId } = await resolveCredentials();
  if (!botToken || !chatId) {
    return { sent: false, reason: "Telegram credentials are not configured." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const text = [
    "New Instrument Logbook Entry",
    "",
    `Instrument: ${record.instrumentName || "N/A"} (${record.instrumentId || "N/A"})`,
    `Analyst: ${record.analyst || "N/A"}`,
    `Sample ID: ${record.sampleId || "N/A"}`,
    `Method: ${record.methodUsed || "N/A"}`,
    `Date: ${record.date || "N/A"}`,
    `Status: ${record.status}`,
    "",
    `Open dashboard: ${appUrl}/admin`,
  ].join("\n");

  return sendTelegramMessage(botToken, chatId, text);
}

export async function sendTestMessage(): Promise<TelegramResult> {
  const { botToken, chatId } = await resolveCredentials();
  if (!botToken || !chatId) {
    return { sent: false, reason: "Telegram credentials are not configured." };
  }
  return sendTelegramMessage(
    botToken,
    chatId,
    "Lab Logbook: Telegram notifications are working correctly."
  );
}

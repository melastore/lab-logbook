import { NextResponse } from "next/server";
import { createRecord, listRecords, updateRecordReview, type LogbookStatus } from "@/lib/logbook";
import { canReview, currentUser } from "@/lib/session";
import { notifySupervisor } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const records = await listRecords(user);
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await request.json();
  const record = await createRecord({
    laboratoryName: clean(body.laboratoryName),
    department: clean(body.department),
    location: clean(body.location),
    instrumentName: clean(body.instrumentName),
    instrumentModel: clean(body.instrumentModel),
    serialNumber: clean(body.serialNumber),
    manufacturer: clean(body.manufacturer),
    installationDate: clean(body.installationDate),
    instrumentId: clean(body.instrumentId),
    date: clean(body.date),
    analyst: clean(body.analyst),
    activityType: clean(body.activityType),
    methodUsed: clean(body.methodUsed),
    sampleId: clean(body.sampleId),
    measuredValue: clean(body.measuredValue),
    startTime: clean(body.startTime),
    endTime: clean(body.endTime),
    metadata: body.metadata || {},
    remarks: clean(body.remarks),
    analystSignature: cleanSignature(body.analystSignature),
  }, user.id);

  const telegram = await notifySupervisor(record);
  return NextResponse.json({ record, telegramSent: telegram.sent, telegramReason: telegram.reason });
}

export async function PATCH(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  if (!canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }

  const body = await request.json();
  const status = clean(body.status) as LogbookStatus;

  if (!["Approved", "Rejected"].includes(status)) {
    return NextResponse.json({ error: "Status must be Approved or Rejected." }, { status: 400 });
  }

  const record = await updateRecordReview({
    id: clean(body.id),
    status,
    supervisorComment: clean(body.supervisorComment),
    reviewedBy: user.fullName || user.email || "Supervisor",
  });

  if (!record) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  return NextResponse.json({ record });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSignature(value: unknown) {
  const signature = clean(value);
  return signature.length > 300_000 ? signature.slice(0, 300_000) : signature;
}

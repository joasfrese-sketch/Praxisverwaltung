import { NextResponse, type NextRequest } from "next/server";
import { isMailConfigured, processOutbox } from "@/lib/mail";

export const maxDuration = 60;

/**
 * Wird alle 5 Minuten von Supabase (pg_cron) aufgerufen und verschickt den E-Mail-Ausgang.
 * Absicherung: gemeinsamer Schlüssel EMAIL_JOB_SECRET (Vercel) = private.app_settings.job_secret (Supabase).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.EMAIL_JOB_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isMailConfigured()) {
    return NextResponse.json({ skipped: "SMTP nicht konfiguriert – Mails bleiben im Ausgang" });
  }
  try {
    return NextResponse.json(await processOutbox(process.env.APP_URL ?? request.nextUrl.origin));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

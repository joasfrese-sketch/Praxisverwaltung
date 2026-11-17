import "server-only";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

/** SMTP-Konfiguration aus Umgebungsvariablen (in Vercel hinterlegt). */
export function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from: process.env.SMTP_FROM ?? user,
  };
}

export function isMailConfigured() {
  return smtpConfig() !== null;
}

let cached: ReturnType<typeof nodemailer.createTransport> | null = null;
export function transporter() {
  const c = smtpConfig();
  if (!c) throw new Error("SMTP ist nicht konfiguriert");
  cached ??= nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    requireTLS: !c.secure,
    auth: { user: c.user, pass: c.pass },
    pool: true,
    maxConnections: 2,
  });
  return cached;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export interface OutboxMail {
  id: string; kind: string; title: string; body: string | null; to: string; first_name: string; last_name: string;
  practice: string; practice_phone: string | null; practice_email: string | null; practice_address: string | null; timezone: string;
  starts_at: string | null; status: string | null; location_kind: string | null; room: string | null; video_url: string | null;
  cancel_reason: string | null; doctor: string | null; token: string | null;
}

const LOC: Record<string, string> = { praxis: "in der Praxis", hausbesuch: "Hausbesuch", video: "Videosprechstunde" };

/**
 * Baut den E-Mail-Text. Datenschutz: Es werden bewusst KEINE medizinischen Inhalte
 * (Terminanlass, Diagnosen) übertragen – nur Zeit, Ort, Behandler.
 */
export function renderMail(m: OutboxMail, appUrl: string) {
  const when = m.starts_at
    ? new Intl.DateTimeFormat("de-DE", { timeZone: m.timezone, weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(m.starts_at)) + " Uhr"
    : null;
  const link = m.token ? `${appUrl}/t/${m.token}` : null;
  const intro: Record<string, string> = {
    terminbestaetigung: "wir bestätigen Ihnen folgenden Termin:",
    verschiebung: "Ihr Termin wurde verschoben. Neuer Termin:",
    verspaetung: "in unserer Praxis kommt es heute leider zu einer Verzögerung. Ihr Termin beginnt voraussichtlich später:",
    behandlerwechsel: "bei Ihrem Termin gibt es eine Änderung der behandelnden Person:",
    absage: "leider müssen wir Ihren folgenden Termin absagen:",
  };
  const text0 = m.kind.startsWith("erinnerung") ? "wir möchten Sie an Ihren Termin erinnern:" : (intro[m.kind] ?? "es gibt eine Information zu Ihrem Termin:");
  const lines = [
    when && `Wann: ${when}`,
    m.doctor && `Bei: ${m.doctor}`,
    m.location_kind && `Ort: ${LOC[m.location_kind] ?? m.location_kind}${m.room ? `, ${m.room}` : ""}${m.location_kind === "praxis" && m.practice_address ? ` (${m.practice_address})` : ""}`,
    m.video_url && `Video-Link: ${m.video_url}`,
    m.kind === "absage" && m.cancel_reason ? `Hinweis: ${m.cancel_reason}` : null,
  ].filter(Boolean) as string[];
  const showActions = link && m.kind !== "absage" && (m.status === "geplant" || m.status === "bestaetigt");
  const footer = [m.practice, m.practice_address, m.practice_phone && `Tel. ${m.practice_phone}`, m.practice_email].filter(Boolean).join(" · ");

  const text = [
    `Guten Tag ${m.first_name} ${m.last_name},`,
    "",
    text0,
    "",
    ...lines,
    "",
    showActions ? `Termin bestätigen oder absagen: ${link}` : link ? `Details: ${link}` : "",
    "",
    "Mit freundlichen Grüßen",
    `Ihr Team der ${m.practice}`,
    "",
    "—",
    footer,
    "Diese E-Mail wurde automatisch versendet.",
  ].join("\n");

  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#3f5876;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">${esc(m.practice)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">Guten Tag ${esc(m.first_name)} ${esc(m.last_name)},</p>
<p style="margin:0 0 16px">${esc(text0)}</p>
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f2f5f9;border-radius:8px;padding:12px 16px;margin-bottom:16px">
${lines.map((l) => `<tr><td style="padding:4px 0;font-size:14px">${esc(l)}</td></tr>`).join("")}
</table>
${showActions ? `<p style="margin:0 0 16px"><a href="${esc(link!)}" style="display:inline-block;background:#3f5876;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">Termin bestätigen oder absagen</a></p>` : link ? `<p style="margin:0 0 16px"><a href="${esc(link)}" style="color:#3f5876">Termindetails ansehen</a></p>` : ""}
<p style="margin:0">Mit freundlichen Grüßen<br>Ihr Team der ${esc(m.practice)}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px">${esc(footer)}<br>Diese E-Mail wurde automatisch versendet.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: m.title, text, html };
}

/** Arbeitet den E-Mail-Ausgang ab (max. 100 Mails pro Aufruf). */
export async function processOutbox(appUrl: string) {
  const secret = process.env.EMAIL_JOB_SECRET;
  if (!secret) throw new Error("EMAIL_JOB_SECRET fehlt");
  const cfg = smtpConfig();
  if (!cfg) throw new Error("SMTP ist nicht konfiguriert");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  let sent = 0;
  let failed = 0;
  for (let round = 0; round < 4; round++) {
    const { data, error } = await supabase.rpc("claim_email_batch", { p_secret: secret, p_limit: 25 });
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as OutboxMail[];
    if (!batch.length) break;
    for (const m of batch) {
      try {
        const { subject, text, html } = renderMail(m, appUrl);
        await transporter().sendMail({
          from: `"${m.practice.replace(/"/g, "")}" <${cfg.from}>`,
          to: m.to,
          replyTo: m.practice_email ?? undefined,
          subject,
          text,
          html,
        });
        await supabase.rpc("finish_email", { p_secret: secret, p_id: m.id, p_ok: true });
        sent++;
      } catch (e) {
        await supabase.rpc("finish_email", { p_secret: secret, p_id: m.id, p_ok: false, p_error: e instanceof Error ? e.message : String(e) });
        failed++;
      }
    }
  }
  return { sent, failed };
}

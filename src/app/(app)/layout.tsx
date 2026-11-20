import { getContext } from "@/lib/context";
import { AppShell } from "@/components/shell/app-shell";
import { FontSync } from "@/components/shell/font-sync";
import { staffName } from "@/components/ui";
import { STAFF_ROLES } from "@/lib/labels";
import { dayRange, today } from "@/lib/time";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, userId, me, practice, practices } = await getContext();
  const tz = practice.timezone;
  // Rückfrage „Ist der Patient da?“ stellt die App der Anmeldung: MFA, Verwaltung und Admins
  const asks = me.is_admin || me.role === "mfa" || me.role === "verwaltung";
  const { from, to } = dayRange(today(tz), tz);
  const [{ count: unread }, { count: openTasks }, open, docs, chatUnread, pref] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_staff_id", me.id).eq("status", "neu"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("practice_id", practice.id).is("done_at", null).eq("assignee_id", me.id),
    asks
      ? supabase.from("appointments").select("id, starts_at, reason, doctor_id, patient:patients(first_name, last_name)")
          .eq("practice_id", practice.id).in("status", ["geplant", "bestaetigt"]).eq("location_kind", "praxis")
          .gte("starts_at", from).lt("starts_at", to).order("starts_at")
      : Promise.resolve({ data: null }),
    asks ? supabase.from("staff").select("id, title, last_name").eq("practice_id", practice.id) : Promise.resolve({ data: null }),
    supabase.rpc("chat_unread", { p_practice: practice.id }),
    supabase.from("user_prefs").select("font_scale").eq("user_id", userId).maybeSingle(),
  ]);
  const chat = ((chatUnread.data ?? []) as { unread: number }[]).reduce((n, r) => n + Number(r.unread), 0);
  const docById = new Map((docs.data ?? []).map((d) => [d.id as string, d as { title: string | null; last_name: string }]));
  const candidates = (open.data ?? []).map((a) => {
    const d = docById.get(a.doctor_id as string);
    const p = a.patient as unknown as { first_name: string; last_name: string } | null;
    return {
      id: a.id as string,
      starts_at: a.starts_at as string,
      reason: a.reason as string,
      patientName: p ? `${p.first_name} ${p.last_name}` : "der Patient",
      doctorName: d ? [d.title, d.last_name].filter(Boolean).join(" ") : "dem Behandler",
    };
  });
  return (
    <AppShell
      practiceName={practice.name}
      practiceId={practice.id}
      practices={practices}
      user={{ name: staffName(me), role: `${STAFF_ROLES[me.role]}${me.is_admin ? ", Admin" : ""}` }}
      unread={unread ?? 0}
      tasks={openTasks ?? 0}
      chat={chat}
      presence={asks ? { candidates, askAfterMinutes: practice.no_show_ask_minutes ?? 20, nowIso: new Date().toISOString(), tz } : undefined}
    >
      <FontSync scale={pref.data?.font_scale ?? 100} />
      {children}
    </AppShell>
  );
}

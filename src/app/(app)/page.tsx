import Link from "next/link";
import { headers } from "next/headers";
import { MonitorPlay } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadAbsences, loadAppointments, loadRooms, loadStaff } from "@/lib/data";
import { detectDelays } from "@/lib/delays";
import { dayRange, fmtDateTime, fmtDay, fmtTime, today } from "@/lib/time";
import { ABSENCE, ACTIVE_STATUSES, isProvider } from "@/lib/labels";
import { Notice } from "@/components/ui";
import { FlowBoard, type ColumnKey, type FlowAppt } from "@/components/today/flow-board";
import { RoomStatus, type RoomState } from "@/components/today/room-status";
import { Attention } from "@/components/today/attention";
import { DoctorFilter } from "@/components/today/doctor-filter";
import { ForYou } from "@/components/today/for-you";

export const metadata = { title: "Heute" };

const short = (s: { title: string | null; last_name: string }) => [s.title, s.last_name].filter(Boolean).join(" ");

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { supabase, practice, me, canReadMedical } = await getContext();
  const tz = practice.timezone;
  const day = today(tz);
  const now = new Date();
  const { from, to } = dayRange(day, tz);

  const [appts, { providers, byId }, rooms, absences, tasksRes, overdueRes, notesRes, freedRes, waitRes, catsRes, requestsRes] = await Promise.all([
    loadAppointments(supabase, practice.id, from, to),
    loadStaff(supabase, practice.id),
    loadRooms(supabase, practice.id),
    loadAbsences(supabase, practice.id, day, day),
    supabase.from("tasks").select("id, title, due_date, patient:patients(first_name, last_name)").eq("practice_id", practice.id).is("done_at", null)
      .or(`assignee_id.eq.${me.id},assignee_id.is.null`).order("due_date", { nullsFirst: false }).limit(6),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("practice_id", practice.id).is("done_at", null)
      .or(`assignee_id.eq.${me.id},assignee_id.is.null`).lt("due_date", day),
    supabase.from("notifications").select("id, title, body, appointment_id, created_at").eq("recipient_staff_id", me.id).eq("status", "neu")
      .order("created_at", { ascending: false }).limit(4),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("practice_id", practice.id).eq("status", "abgesagt").gte("starts_at", now.toISOString()),
    supabase.from("waitlist_entries").select("id", { count: "exact", head: true }).eq("practice_id", practice.id).is("resolved_at", null),
    canReadMedical ? supabase.from("record_categories").select("id").eq("practice_id", practice.id).eq("is_warning", true) : Promise.resolve({ data: [] as { id: string }[] }),
    me.is_admin ? supabase.from("staff_absences").select("id", { count: "exact", head: true }).eq("practice_id", practice.id).eq("status", "beantragt") : Promise.resolve({ count: 0 }),
  ]);

  // Wer wird angezeigt: Ärzte sehen standardmäßig sich selbst, der Empfang alle.
  const wanted = typeof sp.arzt === "string" ? sp.arzt : undefined;
  const fallback = isProvider(me.role) ? me.id : "alle";
  const arzt = wanted === "alle" || (wanted && byId.has(wanted)) ? wanted : byId.has(fallback) ? fallback : "alle";
  const visible = arzt === "alle" ? appts : appts.filter((a) => a.doctor_id === arzt);

  // Patienten mit Warnhinweis (Allergie, Antikoagulation …) – direkt auf der Karte sichtbar
  const warnIds = (catsRes.data ?? []).map((c) => c.id);
  let warnPatients = new Set<string>();
  if (warnIds.length && visible.length) {
    const { data } = await supabase.from("patient_record_entries").select("patient_id").in("category_id", warnIds).in("patient_id", [...new Set(visible.map((a) => a.patient_id))]);
    warnPatients = new Set((data ?? []).map((r) => r.patient_id));
  }

  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const flow: FlowAppt[] = visible.map((a) => {
    const d = byId.get(a.doctor_id);
    return {
      id: a.id, status: a.status, starts_at: a.starts_at, ends_at: a.ends_at, delay_minutes: a.delay_minutes, ticket_number: a.ticket_number,
      is_emergency: a.is_emergency, reason: a.reason, location_kind: a.location_kind, checked_in_at: a.checked_in_at, actual_start: a.actual_start,
      actual_end: a.actual_end, patientName: a.patient ? `${a.patient.last_name}, ${a.patient.first_name}` : "—",
      doctorColor: d?.color ?? "#94a3b8", doctorName: d ? short(d) : "", roomName: a.room_id ? roomName.get(a.room_id) ?? null : null, warn: warnPatients.has(a.patient_id), selfCheckin: a.self_checked_in,
    };
  });

  // Raumstatus: belegt, solange dort jemand in Behandlung ist (unabhängig vom Arzt-Filter)
  const roomStates: RoomState[] = rooms.filter((r) => r.active).map((r) => {
    const cur = appts.find((a) => a.room_id === r.id && a.status === "in_behandlung");
    const d = cur ? byId.get(cur.doctor_id) : undefined;
    const next = appts.filter((a) => a.room_id === r.id && (a.status === "geplant" || a.status === "bestaetigt" || a.status === "eingecheckt") && a.starts_at >= now.toISOString())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    return {
      id: r.id, name: r.name, capabilities: r.capabilities ?? [],
      busy: cur ? { patient: cur.patient ? cur.patient.last_name : "—", doctor: d ? short(d) : "", since: fmtTime(cur.actual_start ?? cur.starts_at, tz), color: d?.color ?? "#94a3b8" } : null,
      next: next ? fmtTime(next.starts_at, tz) : null,
    };
  });
  const spalte = (["erwartet", "wartezimmer", "behandlung", "erledigt"] as const).find((k) => k === sp.spalte) as ColumnKey | undefined;

  const delays = detectDelays(visible.filter((a) => ACTIVE_STATUSES.includes(a.status)), now);
  const absent = absences
    .map((ab) => ({ name: short(byId.get(ab.staff_id) ?? { title: null, last_name: "Mitarbeiter" }), count: appts.filter((a) => a.doctor_id === ab.staff_id && ACTIVE_STATUSES.includes(a.status)).length }))
    .filter((x) => x.count > 0);

  const chips = providers.map((p) => ({ id: p.id, label: short(p), color: p.color, count: appts.filter((a) => a.doctor_id === p.id).length }));
  const dd = (iso: string) => iso.split("-").reverse().slice(0, 2).join(".");
  const tasks = (tasksRes.data ?? []).map((t) => {
    const patient = t.patient as unknown as { first_name: string; last_name: string } | null;
    return {
      id: t.id as string, title: t.title as string, patientName: patient ? `${patient.last_name}, ${patient.first_name}` : null,
      due: t.due_date as string | null, overdue: !!t.due_date && t.due_date < day,
      dueLabel: t.due_date ? (t.due_date === day ? "heute" : t.due_date < day ? `seit ${dd(t.due_date)}.` : `${dd(t.due_date)}.`) : null,
    };
  });
  const notes = (notesRes.data ?? []).map((n) => ({ id: n.id as string, title: n.title as string, body: n.body as string | null, appointment_id: n.appointment_id as string | null, when: fmtDateTime(n.created_at, tz) }));

  const h = await headers();
  const displayUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/anzeige/${practice.display_token}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Heute</h1>
          <p className="text-sm text-slate-500">{fmtDay(day)}</p>
        </div>
        <a href={displayUrl} target="_blank" rel="noreferrer" className="btn-secondary">
          <MonitorPlay className="h-4 w-4" /> Aufruf-Bildschirm
        </a>
      </div>

      {sp.willkommen && (
        <Notice tone="success">
          Praxis angelegt. Als Nächstes: <Link className="underline" href="/einstellungen">Sprechzeiten und Regeln prüfen</Link>,{" "}
          <Link className="underline" href="/personal">Team ergänzen</Link>, <Link className="underline" href="/patienten/neu">ersten Patienten anlegen</Link>.
        </Notice>
      )}
      {typeof sp.fehler === "string" && <Notice tone="error">{sp.fehler}</Notice>}

      <DoctorFilter chips={chips} active={arzt} total={appts.length} />

      <Attention
        delays={delays}
        staffById={byId}
        tz={tz}
        absent={absent}
        freed={freedRes.count ?? 0}
        waitlist={waitRes.count ?? 0}
        overdueTasks={overdueRes.count ?? 0}
        absenceRequests={requestsRes.count ?? 0}
      />

      <RoomStatus rooms={roomStates} />

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <FlowBoard appts={flow} nowIso={now.toISOString()} tz={tz} back={`/?arzt=${arzt}`} spalte={spalte} />
        <ForYou notes={notes} tasks={tasks} absent={absences.map((ab) => ({ id: ab.id, name: short(byId.get(ab.staff_id) ?? { title: null, last_name: "Mitarbeiter" }), kind: ABSENCE[ab.kind] }))} />
      </div>
    </div>
  );
}

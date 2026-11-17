import Link from "next/link";
import { headers } from "next/headers";
import { MonitorPlay } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadAppointments, loadRooms, loadStaff } from "@/lib/data";
import { dayRange, fmtTime, minutesBetween, today } from "@/lib/time";
import { Card, Empty, PageHeader, StatusBadge, patientName, staffName } from "@/components/ui";
import { QuickStatus } from "@/components/appointment-row";
import { setStatus } from "@/app/actions/appointments";
import { SubmitButton } from "@/components/submit-button";
import type { AppointmentWithPatient, Staff } from "@/lib/types";

export const metadata = { title: "Wartezimmer" };

export default async function WaitingRoom() {
  const { supabase, practice } = await getContext();
  const tz = practice.timezone;
  const day = today(tz);
  const { from, to } = dayRange(day, tz);
  const [appts, { byId }, rooms] = await Promise.all([loadAppointments(supabase, practice.id, from, to), loadStaff(supabase, practice.id), loadRooms(supabase, practice.id)]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const now = new Date();
  const expected = appts.filter((a) => ["geplant", "bestaetigt"].includes(a.status));
  const waiting = appts.filter((a) => a.status === "eingecheckt").sort((a, b) => (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? ""));
  const treating = appts.filter((a) => a.status === "in_behandlung");
  const h = await headers();
  const displayUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/anzeige/${practice.display_token}`;

  return (
    <>
      <PageHeader
        title="Wartezimmer"
        subtitle="Check-in, Aufruf und Behandlungsstatus in Echtzeit."
        actions={<a href={displayUrl} target="_blank" className="btn-secondary"><MonitorPlay className="h-4 w-4" /> Aufruf-Bildschirm öffnen</a>}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={`Erwartet (${expected.length})`} bodyClass="px-4 py-1">
          {expected.length ? <ul className="divide-y divide-slate-100">{expected.map((a) => (
            <Row key={a.id} tz={tz} byId={byId} roomName={roomName} a={a} extra={
              new Date(a.starts_at) < now && (
                <form action={setStatus}>
                  <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="nicht_erschienen" /><input type="hidden" name="back" value="/wartezimmer" />
                  <SubmitButton size="sm" variant="ghost">Nicht erschienen</SubmitButton>
                </form>
              )
            } />
          ))}</ul> : <Empty>Keine weiteren Patienten erwartet.</Empty>}
        </Card>
        <Card title={`Im Wartezimmer (${waiting.length})`} bodyClass="px-4 py-1">
          {waiting.length ? <ul className="divide-y divide-slate-100">{waiting.map((a) => (
            <Row key={a.id} tz={tz} byId={byId} roomName={roomName} a={a} extra={a.checked_in_at && <span className="text-xs text-amber-700">wartet {minutesBetween(a.checked_in_at, now)} min</span>} />
          ))}</ul> : <Empty>Niemand wartet.</Empty>}
        </Card>
        <Card title={`In Behandlung (${treating.length})`} bodyClass="px-4 py-1">
          {treating.length ? <ul className="divide-y divide-slate-100">{treating.map((a) => (
            <Row key={a.id} tz={tz} byId={byId} roomName={roomName} a={a} extra={a.actual_start && <span className="text-xs text-slate-500">seit {minutesBetween(a.actual_start, now)} min</span>} />
          ))}</ul> : <Empty>Niemand in Behandlung.</Empty>}
        </Card>
      </div>
      <p className="mt-3 text-xs text-slate-500">Der Aufruf-Bildschirm zeigt nur Wartenummern und Räume – keine Namen (Datenschutz). Link: {displayUrl}</p>
    </>
  );
}

function Row({ a, extra, tz, byId, roomName }: {
  a: AppointmentWithPatient; extra?: React.ReactNode; tz: string; byId: Map<string, Staff>; roomName: Map<string, string>;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      {a.ticket_number && <span className="w-10 rounded bg-brand-100 text-center font-semibold text-brand-800">#{a.ticket_number}</span>}
      <Link href={`/termine/${a.id}`} className="min-w-40 flex-1 hover:underline">
        <b>{patientName(a.patient)}</b>
        <div className="text-xs text-slate-500">{fmtTime(a.starts_at, tz)} · {a.reason} · {staffName(byId.get(a.doctor_id))}{a.room_id && ` · ${roomName.get(a.room_id)}`}</div>
      </Link>
      {extra}
      <StatusBadge status={a.status} />
      <QuickStatus a={a} back="/wartezimmer" />
    </li>
  );
}

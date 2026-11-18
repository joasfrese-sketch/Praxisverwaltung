import Link from "next/link";
import { Check } from "lucide-react";
import { markNotificationsRead } from "@/app/actions/misc";
import { toggleTask } from "@/app/actions/organisation";
import { SubmitButton } from "@/components/submit-button";

export interface NoteItem { id: string; title: string; body: string | null; appointment_id: string | null; when: string }
export interface TaskItem { id: string; title: string; patientName: string | null; due: string | null; overdue: boolean; dueLabel: string | null }
export interface AbsentItem { id: string; name: string; kind: string }

function Block({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 md:border-l md:border-slate-200 md:pl-5 md:first:border-l-0 md:first:pl-0 2xl:border-l-0 2xl:pl-0 2xl:py-3 2xl:first:pt-0 2xl:last:pb-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Persönlicher Bereich: neue Meldungen, offene Aufgaben (direkt abhakbar) und wer heute fehlt. */
export function ForYou({ notes, tasks, absent }: { notes: NoteItem[]; tasks: TaskItem[]; absent: AbsentItem[] }) {
  return (
    <aside className="card grid gap-5 p-4 md:grid-cols-[repeat(auto-fit,minmax(230px,1fr))] 2xl:grid-cols-1 2xl:gap-0 2xl:divide-y 2xl:divide-slate-200" aria-label="Für dich">
      <Block
        title="Neu für dich"
        action={notes.length > 0 && (
          <form action={markNotificationsRead}><SubmitButton size="sm" variant="ghost">Alle gelesen</SubmitButton></form>
        )}
      >
        {notes.length ? (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="text-sm">
                <Link href={n.appointment_id ? `/termine/${n.appointment_id}` : "/benachrichtigungen"} className="font-medium hover:underline">{n.title}</Link>
                <div className="text-xs text-slate-500">{n.body ? `${n.body}, ` : ""}{n.when}</div>
              </li>
            ))}
          </ul>
        ) : <p className="py-1 text-sm text-slate-500">Keine neuen Meldungen.</p>}
      </Block>

      <Block title="Aufgaben" action={<Link href="/aufgaben" className="text-xs text-brand-700 hover:underline">Alle ansehen</Link>}>
        {tasks.length ? (
          <ul className="space-y-1.5">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-sm">
                <form action={toggleTask} className="pt-0.5">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="done" value="1" />
                  <button className="flex h-[18px] w-[18px] items-center justify-center rounded border border-slate-400 text-transparent hover:border-st-done hover:text-st-done" aria-label={`„${t.title}“ erledigt`}>
                    <Check className="h-3 w-3" />
                  </button>
                </form>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.title}</span>
                  {t.patientName && <span className="block truncate text-xs text-slate-500">{t.patientName}</span>}
                </span>
                {t.dueLabel && <span className={`text-xs tabular-nums ${t.overdue ? "font-medium text-warn" : "text-slate-500"}`}>{t.dueLabel}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="py-1 text-sm text-slate-500">Keine offenen Aufgaben.</p>}
      </Block>

      {absent.length > 0 && (
        <Block title="Heute abwesend">
          <ul className="space-y-1 text-sm">
            {absent.map((a) => <li key={a.id} className="flex justify-between gap-2"><span>{a.name}</span><span className="text-slate-500">{a.kind}</span></li>)}
          </ul>
        </Block>
      )}
    </aside>
  );
}

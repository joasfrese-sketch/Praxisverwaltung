"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Data = { practice: string; called: { ticket: number; room: string | null; at: string }[]; waiting: number[] } | null;

/** Aufrufe sind 2 Minuten sichtbar – danach verschwinden sie von selbst. */
const SHOW_MS = 2 * 60 * 1000;

export function Display({ token }: { token: string }) {
  const [data, setData] = useState<Data>(null);
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase.rpc("waiting_room_display", { p_token: token });
      setData(data as Data);
    };
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [token]);

  const called = (data?.called ?? []).filter((c) => !nowMs || nowMs - new Date(c.at).getTime() < SHOW_MS);
  const clock = nowMs ? new Date(nowMs).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="flex min-h-screen flex-col bg-brand-900 p-6 text-white sm:p-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{data?.practice ?? "…"}</h1>
        <span className="text-3xl tabular-nums text-brand-200">{clock}</span>
      </header>
      <div className="grid flex-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <section aria-live="polite">
          <h2 className="mb-4 text-2xl text-brand-200">Aufruf</h2>
          <ul className="space-y-4">
            {called.map((c, i) => (
              <li key={c.ticket} className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-2 rounded-2xl px-8 py-6 ${i === 0 ? "animate-[pulse_1.5s_ease-in-out_3] bg-amber-400 text-brand-900" : "bg-brand-700"}`}>
                <span className="text-7xl font-bold tabular-nums">{c.ticket}</span>
                <span className="text-right">
                  <span className={`block text-xl ${i === 0 ? "text-brand-800" : "text-brand-200"}`}>Bitte gehen Sie in</span>
                  <span className="block text-5xl font-semibold">{c.room ?? "das Behandlungszimmer"}</span>
                </span>
              </li>
            ))}
            {!called.length && <li className="text-3xl text-brand-300">Bitte warten Sie, bis Ihre Nummer erscheint.</li>}
          </ul>
        </section>
        <section>
          <h2 className="mb-4 text-2xl text-brand-200">Wartend</h2>
          <div className="flex flex-wrap gap-3">
            {(data?.waiting ?? []).map((n) => <span key={n} className="rounded-xl bg-brand-700 px-5 py-3 text-4xl tabular-nums">{n}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}

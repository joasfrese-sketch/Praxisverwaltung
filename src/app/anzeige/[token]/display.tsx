"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Data = { practice: string; called: { ticket: number; room: string; at: string }[]; waiting: number[] } | null;

export function Display({ token }: { token: string }) {
  const [data, setData] = useState<Data>(null);
  const [now, setNow] = useState("");
  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase.rpc("waiting_room_display", { p_token: token });
      setData(data as Data);
      setNow(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-900 p-8 text-white">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{data?.practice ?? "…"}</h1>
        <span className="text-3xl tabular-nums text-brand-200">{now}</span>
      </header>
      <div className="grid flex-1 gap-8 md:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-4 text-xl text-brand-200 uppercase">Aufruf</h2>
          <ul className="space-y-4">
            {(data?.called ?? []).map((c, i) => (
              <li key={c.ticket} className={`flex items-center justify-between rounded-2xl px-8 py-6 ${i === 0 ? "bg-amber-400 text-brand-900" : "bg-brand-700"}`}>
                <span className="text-6xl font-bold tabular-nums">{c.ticket}</span>
                <span className="text-4xl">→ {c.room}</span>
              </li>
            ))}
            {!data?.called?.length && <li className="text-2xl text-brand-300">Bitte warten Sie, bis Ihre Nummer erscheint.</li>}
          </ul>
        </section>
        <section>
          <h2 className="mb-4 text-xl text-brand-200 uppercase">Wartend</h2>
          <div className="flex flex-wrap gap-3">
            {(data?.waiting ?? []).map((n) => <span key={n} className="rounded-xl bg-brand-700 px-5 py-3 text-3xl tabular-nums">{n}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}

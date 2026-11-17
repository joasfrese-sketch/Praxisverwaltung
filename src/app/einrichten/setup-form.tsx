"use client";
import { useActionState, useState } from "react";
import { createPractice, type SetupPayload } from "./actions";
import { PRACTICE_TYPES, STAFF_ROLES, DEFAULT_TYPES } from "@/lib/labels";
import type { PracticeType, StaffRole } from "@/lib/types";

type Person = { title: string; first_name: string; last_name: string; email: string; role: StaffRole };
const empty = (role: StaffRole): Person => ({ title: "", first_name: "", last_name: "", email: "", role });

function resize(list: Person[], n: number, role: StaffRole) {
  const next = list.slice(0, n);
  while (next.length < n) next.push(empty(role));
  return next;
}

export function SetupForm() {
  const [state, action, pending] = useActionState(createPractice, {});
  const [name, setName] = useState("");
  const [type, setType] = useState<PracticeType>("allgemeinmedizin");
  const [contact, setContact] = useState({ phone: "", street: "", zip: "", city: "" });
  const [me, setMe] = useState<Person>(empty("arzt"));
  const [rooms, setRooms] = useState(3);
  const [providers, setProviders] = useState<Person[]>([]);
  const [team, setTeam] = useState<Person[]>([empty("mfa")]);

  const providerRole: StaffRole = type === "physiotherapie" || type === "psychotherapie" ? "therapeut" : "arzt";
  const payload: SetupPayload = { name, practice_type: type, ...contact, me, rooms, staff: [...providers, ...team] };

  const personRows = (list: Person[], set: (l: Person[]) => void, roles: StaffRole[]) =>
    list.map((p, i) => (
      <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[5rem_1fr_1fr_1.4fr_9rem]">
        <input className="input" placeholder="Titel" value={p.title} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
        <input className="input" placeholder="Vorname" value={p.first_name} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, first_name: e.target.value } : x)))} />
        <input className="input" placeholder="Nachname" value={p.last_name} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, last_name: e.target.value } : x)))} />
        <input className="input" type="email" placeholder="E-Mail (für Login)" value={p.email} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
        <select className="input" value={p.role} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, role: e.target.value as StaffRole } : x)))}>
          {roles.map((r) => <option key={r} value={r}>{STAFF_ROLES[r]}</option>)}
        </select>
      </div>
    ));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">1. Praxis</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">Name der Praxis *</span>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Praxis Dr. Muster" />
          </label>
          <label className="block"><span className="label">Art der Praxis *</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as PracticeType)}>
              {Object.entries(PRACTICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block"><span className="label">Telefon</span>
            <input className="input" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </label>
          <label className="block"><span className="label">Straße</span>
            <input className="input" value={contact.street} onChange={(e) => setContact({ ...contact, street: e.target.value })} />
          </label>
          <label className="block"><span className="label">PLZ</span>
            <input className="input" value={contact.zip} onChange={(e) => setContact({ ...contact, zip: e.target.value })} />
          </label>
          <label className="block"><span className="label">Ort</span>
            <input className="input" value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Vorlagen für Termintypen ({DEFAULT_TYPES[type].map((t) => t.name).join(", ")}) werden passend zur Praxisart angelegt.
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">2. Du selbst</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[5rem_1fr_1fr_11rem]">
          <input className="input" placeholder="Titel" value={me.title} onChange={(e) => setMe({ ...me, title: e.target.value })} />
          <input className="input" placeholder="Vorname *" required value={me.first_name} onChange={(e) => setMe({ ...me, first_name: e.target.value })} />
          <input className="input" placeholder="Nachname *" required value={me.last_name} onChange={(e) => setMe({ ...me, last_name: e.target.value })} />
          <select className="input" value={me.role} onChange={(e) => setMe({ ...me, role: e.target.value as StaffRole })}>
            {Object.entries(STAFF_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">3. Größe & Team</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="label">Behandlungsräume</span>
            <input className="input" type="number" min={0} max={50} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} />
          </label>
          <label className="block"><span className="label">Weitere Ärzte / Therapeuten</span>
            <input className="input" type="number" min={0} max={50} value={providers.length} onChange={(e) => setProviders(resize(providers, Number(e.target.value), providerRole))} />
          </label>
          <label className="block"><span className="label">MFA / Empfang / Verwaltung</span>
            <input className="input" type="number" min={0} max={50} value={team.length} onChange={(e) => setTeam(resize(team, Number(e.target.value), "mfa"))} />
          </label>
        </div>
        {providers.length > 0 && <div className="space-y-2"><span className="label">Ärzte / Therapeuten</span>{personRows(providers, setProviders, ["arzt", "therapeut"])}</div>}
        {team.length > 0 && <div className="space-y-2"><span className="label">Praxisteam</span>{personRows(team, setTeam, ["mfa", "verwaltung"])}</div>}
        <p className="text-xs text-slate-500">
          Mitarbeitende mit E-Mail-Adresse können sich selbst registrieren und werden automatisch dieser Praxis zugeordnet.
        </p>
      </section>

      {state?.error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Praxis wird angelegt …" : "Praxis anlegen"}</button>
    </form>
  );
}

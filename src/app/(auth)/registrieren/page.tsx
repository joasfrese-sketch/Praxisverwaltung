"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) {
      router.replace("/");
      router.refresh();
    } else setSent(true);
  }

  if (sent)
    return (
      <div className="space-y-3 text-sm">
        <h1 className="text-lg font-semibold">Fast geschafft</h1>
        <p>Wir haben dir eine E-Mail an <b>{email}</b> geschickt. Bitte bestätige deine Adresse über den Link darin.</p>
        <Link href="/login" className="btn-secondary w-full">Zur Anmeldung</Link>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-lg font-semibold">Neue Praxis registrieren</h1>
      <p className="text-sm text-slate-600">
        Nur für <b>neue Praxen</b> (Inhaber/Admin). Mitarbeitende registrieren sich nicht hier, sondern bekommen von ihrer Praxis einen persönlichen <b>Einladungslink</b>.
      </p>
      <label className="block">
        <span className="label">E-Mail</span>
        <input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Passwort (mind. 8 Zeichen)</span>
        <input className="input" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>Registrieren</button>
      <p className="text-center text-sm text-slate-500">
        Schon registriert? <Link href="/login" className="font-medium text-brand-700 hover:underline">Anmelden</Link>
      </p>
    </form>
  );
}

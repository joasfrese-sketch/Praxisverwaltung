"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RECENT_KEY = "praxis.recent-logins";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(r)) setRecent(r.slice(0, 6));
    } catch {}
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch." : error.message);
      setBusy(false);
      return;
    }
    try {
      const list = [email, ...recent.filter((x) => x !== email)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {}
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    router.replace(aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" ? "/login/2fa" : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-lg font-semibold">Anmelden</h1>
      {recent.length > 0 && (
        <div>
          <span className="label">Schneller Benutzerwechsel</span>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setEmail(r);
                  document.getElementById("password")?.focus();
                }}
                className={`rounded-full border px-2.5 py-1 text-xs ${email === r ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="block">
        <span className="label">E-Mail</span>
        <input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Passwort</span>
        <input id="password" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Anmelden …" : "Anmelden"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Neu hier? <Link href="/registrieren" className="font-medium text-brand-700 hover:underline">Konto erstellen</Link>
      </p>
    </form>
  );
}

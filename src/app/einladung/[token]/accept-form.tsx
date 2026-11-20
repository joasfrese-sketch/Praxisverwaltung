"use client";
import { useActionState, useEffect } from "react";
import { acceptInvite, type AcceptState } from "@/app/actions/invites";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvite, null);
  const ok = state?.error === "";
  useEffect(() => {
    if (ok) window.location.replace("/");
  }, [ok]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <label className="block"><span className="label">E-Mail</span><input name="email" type="email" required autoComplete="username" className="input" /></label>
      <label className="block"><span className="label">Passwort (mind. 8 Zeichen)</span><input name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></label>
      <label className="block"><span className="label">Passwort wiederholen</span><input name="password2" type="password" minLength={8} required autoComplete="new-password" className="input" /></label>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending || ok}>{ok ? "Angemeldet – weiter …" : pending ? "…" : "Konto aktivieren"}</button>
    </form>
  );
}

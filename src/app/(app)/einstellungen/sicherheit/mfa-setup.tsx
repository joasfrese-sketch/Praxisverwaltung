"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string };

export function MfaSetup() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pw, setPw] = useState("");

  const load = useCallback(async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function start() {
    setMsg(null);
    const supabase = createClient();
    for (const f of factors.filter((f) => f.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toLocaleDateString("de-DE")}` });
    if (error) return setMsg(error.message);
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function verify() {
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll!.id, code });
    if (error) return setMsg("Code ungültig.");
    setEnroll(null);
    setCode("");
    setMsg("Zwei-Faktor-Authentifizierung aktiviert.");
    load();
  }
  async function remove(id: string) {
    if (!confirm("2FA wirklich deaktivieren?")) return;
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id });
    setMsg(error ? error.message : "2FA deaktiviert.");
    load();
  }
  async function changePassword() {
    const { error } = await createClient().auth.updateUser({ password: pw });
    setMsg(error ? error.message : "Passwort geändert.");
    setPw("");
  }
  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="space-y-4">
      {msg && <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm">{msg}</div>}
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Zwei-Faktor-Authentifizierung (optional)</h2>
        <p className="text-sm text-slate-600">Schützt dein Konto zusätzlich mit einem Code aus einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator, 1Password).</p>
        {verified.length ? (
          <ul className="space-y-1 text-sm">
            {verified.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded bg-emerald-50 px-3 py-2">
                <span>✓ Aktiv: {f.friendly_name}</span>
                <button className="btn-ghost btn-sm" onClick={() => remove(f.id)}>Deaktivieren</button>
              </li>
            ))}
          </ul>
        ) : enroll ? (
          <div className="space-y-3">
            <p className="text-sm">1. QR-Code mit der App scannen (oder Schlüssel eingeben): <code className="text-xs break-all">{enroll.secret}</code></p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="QR-Code" className="h-44 w-44 rounded border" />
            <p className="text-sm">2. Angezeigten Code eingeben:</p>
            <div className="flex gap-2">
              <input className="input w-36 text-center tracking-widest" maxLength={6} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button className="btn-primary" disabled={code.length !== 6} onClick={verify}>Aktivieren</button>
            </div>
          </div>
        ) : (
          <button className="btn-primary" onClick={start}>2FA einrichten</button>
        )}
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Passwort ändern</h2>
        <div className="flex gap-2">
          <input type="password" minLength={8} className="input" placeholder="Neues Passwort (mind. 8 Zeichen)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn-secondary" disabled={pw.length < 8} onClick={changePassword}>Ändern</button>
        </div>
      </section>
    </div>
  );
}

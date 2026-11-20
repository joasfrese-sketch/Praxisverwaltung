import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/time";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Einladung" };

type Info = { practice: string; name: string; email_hint: string; expires_at: string } | null;

export default async function InvitePage({ params }: PageProps<"/einladung/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_info", { p_token: token });
  const info = data as Info;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 to-brand-600 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">Praxisverwaltung</span>
        </div>
        <div className="card p-6">
          {!info ? (
            <div className="space-y-2">
              <h1 className="text-lg font-semibold">Einladung ungültig</h1>
              <p className="text-sm text-slate-600">Der Link ist abgelaufen, wurde schon benutzt oder ist unvollständig. Bitte in der Praxis einen neuen Link anfordern.</p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Willkommen, {info.name}</h1>
              <p className="mt-1 mb-4 text-sm text-slate-600">
                Du wurdest zu <strong>{info.practice}</strong> eingeladen. Gib die E-Mail-Adresse ein, an die die Einladung ging
                (<span className="font-mono">{info.email_hint}</span>), und wähle dein Passwort. Gültig bis {fmtDate(info.expires_at)}.
              </p>
              <AcceptForm token={token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { cookies } from "next/headers";
import { getContext } from "@/lib/context";
import { setFontScale } from "@/app/actions/prefs";
import { FONT_SCALES } from "@/lib/labels";
import { Card, PageHeader, staffName } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { MfaSetup } from "./mfa-setup";

export const metadata = { title: "Mein Konto" };

export default async function Security() {
  const { supabase, userId, me, email } = await getContext();
  const { data: pref } = await supabase.from("user_prefs").select("font_scale").eq("user_id", userId).maybeSingle();
  const current = pref?.font_scale ?? (Number((await cookies()).get("schrift")?.value) || 100);
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Mein Konto & Sicherheit" subtitle={`${staffName(me)} · ${email}`} />
      <Card title="Schriftgröße">
        <p className="mb-3 text-sm text-slate-600">Gilt nur für dein Login und wird auf jedem Gerät übernommen, an dem du dich anmeldest.</p>
        <form action={setFontScale} className="flex flex-wrap gap-2">
          {FONT_SCALES.map((f) => (
            <SubmitButton key={f.value} name="font_scale" value={String(f.value)} variant={f.value === current ? "primary" : "secondary"}>
              <span style={{ fontSize: `${(f.value / 100) * 0.875}rem` }}>Aa</span> {f.label}
            </SubmitButton>
          ))}
        </form>
      </Card>
      <MfaSetup />
    </div>
  );
}

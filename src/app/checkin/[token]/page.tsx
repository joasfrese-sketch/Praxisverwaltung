import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Kiosk } from "./kiosk";

export const metadata = { title: "Anmeldung", robots: { index: false } };

export default async function CheckinPage({ params }: PageProps<"/checkin/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("self_checkin_info", { p_token: token });
  const info = data as { practice: string; enabled: boolean } | null;
  if (!info) notFound();
  return <Kiosk token={token} practice={info.practice} enabled={info.enabled} />;
}

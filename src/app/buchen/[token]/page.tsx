import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Booking, type BookingInfo } from "./booking";

export const metadata = { title: "Termin online buchen", robots: { index: false } };

/** /buchen/<Schlüssel> oder fester Kurzname, z. B. /buchen/termin */
export default async function BookingPage({ params }: PageProps<"/buchen/[token]">) {
  const { token: param } = await params;
  const supabase = await createClient();
  let token = param;
  if (!/^[0-9a-f-]{36}$/i.test(param)) {
    if (!/^[a-z0-9-]{3,40}$/i.test(param)) notFound();
    const { data } = await supabase.rpc("booking_token_by_slug", { p_slug: param });
    if (!data) notFound();
    token = data as string;
  }
  const { data } = await supabase.rpc("online_booking_info", { p_token: token });
  if (!data) notFound();
  return <Booking token={token} info={data as BookingInfo} />;
}

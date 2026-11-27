import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Booking, type BookingInfo } from "./booking";

export const metadata = { title: "Termin online buchen", robots: { index: false } };

export default async function BookingPage({ params }: PageProps<"/buchen/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("online_booking_info", { p_token: token });
  if (!data) notFound();
  return <Booking token={token} info={data as BookingInfo} />;
}

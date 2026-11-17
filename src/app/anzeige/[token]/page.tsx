import { notFound } from "next/navigation";
import { Display } from "./display";

export const metadata = { title: "Aufruf", robots: { index: false } };

export default async function DisplayPage({ params }: PageProps<"/anzeige/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  return <Display token={token} />;
}

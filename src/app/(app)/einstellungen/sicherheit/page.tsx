import { getContext } from "@/lib/context";
import { PageHeader, staffName } from "@/components/ui";
import { MfaSetup } from "./mfa-setup";

export const metadata = { title: "Mein Konto" };

export default async function Security() {
  const { me, email } = await getContext();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Mein Konto & Sicherheit" subtitle={`${staffName(me)} · ${email}`} />
      <MfaSetup />
    </div>
  );
}

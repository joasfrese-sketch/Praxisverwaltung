import { getUser } from "@/lib/context";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Praxis einrichten" };

export default async function SetupPage() {
  const { email } = await getUser();
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-600 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-white">
          <h1 className="text-2xl font-semibold">Praxis einrichten</h1>
          <p className="text-brand-100">Angemeldet als {email}. Du wirst Administrator dieser Praxis. Alles lässt sich später in den Einstellungen ändern.</p>
        </div>
        <SetupForm />
        <form action="/auth/abmelden" method="post" className="mt-4 text-center">
          <button className="text-sm text-brand-100 hover:underline">Abmelden</button>
        </form>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Nicht gefunden</h1>
      <p className="text-slate-600">Diese Seite existiert nicht oder Sie haben keine Berechtigung.</p>
      <Link href="/" className="btn-primary">Zur Startseite</Link>
    </div>
  );
}

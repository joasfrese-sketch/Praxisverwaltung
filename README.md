# Praxisverwaltung

Web-App für Arztpraxen: Terminplanung, Störungsmanagement (Verspätung, Ausfall/Vertretung, Absage/Warteliste), Wartezimmer mit Aufrufbildschirm, Patientenakte, Aufgaben und Benachrichtigungen. Mandantenfähig – jede Praxis wählt beim Anlegen ihre Fachrichtung.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + RLS, Auth, Realtime, Storage) · Vercel · GitHub

- [Lastenheft](docs/Lastenheft.md) · [Fragebogen](docs/Fragebogen.md) · [SMTP-Einrichtung](docs/SMTP-Einrichtung.md) · [Probleme und Lösungen](docs/Probleme-und-Loesungen.md) ([PDF](docs/Probleme-und-Loesungen.pdf))
- Datenbank-Migrationen: `supabase/migrations/`

## Lokal starten
```bash
cp .env.example .env.local   # Supabase-URL + Publishable Key eintragen
npm install
npm run dev
```

## Deployment
Push auf GitHub → Vercel baut automatisch (Branch = Vorschau, `main` = Produktion).

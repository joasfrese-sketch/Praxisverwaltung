# E-Mail-Versand – Einrichtung

## Stand
- Die App erzeugt alle Patienten-E-Mails (Bestätigung, Erinnerung, Verschiebung, Verspätung, Vertretung, Absage) und sammelt sie im **Ausgang** (Benachrichtigungen).
- Supabase stößt alle 5 Minuten den Versand an (`/api/jobs/emails`). Ist kein SMTP eingetragen, bleiben die Mails einfach im Ausgang.
- Datenschutz: E-Mails enthalten nur Zeit, Ort, Behandler und den Bestätigen/Absagen-Link – keinen Anlass, keine Befunde.

---

## Phase 1 – Testbetrieb ohne E-Mail (aktuell)

**Supabase** (Projekt *Praxisverwaltung*):
1. Authentication → Sign In / Providers → Email → **„Confirm email“ aus** → Save.
2. Authentication → Emails → SMTP Settings → **„Enable custom SMTP“ aus** → Save.

**Vercel** (Projekt *praxisverwaltung*):
3. Settings → Environment Variables → die fünf Variablen `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` **löschen**.
4. Deployments → letztes Deployment → **Redeploy**.

Ergebnis: Registrierung ohne Bestätigungs-Mail, sofort angemeldet. Patienten-Mails sammeln sich im Ausgang.

---

## Phase 2 – Echtbetrieb mit eigenem Praxis-Postfach

Empfehlung: Postfach mit eigener Domain (z. B. `termine@praxis-name.de`) – normales SMTP-Passwort, keine Telefonnummer, **AV-Vertrag (DSGVO)** möglich, bessere Zustellbarkeit.

| Anbieter | SMTP_HOST | SMTP_PORT | SMTP_USER |
|---|---|---|---|
| IONOS | `smtp.ionos.de` | `465` | volle E-Mail-Adresse |
| Strato | `smtp.strato.de` | `465` | volle E-Mail-Adresse |
| all-inkl | wird im KAS angezeigt (z. B. `w0123456.kasserver.com`) | `465` | Postfach-Name / Adresse |
| Google Workspace | `smtp.gmail.com` | `465` | volle Adresse (App-Passwort nötig) |
| Microsoft 365 | `smtp.office365.com` | `587` | volle Adresse (SMTP-Auth im Admin-Center aktivieren) |

`SMTP_PASSWORD` = Postfach-Passwort, `SMTP_FROM` = Absenderadresse (meist = `SMTP_USER`).

**Schritte:**
1. Postfach beim Anbieter anlegen, AV-Vertrag abschließen, SPF/DKIM für die Domain aktivieren (machen die meisten Anbieter automatisch).
2. **Vercel** → Environment Variables → die fünf `SMTP_*`-Variablen (Production) anlegen, `SMTP_PASSWORD` als *Sensitive* → Redeploy.
3. **Supabase** → Authentication → Emails → SMTP Settings → dieselben Daten, Sender name = Praxisname → Save.
4. **Supabase** → Sign In / Providers → Email → **„Confirm email“ wieder an**.
5. In der App: Einstellungen → E-Mail-Versand → **„Testmail senden“**.
6. Benachrichtigungen → ggf. **„Fehlgeschlagene erneut senden“** – gesammelte Mails gehen dann raus.

Passwörter nie in den Chat schreiben – Claude kann den Erfolg über die Protokolle prüfen.

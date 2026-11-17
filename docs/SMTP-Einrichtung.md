# E-Mail-Versand einrichten (SMTP)

## Was bereits fertig ist
- **Ausgang:** Jede Terminänderung erzeugt eine Patienten-E-Mail im Ausgang (Bestätigung, Verschiebung, Verspätung, Behandlerwechsel, Absage).
- **Erinnerungen:** Supabase erzeugt alle 5 Minuten fällige Erinnerungen (Standard 24 h vorher, pro Praxis/Patient einstellbar).
- **Versand:** Supabase ruft alle 5 Minuten `https://praxisverwaltung.vercel.app/api/jobs/emails` auf; die App verschickt die Mails per SMTP. Fehlversuche werden bis zu 5× wiederholt.
- **Absicherung:** gemeinsamer Schlüssel `EMAIL_JOB_SECRET` (Vercel) = `private.app_settings.job_secret` (Supabase) – bereits gesetzt.
- **Datenschutz:** E-Mails enthalten nur Zeit, Ort, Behandler und den Bestätigen/Absagen-Link – keinen Anlass, keine Befunde.
- **Testen:** Einstellungen → „Testmail senden“; Benachrichtigungen → „Jetzt senden“.

## Deine Aufgaben

### 1. Absender-Adresse anlegen (Variante Gmail – kostenlos, gut für die Testphase)
1. https://accounts.google.com/signup → neues Konto, z. B. **praxisverwaltung.termine@gmail.com** (oder `<praxisname>.termine@gmail.com`).
2. Konto → Sicherheit → **Bestätigung in zwei Schritten** aktivieren (Pflicht für Schritt 3).
3. https://myaccount.google.com/apppasswords → App-Passwort „Praxisverwaltung“ erzeugen → 16-stelligen Code notieren (ohne Leerzeichen).

> Für den Echtbetrieb mit Patientendaten: lieber **Google Workspace** (≈ 7 €/Monat, Adresse mit eigener Domain, z. B. termine@praxis-muster.de) oder ein E-Mail-Postfach beim Domain-Hoster (IONOS, Strato, all-inkl …). Dort gibt es einen **AV-Vertrag (DSGVO)** – beim kostenlosen Gmail nicht. Die Schritte 2–4 bleiben gleich, nur Host/Port ändern sich.

### 2. Zugangsdaten in Vercel eintragen
Vercel → Projekt **praxisverwaltung** → Settings → Environment Variables → für *Production* und *Preview*:

| Name | Wert (Gmail) | Typ |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Plain |
| `SMTP_PORT` | `465` | Plain |
| `SMTP_USER` | deine neue Gmail-Adresse | Plain |
| `SMTP_PASSWORD` | das App-Passwort | **Sensitive** |
| `SMTP_FROM` | dieselbe Gmail-Adresse | Plain |

Passwort **nicht in den Chat** schreiben. Danach: Deployments → letztes Deployment → „Redeploy“.

### 3. Dieselben Daten in Supabase für Login-Mails (Registrierung, Passwort vergessen)
Supabase → Projekt Praxisverwaltung → Authentication → Emails → **SMTP Settings** → „Enable custom SMTP“:
Host `smtp.gmail.com`, Port `465`, Username/Passwort wie oben, Sender email = Adresse, Sender name = Praxisname.
(Ohne eigenen SMTP verschickt Supabase nur sehr wenige Mails pro Stunde.)

### 4. Erreichbarkeit der App freischalten
- Supabase → Authentication → URL Configuration: Site URL `https://praxisverwaltung.vercel.app`, Redirect URL `https://*-joas-frese.vercel.app/**`.
- Vercel → Settings → Deployment Protection → Vercel Authentication auf **„Standard Protection“** (nur Vorschauen geschützt). Sonst können Patienten-Links, der Aufruf-Bildschirm und der automatische Versand die Produktions-App nicht erreichen.
- Pull Request nach `main` mergen → App geht live.

### 5. Testen
Einstellungen → E-Mail-Versand → „Testmail senden“. Danach einen Testpatienten mit deiner E-Mail anlegen und einen Termin buchen – die Bestätigung kommt spätestens nach 5 Minuten.

# Lastenheft – Praxisverwaltung

> Status: **Entwurf v0.1** · Stand: 17.11.2026
> Offene Punkte sind mit **❓ F-xx** markiert und verweisen auf den [Fragebogen](./Fragebogen.md).

---

## 1. Zielsetzung

Eine Web-App, mit der Praxismitarbeiter **schnell, übersichtlich und personalisiert** Termine planen, Personal und Patienten zuordnen, auf Störungen (Verspätung, Ausfall, Absage) reagieren und alle Beteiligten benachrichtigen können. Jeder Termin wird vollständig dokumentiert und fließt automatisch in die Patientenakte ein.

## 2. Ausgangslage / bereits Bekanntes

| # | Anforderung (aus Auftrag) | Umsetzung im Konzept |
|---|---|---|
| 1 | Patient und Arzt jeweils eigene Entität, einander zuordenbar | Tabellen `patients`, `staff` (Ärzte + Mitarbeiter), Zuordnung über `care_assignments` (n:m) und über Termine |
| 2 | Terminplanung, direkte Kommunikation, Änderungen vermitteln & benachrichtigen | Terminmodul, Nachrichtenmodul (Threads), Benachrichtigungs-Engine (In-App, ❓E-Mail/SMS/Push) |
| 3 | Alle Termine mit Zeitraum, Ort, Grund, Aufwand, Personenbezug, Protokoll | Entität `appointments` mit genau diesen Feldern + Protokoll-Einträgen |
| 4 | Patientenakte wird aus Terminen gefüttert/aktualisiert | Abgeschlossene Termine erzeugen automatisch Akteneinträge (Timeline) |
| 5 | Umgang mit Verzögerung, Ausfall, Ersatzpersonal, Terminabsage | Störungs-Workflows: Verspätung melden → Folgetermine verschieben; Ausfall → Ersatz vorschlagen; Absage → Warteliste nachrücken |
| 6 | Schnell, übersichtlich, personalisiert | Rollenbasiertes Dashboard („Mein Tag“), Kalender-Ansichten, Schnellaktionen, Echtzeit-Updates |
| 7 | Automatisch mit Vercel, GitHub, Supabase verbunden | GitHub-Repo → Vercel Auto-Deploy (Preview je Branch, Production auf `main`); Supabase für DB/Auth/Realtime/Storage, Migrationen versioniert im Repo |

## 3. Technische Architektur (Vorschlag)

| Schicht | Technologie | Begründung |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui | Schnell, gut mit Vercel integriert, responsive (Desktop + Tablet + Handy) |
| Backend | Next.js Server Actions / Route Handlers + Supabase Edge Functions | Kein separater Server nötig |
| Datenbank | Supabase Postgres mit Row Level Security (RLS) | Feingranulare Zugriffsrechte direkt in der DB |
| Auth | Supabase Auth (E-Mail/Passwort, Magic Link, ❓2FA) | Rollen: Admin, Arzt, MFA/Empfang, ❓Patient |
| Echtzeit | Supabase Realtime | Live-Updates im Kalender/Wartezimmer bei Verspätung/Absage |
| Dateien | Supabase Storage (privat, signierte URLs) | Befunde, Dokumente zum Termin |
| Benachrichtigung | In-App + ❓E-Mail (z. B. Resend) + ❓SMS (z. B. Twilio/seven.io) + ❓Web-Push | |
| Hosting | Vercel (Region Frankfurt `fra1`) + Supabase (Region EU/Frankfurt) | DSGVO: Daten in der EU |
| CI/CD | GitHub → Vercel (Preview je PR, Prod auf `main`), Supabase-Migrationen via GitHub Action | „automatisch updaten“ |

## 4. Rollen & Berechtigungen (Entwurf)

| Rolle | Darf |
|---|---|
| **Admin / Praxisinhaber** | Alles, inkl. Benutzer, Räume, Öffnungszeiten, Leistungskatalog |
| **Arzt / Therapeut** | Eigene + zugeordnete Patienten, eigene Termine, Protokolle schreiben, Akte lesen/schreiben |
| **MFA / Empfang** | Alle Termine planen/ändern, Patienten anlegen, Stammdaten; Akte ❓ nur eingeschränkt |
| **Patient** ❓F-04 | Eigene Termine sehen, buchen/absagen, Nachrichten an Praxis |

## 5. Datenmodell (Entwurf)

```
practices         – Praxis (❓ Mandantenfähig: mehrere Praxen/Standorte, F-02)
locations/rooms   – Ort: Standort, Raum, Gerät
staff             – Arzt/MFA/Therapeut: Name, Rolle, Fachrichtung, Qualifikationen, Arbeitszeiten, Farbe
staff_absences    – Urlaub, Krankheit, Fortbildung (Basis für Ausfall-Logik)
patients          – Stammdaten, Kontakt, Versicherung, Notfallkontakt, Kommunikationspräferenz
care_assignments  – Patient ↔ Arzt (Hauptbehandler, Vertretung)
appointment_types – Grund/Leistung: Standarddauer, benötigte Qualifikation, Raumtyp, Aufwand
appointments      – Zeitraum (Start/Ende), Ort/Raum, Grund, Aufwand (geplant/tatsächlich, ❓Punkte/€),
                    Patient, Arzt, weitere Beteiligte, Status, Serien-ID
appointment_participants – weitere Personen (Assistenz, Dolmetscher, Angehörige)
appointment_protocol     – Protokoll/Verlauf: Notizen, Befund, Maßnahmen; jede Änderung mit Zeitstempel & Autor
appointment_events       – Änderungshistorie: verschoben, verspätet, abgesagt, Ersatz zugewiesen …
patient_record_entries   – Patientenakte (Timeline), automatisch aus abgeschlossenen Terminen erzeugt
waitlist          – Warteliste für frei werdende Termine
messages / threads – direkte Kommunikation (Mitarbeiter↔Mitarbeiter, ❓Praxis↔Patient)
notifications     – Benachrichtigungen pro Empfänger + Kanal + Zustellstatus
audit_log         – Wer hat wann was gesehen/geändert (Pflicht bei Gesundheitsdaten)
```

**Termin-Status:** `geplant → bestätigt → eingecheckt (Wartezimmer) → in Behandlung → abgeschlossen`
Nebenpfade: `verspätet`, `verschoben`, `abgesagt (Patient/Praxis)`, `nicht erschienen (No-Show)`.

## 6. Funktionale Anforderungen

### 6.1 Stammdaten
- FA-01 Patienten anlegen/bearbeiten/suchen (Name, Geburtsdatum, Versichertennr. …)
- FA-02 Personal anlegen inkl. Rolle, Qualifikation, Arbeitszeiten, Abwesenheiten
- FA-03 Patient ↔ Arzt zuordnen (Hauptbehandler + Vertretung)
- FA-04 Räume, Geräte, Leistungs-/Termintypen pflegen

### 6.2 Terminplanung
- FA-10 Kalender: Tag/Woche/Monat, pro Arzt, pro Raum, Gesamtpraxis
- FA-11 Termin anlegen mit Zeitraum, Ort, Grund, Aufwand, Personen; Drag & Drop
- FA-12 Konfliktprüfung (Doppelbuchung Arzt/Raum/Patient, Abwesenheit, Öffnungszeiten)
- FA-13 Freie-Slot-Suche („nächster freier Termin bei Dr. X für Leistung Y“)
- FA-14 Serientermine (z. B. 10× Physiotherapie wöchentlich)
- FA-15 ❓ Online-Buchung durch Patienten (F-04)

### 6.3 Störungsmanagement (Kernfunktion)
- FA-20 **Verzögerung:** Arzt/MFA meldet „+20 min“ → betroffene Folgetermine werden markiert, Patienten werden automatisch informiert, Wartezimmeranzeige aktualisiert
- FA-21 **Personalausfall:** Abwesenheit eintragen → alle betroffenen Termine werden gelistet → System schlägt Ersatzpersonal vor (gleiche Qualifikation, frei, ❓Patient bekannt) → MFA bestätigt mit einem Klick → Patienten werden informiert
- FA-22 **Terminabsage (Patient/Praxis):** Slot wird frei → Warteliste-Kandidaten werden vorgeschlagen/angefragt → erster Bestätigender bekommt Termin
- FA-23 **No-Show:** markieren, zählen, ❓ Regel (z. B. nach 3× Hinweis)
- FA-24 Alle Störungen landen in `appointment_events` (lückenlose Historie)

### 6.4 Kommunikation & Benachrichtigung
- FA-30 Interne Nachrichten (1:1, Gruppen, am Termin/Patient angeheftet)
- FA-31 Automatische Benachrichtigungen: neu, geändert, verschoben, verspätet, abgesagt, Erinnerung (❓ 24 h / 2 h vorher)
- FA-32 Kanäle: In-App (immer), ❓ E-Mail, ❓ SMS, ❓ Push, ❓ WhatsApp (F-10)
- FA-33 Vorlagen für Nachrichtentexte, pflegbar durch Admin
- FA-34 Patient kann per Link bestätigen/absagen (❓)

### 6.5 Dokumentation & Patientenakte
- FA-40 Protokoll pro Termin (Freitext + ❓ strukturierte Felder/Vorlagen je Termintyp)
- FA-41 Beim Abschluss eines Termins wird automatisch ein Akteneintrag erzeugt (Datum, Arzt, Grund, Aufwand, Protokoll, Anhänge)
- FA-42 Patientenakte als chronologische Timeline mit Filter
- FA-43 Dateianhänge (PDF, Bilder)
- FA-44 Einträge sind nach Abschluss nur noch per Nachtrag änderbar (Revisionssicherheit)

### 6.6 Personalisierung & Übersicht
- FA-50 „Mein Tag“-Dashboard je Benutzer (eigene Termine, Wartezimmer, offene Aufgaben, Störungen)
- FA-51 Schnellaktionen (Check-in, „verspätet“, „Ersatz finden“, „nächster Patient“)
- FA-52 Globale Suche (Patient, Termin, Arzt)
- FA-53 Eigene Ansichten/Filter speichern
- FA-54 ❓ Statistiken (Auslastung, No-Show-Quote, Wartezeiten) (F-15)

## 7. Nicht-funktionale Anforderungen
- NFA-01 **Datenschutz/DSGVO (Art. 9 – Gesundheitsdaten):** EU-Hosting, AV-Verträge mit Vercel & Supabase, Verschlüsselung in Transit/at Rest, RLS, Audit-Log, Löschkonzept (❓ Aufbewahrung 10 Jahre gem. § 630f BGB)
- NFA-02 **Schweigepflicht (§ 203 StGB):** Zugriff nur nach Rolle/Zuordnung
- NFA-03 Sicherheit: ❓ 2-Faktor-Auth, Session-Timeout, Passwort-Richtlinie
- NFA-04 Performance: Kalenderansicht < 1 s; Echtzeit-Updates < 2 s
- NFA-05 Responsive: Desktop (Empfang), Tablet (Behandlungsraum), Smartphone
- NFA-06 Sprache: Deutsch (❓ weitere)
- NFA-07 Barrierefreiheit: WCAG 2.1 AA angestrebt
- NFA-08 Verfügbarkeit / Backups: Supabase Point-in-Time-Recovery (❓ Tarif)

## 8. Abgrenzung (vorerst NICHT enthalten – bitte bestätigen, F-20)
- Abrechnung mit KV (EBM/GOÄ), Kassenabrechnung
- Anbindung Telematikinfrastruktur (eGK-Einlesen, ePA, E-Rezept, KIM) – dafür ist eine zertifizierte PVS nötig
- Ersatz einer bestehenden zertifizierten Praxisverwaltungssoftware

> ⚠️ Hinweis: Diese App ist als **Organisations- und Planungswerkzeug** konzipiert. Wird sie als vollwertige medizinische Dokumentation genutzt, gelten erhöhte Anforderungen (Revisionssicherheit, ggf. Medizinprodukte-Einstufung, TI-Pflichten). Das klären wir über F-20/F-21.

## 9. Projektphasen (Vorschlag)

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 – Setup** | Repo-Struktur, Next.js, Supabase-Projekt, Vercel-Projekt, CI/CD, Auth | Leere App läuft live auf Vercel |
| **1 – MVP** | Stammdaten, Zuordnung, Kalender, Termine inkl. aller Felder, Protokoll, Patientenakte-Timeline, Rollen | Praxis kann planen & dokumentieren |
| **2 – Störungen** | Verspätung, Ausfall + Ersatzvorschlag, Absage + Warteliste, Historie, Echtzeit | Kernnutzen „schnell reagieren“ |
| **3 – Kommunikation** | Interne Nachrichten, Benachrichtigungen (In-App + E-Mail/SMS), Erinnerungen | Automatische Information aller Beteiligten |
| **4 – Ausbau** | Patientenportal, Statistiken, Vorlagen, Import, Feinschliff | Nach Fragebogen-Antworten |

## 10. Abnahmekriterien (Beispiele)
- Ein Termin kann mit allen Pflichtfeldern in < 30 s angelegt werden.
- Bei Ausfall eines Arztes werden alle betroffenen Termine angezeigt und können mit ≤ 2 Klicks je Termin umgeplant werden.
- Ein abgeschlossener Termin erscheint automatisch in der Akte des Patienten.
- Push auf `main` → automatisch neue Version auf Vercel; DB-Migrationen werden mitgezogen.

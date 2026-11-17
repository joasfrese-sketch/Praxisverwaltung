# Fragebogen – Praxisverwaltung

**So geht's:** Kreuze an (`[x]`) oder schreibe deine Antwort hinter **→**. Unklares einfach leer lassen oder „egal / du entscheidest“ schreiben – dann nehme ich den markierten ⭐ Vorschlag.
Du kannst mir die Antworten auch einfach als Nachricht schicken (z. B. „F-01: Allgemeinmedizin, 3 Ärzte …“).

---

## A. Praxis & Organisation

**F-01 Welche Art Praxis?** (Fachrichtung, z. B. Allgemeinmedizin, Zahnarzt, Physiotherapie, Psychotherapie, MVZ)
→

**F-02 Größe & Struktur**
- Anzahl Ärzte/Therapeuten: →
- Anzahl MFA / Empfang / sonstiges Personal: →
- Anzahl Behandlungsräume: →
- Ein Standort oder mehrere? [ ] einer ⭐ [ ] mehrere: →
- Soll die App später an **andere Praxen** verkauft/vermietet werden (Mandantenfähigkeit)? [ ] nein ⭐ [ ] ja [ ] vielleicht

**F-03 Wird bereits eine Praxissoftware (PVS) genutzt?** (z. B. CGM, Medatixx, Doctolib, Samedi, T2med)
- [ ] keine → unsere App ist das Hauptsystem
- [ ] ja, welche: → … und unsere App soll [ ] diese ergänzen ⭐ [ ] diese ersetzen
- Daten-Import aus Altsystem nötig? [ ] nein [ ] ja, Format (CSV/Excel/…): →

## B. Nutzer & Rollen

**F-04 Wer nutzt die App?**
- [x] Ärzte / Therapeuten
- [x] MFA / Empfang
- [ ] Praxisinhaber / Admin (separat)
- [ ] **Patienten selbst** (eigenes Portal: Termine sehen/buchen/absagen, Nachrichten) – [ ] jetzt [ ] später ⭐ [ ] nie
- [ ] Externe (Labore, Überweiser, Angehörige): →

**F-05 Darf jede MFA alle Patientenakten (Protokolle) lesen?**
- [ ] ja, alle
- [ ] nur Termine/Stammdaten, keine medizinischen Inhalte ⭐
- [ ] individuell pro Mitarbeiter einstellbar

**F-06 Darf ein Arzt Patienten anderer Ärzte sehen?**
- [ ] ja, alle ⭐ (üblich in Gemeinschaftspraxis)  [ ] nur eigene/zugeordnete  [ ] nur bei Vertretung

**F-07 Anmeldung / Sicherheit**
- [ ] E-Mail + Passwort ⭐  [ ] Magic Link per E-Mail  [ ] Google/Microsoft-Login
- Zwei-Faktor-Authentifizierung: [ ] Pflicht ⭐ [ ] optional [ ] nein
- Gemeinsam genutzte PCs am Empfang (schneller Benutzerwechsel / PIN)? [ ] ja [ ] nein

## C. Termine

**F-08 Termin-Details** – was gehört konkret dazu?
- **Grund:** freie Eingabe oder feste Liste (Leistungskatalog)? [ ] beides ⭐ [ ] nur Liste [ ] nur frei
  Beispiele für eure häufigsten Termintypen + übliche Dauer: →
- **Aufwand** bedeutet für dich: [ ] Dauer (geplant/tatsächlich) [ ] Abrechnungsziffern/Punkte [ ] Kosten in € [ ] Materialverbrauch [ ] Schwierigkeitsgrad →
- **Ort:** [ ] Raum [ ] Standort [ ] Hausbesuch/Adresse [ ] Videosprechstunde
- **Personenbezug:** Neben Patient + Arzt auch: [ ] Assistenz/MFA [ ] Dolmetscher [ ] Angehörige [ ] mehrere Patienten (Gruppentermin)
- **Protokoll:** [ ] Freitext ⭐ [ ] strukturierte Vorlagen je Termintyp [ ] Diktat/Spracheingabe [ ] Dateianhänge

**F-09 Terminregeln**
- Öffnungszeiten / Sprechzeiten: →
- Standard-Raster: [ ] 5 min [ ] 10 min [ ] 15 min ⭐ [ ] frei
- Pufferzeiten zwischen Terminen? →
- Akut-/Notfallslots freihalten? [ ] ja, wie viele: → [ ] nein
- Serientermine nötig? [ ] ja [ ] nein
- Wartezimmer-Ansicht / Check-in am Empfang? [ ] ja ⭐ [ ] nein
- Wartezimmer-Bildschirm für Patienten (Aufruf-Anzeige)? [ ] ja [ ] nein

## D. Kommunikation & Benachrichtigungen

**F-10 Über welche Kanäle soll benachrichtigt werden?**

| Empfänger | In-App | E-Mail | SMS | Push (Handy) | WhatsApp |
|---|---|---|---|---|---|
| Personal | [x] | [ ] | [ ] | [ ] | [ ] |
| Patienten | [ ] | [ ] | [ ] | [ ] | [ ] |

Hinweis: SMS kostet ca. 6–9 ct/Nachricht; WhatsApp ist datenschutzrechtlich heikel.

**F-11 Wann sollen Patienten informiert werden?**
- [ ] Terminbestätigung bei Buchung
- [ ] Erinnerung: [ ] 24 h vorher [ ] 2 h vorher [ ] anders: →
- [ ] bei Verschiebung/Absage durch Praxis
- [ ] bei Verspätung ab: → Minuten (Vorschlag ⭐ 15 min)
- [ ] Patient darf per Link bestätigen/absagen

**F-12 Interne Kommunikation**
- Chat zwischen Mitarbeitern? [ ] ja ⭐ [ ] nein
- Nachrichten an Termin/Patient anheften? [ ] ja ⭐ [ ] nein
- Aufgaben/To-dos (z. B. „Befund anfordern“)? [ ] ja [ ] nein

## E. Störungsmanagement

**F-13 Verzögerung**
- Wer meldet eine Verspätung? [ ] Arzt [ ] MFA [ ] System automatisch (wenn Termin überzogen)
- Sollen Folgetermine automatisch verschoben werden oder nur markiert + Vorschlag? [ ] automatisch [ ] Vorschlag + Bestätigung ⭐

**F-14 Ausfall & Ersatz**
- Bei Ausfall eines Arztes: Ersatz nach welchen Kriterien? (reihen: 1 = wichtigstes)
  [ ] gleiche Qualifikation/Fachrichtung [ ] kennt den Patienten [ ] gleicher Standort [ ] gleichmäßige Auslastung
- Muss der Patient einem Arztwechsel zustimmen? [ ] ja [ ] nein, nur informieren ⭐
- Gibt es feste Vertretungsregeln (Arzt A vertritt B)? →
- Wer darf Abwesenheiten eintragen? [ ] jeder selbst [ ] nur Admin [ ] Admin + MFA ⭐

**F-15 Absage & Warteliste**
- Warteliste gewünscht? [ ] ja ⭐ [ ] nein
- Bei frei werdendem Termin: [ ] MFA wählt manuell aus Vorschlägen ⭐ [ ] System fragt automatisch nacheinander an
- Absagefrist für Patienten (z. B. 24 h)? →
- No-Shows zählen / Regel? →

## F. Patientenakte & Auswertung

**F-16 Was soll in der Patientenakte stehen außer Terminen?**
[ ] Diagnosen [ ] Medikation [ ] Allergien/Warnhinweise [ ] Dokumente/Befunde [ ] Versicherungsdaten [ ] Notfallkontakt [ ] sonstiges: →

**F-17 Statistiken gewünscht?** [ ] Auslastung je Arzt/Raum [ ] No-Show-Quote [ ] Wartezeiten [ ] Umsatz/Aufwand [ ] später ⭐

## G. Technik, Betrieb, Recht

**F-18 Accounts & Zugänge** – ich sehe bereits Verbindungen zu GitHub, Vercel und Supabase.
- Supabase: [ ] neues Projekt anlegen ⭐ (Region Frankfurt) [ ] bestehendes nutzen: →
  Supabase-Tarif: [ ] Free (zum Testen) ⭐ [ ] Pro (25 $/Monat, Backups – für Echtbetrieb nötig)
- Vercel: [ ] neues Projekt anlegen ⭐ [ ] bestehendes: →
- Eigene Domain? [ ] ja: → [ ] später ⭐
- E-Mail-Versand-Dienst (für Benachrichtigungen): [ ] Resend ⭐ [ ] eigener SMTP [ ] egal
- SMS-Anbieter: [ ] seven.io (DE) [ ] Twilio [ ] keine SMS

**F-19 Geräte:** [ ] PC am Empfang [ ] Tablet im Behandlungsraum [ ] Smartphone der Ärzte [ ] als installierbare App (PWA)

**F-20 Abgrenzung bestätigen** – folgendes ist NICHT Teil des Projekts:
- [ ] KV-/Privatabrechnung  [ ] Telematikinfrastruktur (eGK, ePA, E-Rezept, KIM)  [ ] Ersatz einer zertifizierten PVS
→ einverstanden? [ ] ja [ ] nein, Folgendes doch: →

**F-21 Echte Patientendaten** – ab wann?
- [ ] erst nur Testdaten/Demo ⭐ [ ] direkt Echtbetrieb
- AV-Verträge (DSGVO) mit Vercel/Supabase kümmerst du dich / Datenschutzbeauftragter vorhanden? →
- Aufbewahrungsfrist der Dokumentation: [ ] 10 Jahre (gesetzl. Standard) ⭐ [ ] anders: →

## H. Design & Sonstiges

**F-22 Design:** Praxis-Logo / Farben vorhanden? → (gern Datei hochladen) [ ] du entscheidest ⭐
**F-23 Sprachen der Oberfläche:** [ ] nur Deutsch ⭐ [ ] zusätzlich: →
**F-24 Priorität:** Was ist dir für die erste Version am wichtigsten? (Top 3) →
**F-25 Zeitrahmen / Deadline?** →
**F-26 Sonstige Wünsche, Abläufe, Ärgernisse aus dem Praxisalltag, die die App lösen soll:**
→

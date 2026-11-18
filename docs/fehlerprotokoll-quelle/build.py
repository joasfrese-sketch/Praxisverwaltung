#!/usr/bin/env python3
"""Erzeugt das Fehlerprotokoll (HTML) für die Lehrkraft.

Aufruf:  python3 build.py            -> schreibt index.html und cover.html
PDF:     siehe render.js (Chromium) – Deckblatt und Inhalt getrennt, danach pdfunite.
Alle Zahlen im Dokument werden aus der Liste CASES berechnet.
"""
import html
from pathlib import Path

HERE = Path(__file__).parent

# ----------------------------------------------------------------------------
# Kategorien, Status, Entdeckt-durch
# ----------------------------------------------------------------------------
CATS = {
    "K1": ("Einstellung", "#d97706", "Etwas war falsch eingestellt oder am falschen Ort eingetragen."),
    "K2": ("Wissenslücke", "#2563eb", "Eine neue Technik oder Version funktioniert anders, als wir dachten."),
    "K3": ("Denkfehler (Logik)", "#7c3aed", "Der Ablauf im Programm war nicht zu Ende gedacht."),
    "K4": ("Vorgehen", "#0d9488", "Fehler in der Arbeitsweise, z. B. zu früh „fertig“ gemeldet."),
    "K5": ("Sicherheit", "#dc2626", "Geheimes (Passwörter, Schlüssel) wurde nicht sicher behandelt."),
    "K6": ("Grenzen des Systems", "#64748b", "Schutzregeln und Limits der benutzten Dienste."),
}
STATUS = {
    "ok": ("gelöst", "#15803d", "Fehler behoben und danach erneut getestet."),
    "avoid": ("vermieden", "#0369a1", "Fehler ist gar nicht erst aufgetreten, weil wir vorher nachgelesen haben."),
    "work": ("umgangen", "#b45309", "Ursache bleibt bestehen, wir haben einen anderen Weg gefunden."),
    "open": ("offen", "#b91c1c", "Noch zu erledigen (siehe Abschnitt „Offene Punkte“)."),
}
FOUND = {
    "sys": ("System", "Das System hat selbst eine Fehlermeldung ausgegeben (Build, Test, Datenbank)."),
    "team": ("Team", "Wir haben es beim Ausprobieren der laufenden App bzw. der Webseiten bemerkt."),
    "ki": ("KI", "Die KI hat es durch eigene Prüfung, Dokumentation oder Rückblick entdeckt."),
}
IMPACT = {1: "klein", 2: "mittel", 3: "groß"}

# ----------------------------------------------------------------------------
# Fehlerfälle (chronologisch)
# fig = Liste von (Datei, Beschriftung)
# ----------------------------------------------------------------------------
CASES = [
    dict(id=1, title="Fast gescheitert, aber vorher nachgelesen: Next.js 16 ist anders", cat="K2", status="avoid", found="ki", impact=1,
         passiert="Für die App nutzen wir das Framework Next.js in der neuen Version 16. Die KI kennt vor allem ältere Versionen. Eine wichtige Datei heißt in Version 16 zum Beispiel nicht mehr <code>middleware.ts</code>, sondern <code>proxy.ts</code>.",
         meldung="This is NOT the Next.js you know. This version has breaking changes … Read the relevant guide in node_modules/next/dist/docs/",
         ursache="Das Wissen der KI stammt teilweise aus älteren Versionen. Frameworks ändern sich schneller als das Wissen, das man im Kopf hat.",
         loesung="Bevor programmiert wurde, wurde die mitgelieferte Dokumentation gelesen. Danach haben wir <code>proxy.ts</code> und die neuen Seiten-Typen verwendet.",
         gelernt="Fehler vermeiden ist besser als Fehler beheben: Bei neuen Versionen zuerst die passende Dokumentation lesen."),
    dict(id=2, title="Selbst gebaute Design-Klassen funktionierten nicht (Tailwind 4)", cat="K2", status="ok", found="sys", impact=2,
         passiert="Das Erzeugen der App brach ab. Alle unsere Buttons, Karten und Eingabefelder (<code>.btn</code>, <code>.card</code>, <code>.input</code>) wurden nicht erkannt.",
         meldung="Error: Cannot apply unknown utility class `btn`",
         ursache="In Tailwind CSS 4 müssen eigene Klassen anders definiert werden als in Version 3. Wir haben noch die alte Schreibweise benutzt.",
         loesung="Alle eigenen Klassen in <code>globals.css</code> auf die neue Schreibweise <code>@utility</code> umgestellt. Danach lief der Build durch.",
         gelernt="Die Fehlermeldung nennt oft schon die genaue Stelle. Genau lesen spart Suchzeit."),
    dict(id=3, title="TypeScript meldete viele Typfehler bei den Seiten", cat="K2", status="ok", found="sys", impact=1,
         passiert="Der Typ-Check meldete bei fast jeder Seite einen Fehler.",
         meldung="Type '\"/aufgaben\"' does not satisfy the constraint '\"/\"'",
         ursache="Die Typen für die Seiten-Adressen werden von Next.js automatisch erzeugt. Diese Dateien waren veraltet bzw. noch nicht vorhanden – der Fehler lag nicht in unserem Code.",
         loesung="Zwischenordner <code>.next</code> gelöscht und den Befehl <code>next typegen</code> ausgeführt. Einen echten Typfehler (<code>undefined</code> statt Text) haben wir zusätzlich von Hand korrigiert.",
         gelernt="Nicht jeder Fehler steckt im eigenen Code. Manchmal sind automatisch erzeugte Dateien veraltet: neu erzeugen."),
    dict(id=4, title="Der Code-Prüfer (ESLint) fand 14 Verstöße", cat="K2", status="ok", found="sys", impact=1,
         passiert="Ein automatischer Code-Prüfer meldete 14 Probleme in drei Arten.",
         meldung="Components created during render · setState synchronously within an effect · Do not use an <a> element to navigate",
         ursache="Wir hatten kleine Bausteine <i>innerhalb</i> anderer Bausteine definiert (sie werden dadurch bei jeder Anzeige neu gebaut), einen Wert direkt in einem Effekt gesetzt und normale Links statt der App-Links benutzt.",
         loesung="Bausteine nach außen verlagert, den Effekt begründet freigestellt und <code>&lt;Link&gt;</code> verwendet.",
         gelernt="Ein Code-Prüfer ist wie ein Korrekturleser: Er findet Muster, die später zu echten Fehlern führen."),
    dict(id=5, title="Der erste Datenbank-Test scheiterte am Test selbst", cat="K1", status="ok", found="sys", impact=1,
         passiert="Beim Prüfen der Datenbank-Dateien in einer lokalen Test-Datenbank brach der Test ab.",
         meldung="error: permission denied for table staff",
         ursache="Nicht die Datenbank-Dateien waren falsch, sondern unser <i>Testaufbau</i>: Ihm fehlten Standard-Rechte, die das echte Supabase automatisch hat.",
         loesung="Die fehlenden Rechte im Test ergänzt. Danach liefen dieselben Dateien sowohl im Test als auch im echten Supabase-Projekt. Der Test prüfte u. a.: Eine fremde Praxis sieht keine Patienten.",
         gelernt="Wenn ein Test scheitert, zuerst fragen: Ist der <i>Test</i> falsch oder das <i>Programm</i>?"),
    dict(id=6, title="Das Supabase-Projekt „Praxisverwaltung“ war nicht zu finden", cat="K1", status="ok", found="ki", impact=1,
         passiert="Die Datenbank sollte in einem Supabase-Projekt „Praxisverwaltung“ liegen. Die Abfrage der Projekte zeigte aber nur ein anderes Projekt.",
         meldung="Projekte: [ Lagerverwaltung-MBG ]",
         ursache="Das neue Projekt war zu diesem Zeitpunkt noch nicht angelegt bzw. noch nicht mit dem Werkzeug verbunden.",
         loesung="Nach dem Anlegen die Liste erneut abgefragt: jetzt erschien „Praxisverwaltung“ (Region Irland, also in der EU). Bevor etwas gespeichert wurde, prüften wir, dass das Projekt wirklich leer ist.",
         gelernt="Immer zuerst prüfen, ob man im <i>richtigen</i> Projekt arbeitet – sonst landen Tabellen und Daten im falschen System."),
    dict(id=7, title="Die KI darf sich selbst keine Dauer-Rechte geben", cat="K6", status="work", found="sys", impact=1,
         passiert="Bei jeder Aktion in Supabase und Vercel fragte das System: „Darf Claude … verwenden?“. Wir wollten das abschalten. Die KI versuchte, selbst eine Einstellungsdatei mit Freigaben ins Projekt zu legen – das wurde automatisch blockiert.",
         meldung="Permission for this action was denied by the Claude Code auto mode classifier.",
         ursache="Das ist eine gewollte Schutzregel: Eine KI darf ihre eigenen Berechtigungen nicht selbst erweitern.",
         loesung="Die Datei wurde wieder entfernt. Dauerhafte Freigaben stellt der Mensch selbst im Menü neben dem Eingabefeld ein.",
         gelernt="Berechtigungen gehören dem Menschen. Eine Sperre kann ein Schutz sein und kein Fehler."),
    dict(id=8, title="Wir kommen nicht überall heran: gesperrtes Netz, unsichtbare Geheimnisse", cat="K6", status="work", found="sys", impact=1,
         passiert="Ein lokaler Test gegen die echte Datenbank scheiterte. Außerdem konnte man geheime Einstellungen (z. B. Passwörter) in Vercel nicht auslesen.",
         meldung="…supabase.co:443 – connect_rejected (the egress proxy refused the connection)",
         ursache="Die Entwicklungsumgebung darf nur freigegebene Server erreichen. Geheime Variablen zeigen aus Sicherheitsgründen keinen Wert an, auch nicht dem Besitzer.",
         loesung="Statt lokal zu testen haben wir die veröffentlichte Seite geprüft und die Datenbank über ein freigegebenes Werkzeug getestet. Ob ein Passwort stimmt, zeigt nur ein echter Versuch.",
         gelernt="Ist der direkte Weg gesperrt, einen anderen Weg zum gleichen Ziel suchen – die Sperre nie umgehen."),
    dict(id=9, title="Die Webseite war nicht erreichbar: „Build Failed“ und 404", cat="K2", status="ok", found="team", impact=3,
         passiert="Beim ersten Veröffentlichen zeigte Vercel einen roten Fehler, die Adresse lieferte „404 – diese Seite existiert nicht“. Wir klickten mehrmals auf <b>Redeploy</b> – es blieb gleich.",
         meldung="Error: [NEXT_NO_VERSION] No Next.js version detected   ·   404: NOT_FOUND",
         ursache="Auf dem Hauptzweig <code>main</code> lagen zu diesem Zeitpunkt nur Lastenheft und Fragebogen, <b>noch kein Programmcode</b>. „Redeploy“ baut immer den <i>alten</i> Stand noch einmal. Dazu war im Vercel-Projekt noch kein Framework eingestellt. Die Vorschau-Adresse zeigte kurz auf den alten Build und lieferte deshalb auch 404.",
         loesung="Vercel auf Next.js, Node 24 und Region Frankfurt eingestellt und den Pull Request mit dem Programmcode nach <code>main</code> zusammengeführt (Merge). Danach baute Vercel automatisch neu – fehlerfrei. Die Registrierungsseite war erreichbar.",
         gelernt="„Redeploy“ ändert nichts am Inhalt. Neue Änderungen kommen nur über einen <b>neuen Commit auf <code>main</code></b>. Und: Manchmal genügt Abwarten, bis der neue Build fertig ist.",
         fig=[("build-failed.png", "Abb. 1 – Vercel: „Build Failed“ (Foto von 19:33 Uhr)"),
              ("build-log.png", "Abb. 2 – Build-Protokoll: Fehler NEXT_NO_VERSION"),
              ("redeploy-liste.png", "Abb. 3 – Mehrfaches „Redeploy“ desselben alten Stands"),
              ("404.png", "Abb. 4 – Ergebnis im Browser: 404")]),
    dict(id=10, title="SMTP-Einstellungen im falschen Supabase-Projekt", cat="K1", status="ok", found="ki", impact=2,
         passiert="Auf dem Foto der E-Mail-Einstellungen stand oben links „Lagerverwaltung-MBG“ statt „Praxisverwaltung“.",
         ursache="Zwei Supabase-Projekte lagen im selben Konto nebeneinander und wurden verwechselt. Die Einstellung hätte sonst dazu geführt, dass die <i>Lager-App</i> ihre Login-Mails als „Praxis Verwaltung“ verschickt.",
         loesung="Einstellungen im richtigen Projekt gemacht und im falschen den benutzerdefinierten E-Mail-Versand wieder ausgeschaltet.",
         gelernt="Vor jeder Einstellung oben links prüfen, in welchem Projekt man ist. Ein Foto der Seite ist ein guter Beweis.",
         fig=[("falsches-projekt.png", "Abb. 5 – Adresszeile und Projektname zeigen „Lagerverwaltung-MBG“ (E-Mail-Adresse geschwärzt)")]),
    dict(id=11, title="E-Mail über Gmail: Fehler 535 – „Passwort nicht akzeptiert“", cat="K2", status="open", found="team", impact=3,
         passiert="Beim Registrieren erschien „Error sending confirmation email“. Es kam keine Bestätigungs-Mail an – bei mehreren Versuchen.",
         meldung="535 5.7.8 Username and Password not accepted",
         ursache="Eingetragen war das <i>normale</i> Gmail-Passwort. Google erlaubt für Programme nur ein spezielles <b>App-Passwort</b>, und das gibt es erst mit „Bestätigung in zwei Schritten“ – meist mit Telefonnummer. Wir wollten das Konto nicht mit einer Telefonnummer verknüpfen. Die genaue Ursache stand im Protokoll von Supabase, nicht auf der Webseite.",
         loesung="Gmail aufgegeben. Alternativen verglichen (Brevo, Mailjet, Resend, eigene Domain). Für den Test die Bestätigungs-Mail abgeschaltet bzw. den eingebauten Versand von Supabase genutzt. <b>Endgültiger Absender steht noch aus.</b>",
         gelernt="Die genaue Ursache steht oft im Protokoll des Systems. Und: Nicht jeder Dienst ist für jeden Zweck gedacht – ein persönliches Gmail-Konto ist kein Server für automatische Mails.",
         fig=[("registrierung-fehler.png", "Abb. 6 – Fehlermeldung beim Registrieren (19:45 Uhr)")]),
    dict(id=12, title="Registrierung bricht ab, und nur 2 Mails pro Stunde", cat="K6", status="work", found="team", impact=2,
         passiert="Solange der Mailversand scheiterte, kam keine Registrierung zustande. Mit dem eingebauten Versand von Supabase gingen nur sehr wenige Mails pro Stunde.",
         meldung="Email limiter: 30 → 2/1h (Supabase-Protokoll, sobald kein eigener SMTP aktiv ist)",
         ursache="Supabase nimmt die ganze Registrierung zurück, wenn die Bestätigungs-Mail nicht rausgeht (es entsteht dann kein Benutzer). Der eingebaute Versand ist absichtlich stark begrenzt (Missbrauchsschutz).",
         loesung="Für die Testphase „Confirm email“ ausschalten, später einen eigenen Absender einrichten.",
         gelernt="Grenzen eines Dienstes vor dem Testen nachlesen."),
    dict(id=13, title="SQL-Fehler beim Befüllen mit Testdaten", cat="K2", status="ok", found="sys", impact=1,
         passiert="Zwei Skripte zum Einfügen der Testdaten brachen ab.",
         meldung="return type mismatch … Final statement returns text instead of uuid   ·   column reference \"status\" is ambiguous",
         ursache="(1) In einer Wertetabelle war nur die erste Zeile als <code>uuid</code> gekennzeichnet – die Datenbank hielt die ganze Spalte für Text. (2) Ein Parameter hieß genauso wie eine Tabellenspalte, die Datenbank wusste nicht, welche gemeint war.",
         loesung="(1) Typen ausdrücklich festgelegt. (2) Parameter umbenannt (<code>p_st</code>). Beide Skripte brachen vollständig ab, es wurde also nichts halb gespeichert.",
         gelernt="Namen eindeutig wählen. Datenbanken führen eine Anweisung ganz oder gar nicht aus (Transaktion)."),
    dict(id=14, title="„Bad Gateway“ – hat das Skript etwas gespeichert?", cat="K6", status="ok", found="sys", impact=2,
         passiert="Ein großes Skript meldete einen Verbindungsabbruch. Niemand wusste, ob schon Daten gespeichert wurden.",
         meldung="The outcome is unknown: the call may have finished, may still be running, or may never have started.",
         ursache="Die Verbindung zwischen den Systemen brach ab, bevor eine Antwort ankam.",
         loesung="Nicht blind wiederholt, sondern mit Zählabfragen geprüft, was angekommen war: nichts vom großen Skript. Danach in drei kleinere Pakete geteilt.",
         gelernt="Bei unklarem Ausgang erst nachsehen, dann wiederholen – sonst entstehen doppelte Daten. Kleine Schritte sind robuster."),
    dict(id=15, title="Logikfehler: Der Verzögerungs-Vorschlag erschien endlos", cat="K3", status="ok", found="team", impact=3, pb=True, figcols=1,
         passiert="Der gelbe Kasten „Verzögerung erkannt“ blieb nach „Verschieben & informieren“ stehen. Mit jedem Klick rutschten die Termine weiter nach hinten – bis 23:30 und 23:55 Uhr.",
         ursache="Die Erkennung prüfte nur: <i>„Überzieht die laufende Behandlung?“</i> Das bleibt wahr, solange die Behandlung läuft. Ob die Folgetermine schon verschoben waren, wurde nie geprüft. Das Programm kannte seinen <b>eigenen Zustand</b> nicht.",
         loesung="Neue Regel: Nur wenn der <i>nächste Termin vor dem frühestmöglichen Freiwerden</i> des Arztes liegt, ist er verspätet. Es werden nur Termine verschoben, die sonst kollidieren würden. Dazu Schutz gegen Doppelklick. Mit fünf Testfällen geprüft, die Testdaten zurückgesetzt.",
         gelernt="Automatiken müssen wissen, was schon erledigt ist. Immer auch den <b>zweiten Durchlauf</b> testen: „Was passiert beim nächsten Klick?“",
         fig=[("verzoegerung-1.png", "Abb. 7 – Vorher: Braun 23:05, Krüger 23:30, Lange 23:55 (Foto 20:56 Uhr)"),
              ("verzoegerung-2.png", "Abb. 8 – Nach Klick: Termine schon später, Kasten trotzdem wieder da"),],
         diagram="loop"),
    dict(id=16, title="Anforderung vergessen: Öffnungszeiten wurden nicht geprüft", cat="K3", status="ok", found="team", impact=2,
         passiert="Wir fragten: „Warum stehen um 21 Uhr noch Termine, obwohl um 18 Uhr geschlossen ist?“",
         ursache="Die Abendtermine waren absichtlich als Live-Testdaten angelegt, damit Verzögerung und Wartezimmer sofort testbar sind. Dabei fiel auf: Die App prüfte zwar Doppelbuchungen und Abwesenheiten, aber <b>nicht die Öffnungszeiten</b>.",
         loesung="Neue Prüfung: „Außerhalb der Öffnungszeiten (an diesem Tag: 08:00–12:00, 14:00–18:00 Uhr)“. Mit „Trotzdem speichern“ bleibt es für Notfälle, Hausbesuche und Abendsprechstunden möglich.",
         gelernt="Testdaten zeigen Lücken in den Anforderungen. Prüfungen sollten warnen und Ausnahmen erlauben, nicht alles verbieten."),
    dict(id=17, title="Zusammenführen scheiterte: Commit-Kennung zu kurz", cat="K2", status="ok", found="sys", impact=1,
         passiert="Der Merge eines Pull Requests wurde abgelehnt.",
         meldung="The sha parameter must be exactly 40 characters and contain only [0-9a-f].",
         ursache="Wir hatten nur die 7-stellige Kurzform der Commit-Kennung angegeben. Für Menschen reicht sie, das Programm verlangt die volle Länge.",
         loesung="Die volle 40-stellige Kennung mit <code>git rev-parse HEAD</code> geholt.",
         gelernt="Kurzformen sind für Menschen. Schnittstellen verlangen oft die vollständige Angabe."),
    dict(id=18, title="Sicherheit: Passwort im Chat, Schlüssel im Protokoll", cat="K5", status="open", found="ki", impact=3,
         passiert="Bei der Fehlersuche wurde das Gmail-Passwort in den Chat geschrieben (hier bewusst nicht abgedruckt). Außerdem wurde ein von der KI erzeugter geheimer Schlüssel für den E-Mail-Versand einmal im Protokoll angezeigt.",
         ursache="Zeitdruck und fehlende Routine: Passwörter gehören nicht in Chats oder Screenshots. Die KI hätte den Schlüssel ohne Anzeige übertragen sollen.",
         loesung="<b>Noch offen:</b> Passwort des Gmail-Kontos ändern, Schlüssel vor dem Echtbetrieb neu erzeugen und austauschen. Künftig Zugangsdaten nur direkt in den Einstellungen der Dienste eintragen.",
         gelernt="Geheimnisse nie in Chats, Screenshots oder Repositories. Wurde eines doch preisgegeben: sofort ändern."),
    dict(id=19, title="Fehler im Vorgehen: zu schnell veröffentlicht, zu früh „fertig“", cat="K4", status="ok", found="ki", impact=2,
         passiert="(a) Pull Requests wurden ohne ausdrückliche Freigabe zusammengeführt und damit direkt veröffentlicht. (b) Ein Test zum Vercel-Schutz benutzte ein Werkzeug, das den Schutz umgehen kann – der Beweis war deshalb ungültig. (c) Die Verzögerungs-Logik wurde als fertig gemeldet, bevor der zweite Klick getestet war.",
         ursache="Zu wenig Abstimmung beim Veröffentlichen und zu wenige Wiederholungs-Tests.",
         loesung="(b) mit einem unabhängigen Test nachgeprüft (Aufruf von außen). Neue Regeln: Zusammenführen nach <code>main</code> nur nach ausdrücklicher Zusage; vor „fertig“ immer auch den Wiederholungsfall testen.",
         gelernt="Ehrlich benennen, was nicht gestimmt hat, gehört zu guter Arbeit."),
]

# ----------------------------------------------------------------------------
# Hilfsfunktionen
# ----------------------------------------------------------------------------
def chip_cat(k):
    n, c, _ = CATS[k]
    return f'<span class="chip" style="background:{c}">{n}</span>'

def chip_status(s):
    n, c, _ = STATUS[s]
    return f'<span class="chip" style="background:{c}">{n}</span>'

def dots(n):
    return '<span class="dots">' + "●" * n + '<span class="off">' + "●" * (3 - n) + "</span></span>"

def count(key, val):
    return sum(1 for c in CASES if c[key] == val)

N = len(CASES)

def bar(label, n, mx, color, sub=""):
    w = 100 * n / mx
    return (f'<div class="bar"><div class="bl">{label}<span class="sub">{sub}</span></div>'
            f'<div class="bt"><div class="bf" style="width:{w:.1f}%;background:{color}"></div></div>'
            f'<div class="bn">{n}</div></div>')

def case_html(c):
    cat = CATS[c["cat"]]
    meldung = f'<div class="msg"><span class="lbl">Fehlermeldung</span><code>{html.escape(c["meldung"])}</code></div>' if c.get("meldung") else ""
    figs = ""
    if c.get("fig"):
        one = " one" if (len(c["fig"]) == 1 or c.get("figcols") == 1) else ""
        figs = f'<div class="figs{one}">' + "".join(
            f'<figure><img src="images/{f}" alt="{html.escape(t)}"><figcaption>{html.escape(t)}</figcaption></figure>' for f, t in c["fig"]) + "</div>"
    diagram = ""
    if c.get("diagram") == "loop":
        diagram = """
<div class="loop">
  <div class="lp bad"><div class="lt">Vorher (Fehler)</div>
    <div class="flow"><span>Klick „Verschieben“</span><i>→</i><span>Termine rücken nach hinten</span><i>→</i><span class="warn">Prüfung: „Überzieht die Behandlung?“ <b>Ja</b> (immer noch)</span><i>→</i><span class="warn">Kasten erscheint wieder</span><i class="back">↺</i></div></div>
  <div class="lp good"><div class="lt">Nachher (behoben)</div>
    <div class="flow"><span>Klick „Verschieben“</span><i>→</i><span>Termine rücken nach hinten</span><i>→</i><span class="ok">Prüfung: „Liegt der nächste Termin noch zu früh?“ <b>Nein</b></span><i>→</i><span class="ok">Kasten verschwindet</span></div></div>
</div>"""
    return f"""
<section class="case{" pbc" if c.get("pb") else ""}" id="F{c['id']}" style="--cc:{cat[1]}">
  <div class="ch">
    <div class="num">F{c['id']}</div>
    <div class="ttl">{c['title']}</div>
  </div>
  <div class="meta">
    {chip_cat(c['cat'])} {chip_status(c['status'])}
    <span class="m">Entdeckt durch: <b>{FOUND[c['found']][0]}</b></span>
    <span class="m">Wirkung: {dots(c['impact'])} <b>{IMPACT[c['impact']]}</b></span>
  </div>
  <div class="blk"><span class="lbl">Was ist passiert?</span>{c['passiert']}</div>
  {meldung}
  <div class="two">
    <div class="blk cause"><span class="lbl">Ursache</span>{c['ursache']}</div>
    <div class="blk fix"><span class="lbl">Lösung / Umgang</span>{c['loesung']}</div>
  </div>
  {diagram}
  {figs}
  <div class="lesson"><span class="lbl">Gelernt</span>{c['gelernt']}</div>
</section>"""

# ----------------------------------------------------------------------------
# Seiten
# ----------------------------------------------------------------------------
n_ok, n_av, n_wk, n_op = count("status", "ok"), count("status", "avoid"), count("status", "work"), count("status", "open")
big = [c for c in CASES if c["impact"] == 3]

cat_bars = "".join(bar(CATS[k][0], count("cat", k), 8, CATS[k][1]) for k in CATS)
found_bars = "".join(bar(FOUND[k][0], count("found", k), 9, "#3f5876") for k in FOUND)
status_bars = "".join(bar(STATUS[k][0], count("status", k), 13, STATUS[k][1]) for k in STATUS)
impact_bars = "".join(bar(IMPACT[i].capitalize(), count("impact", i), 9, "#3f5876") for i in (1, 2, 3))

legend_cat = "".join(f'<div class="lg"><span class="chip" style="background:{c}">{n}</span><div class="ld">{d}</div></div>' for n, c, d in CATS.values())
legend_status = "".join(f'<div class="lg"><span class="chip" style="background:{c}">{n}</span><div class="ld">{d}</div></div>' for n, c, d in STATUS.values())
legend_found = "".join(f'<div class="lg"><span class="chip" style="background:#3f5876">{n}</span><div class="ld">{d}</div></div>' for n, d in FOUND.values())

overview_rows = "".join(
    f'<tr><td class="c-id"><a href="#F{c["id"]}">F{c["id"]}</a></td><td><a href="#F{c["id"]}" class="tl">{c["title"]}</a></td>'
    f'<td>{chip_cat(c["cat"])}</td><td>{chip_status(c["status"])}</td><td>{FOUND[c["found"]][0]}</td><td>{dots(c["impact"])}</td></tr>'
    for c in CASES)

def fchips(ids):
    return " ".join(f'<a href="#F{i}" class="fc" style="background:{CATS[next(c for c in CASES if c["id"] == i)["cat"]][1]}">F{i}</a>' for i in ids)

TIMELINE = [
    ("Planung", "Lastenheft und Fragebogen mit 26 Fragen. Alle Anforderungen sind schriftlich festgehalten.", [], ""),
    ("App-Gerüst bauen", "Webseiten, Kalender, Termine, Patientenakte. Der Build zeigte die ersten Fehler.", [1, 2, 3, 4], ""),
    ("Datenbank entwerfen und testen", "Tabellen, Rechte (RLS), automatische Abläufe. Test in einer lokalen Test-Datenbank.", [5], ""),
    ("Verbindung zu Supabase und Vercel", "Projekt gesucht, Freigaben, Grenzen der Entwicklungsumgebung.", [6, 7, 8], ""),
    ("Erstes Veröffentlichen", "Die Webseite sollte online gehen.", [9], "19:33 Uhr"),
    ("E-Mail einrichten", "Bestätigungs-Mails und Patienten-Benachrichtigungen.", [10, 11, 12], "19:35–19:45 Uhr"),
    ("Testdaten einspielen", "24 Patienten, 53 Termine, Warteliste, Aufgaben.", [13, 14], ""),
    ("Ausprobieren in der laufenden App", "Das Team testet Verzögerung, Wartezimmer, Kalender.", [15, 16], "20:56 Uhr"),
    ("Zusammenführen und Rückblick", "Veröffentlichen nach main, Sicherheit prüfen, Vorgehen bewerten.", [17, 18, 19], ""),
]
def tl_item(i, t, d, ids, tm):
    chips = f'<div class="tl-f">{fchips(ids)}</div>' if ids else ""
    cls = "dot" if ids else "dot none"
    return (f'<div class="tl-item"><div class="{cls}"></div><div class="tl-body">'
            f'<div class="tl-h"><b>{i}. {t}</b> <span class="tm">{tm}</span></div><div class="tl-t">{d}</div>{chips}</div></div>')
timeline_html = "".join(tl_item(i, *row) for i, row in enumerate(TIMELINE, 1))

CYCLE = [
    ("1", "Fehler bemerken", "Meldung, rotes Feld, falsches Verhalten – oder eine Frage wie „Warum steht das da?“"),
    ("2", "Meldung genau lesen", "Der Text nennt oft schon Ort und Grund. Nichts raten."),
    ("3", "Ursache eingrenzen", "Protokolle lesen, einen kleinen Test bauen, prüfen: Ist es der Test oder das Programm?"),
    ("4", "Lösung umsetzen", "Eine Sache nach der anderen ändern, nicht alles auf einmal."),
    ("5", "Erneut testen", "Auch den Wiederholungsfall: Was passiert beim zweiten Klick?"),
    ("6", "Gelerntes festhalten", "In einem Satz aufschreiben – so wie in diesem Dokument."),
]
cycle_html = "".join(
    f'<div class="cy"><div class="cn">{n}</div><div class="ct">{t}</div><div class="cd">{d}</div></div>' + ('<div class="ca">›</div>' if i < len(CYCLE) - 1 else "")
    for i, (n, t, d) in enumerate(CYCLE))

LESSONS = [
    ("Fehlermeldungen sind Hinweise, keine Strafe", f"Bei {count('found','sys')} von {N} Fehlern hat das System selbst eine Meldung ausgegeben. Wer sie genau liest, findet meist sofort die Stelle."),
    ("Neue Versionen ändern Regeln", f"Wissenslücken waren mit {count('cat','K2')} von {N} die häufigste Fehlerart: Tailwind 4, Next.js 16, Vercel, Gmail. Erst die aktuelle Dokumentation lesen."),
    ("Erst prüfen, dann schreiben", "Richtiges Projekt? Leere Datenbank? Welcher Stand wird veröffentlicht? Das hätte mehrere Fehler früher gezeigt."),
    ("Bei unklarem Ausgang nicht blind wiederholen", "Erst nachsehen, was angekommen ist. Sonst entstehen doppelte Daten."),
    ("Automatiken brauchen Zustand und Wiederholungs-Tests", "Der endlose Verzögerungs-Vorschlag entstand, weil das Programm nicht wusste, was es schon getan hatte."),
    ("Testdaten sind Qualitätssicherung", "Erst mit realistischen Daten fielen der Endlos-Vorschlag und die fehlende Öffnungszeiten-Prüfung auf."),
    ("Geheimnisse gehören nicht in Chats", "Passwörter und Schlüssel nur direkt in den Einstellungen eintragen. Wurde eines preisgegeben: sofort ändern."),
    ("Berechtigungen gehören dem Menschen", "Die KI darf sich keine Rechte geben, und eine Sperre ist oft ein gewollter Schutz."),
]
lessons_html = "".join(f'<div class="ls"><div class="lsn">{i}</div><div><b>{t}</b><br>{d}</div></div>' for i, (t, d) in enumerate(LESSONS, 1))

GLOSS = [
    ("Build", "Das Programm wird aus dem Quellcode zusammengebaut und geprüft."),
    ("Deployment / Redeploy", "Das Veröffentlichen einer Version im Internet. Redeploy baut den alten Stand noch einmal."),
    ("Commit", "Ein gespeicherter Stand des Codes mit Beschreibung."),
    ("Pull Request / Merge", "Vorschlag, Änderungen in den Hauptzweig zu übernehmen. Merge führt sie dort zusammen."),
    ("Repository (GitHub)", "Der Ordner mit allen Dateien und der Änderungshistorie. Der Hauptzweig heißt <code>main</code> und wird veröffentlicht."),
    ("Supabase", "Dienst für Datenbank, Anmeldung, Dateispeicher und Echtzeit-Updates."),
    ("Vercel", "Dienst, der die Webseite im Internet bereitstellt."),
    ("Migration", "Eine Datei mit Datenbank-Änderungen, die in fester Reihenfolge ausgeführt wird."),
    ("RLS (Row Level Security)", "Datenbank-Regeln, wer welche Zeilen sehen und ändern darf."),
    ("SMTP", "Das Verfahren, mit dem Programme E-Mails über einen Mail-Server versenden."),
    ("Trigger", "Automatische Datenbank-Aktion, die bei einer Änderung ausgelöst wird."),
    ("404", "Standard-Fehlercode: Seite nicht gefunden."),
    ("ESLint / TypeScript / Tailwind / Next.js", "Prüfwerkzeuge für den Code, Design-Hilfsmittel und das Framework, mit dem die Webseiten gebaut sind."),
]
gloss_html = "".join(f'<div class="gl"><b>{t}</b><span>{d}</span></div>' for t, d in GLOSS)

CSS = """
@page { size: A4; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, "DejaVu Sans", sans-serif; font-size: 9.6pt; line-height: 1.48; color: #1e293b; margin: 0; }
a { color: inherit; text-decoration: none; }
h1 { font-size: 20pt; color: #2c3c50; margin: 0 0 6pt; }
h2 { font-size: 14pt; color: #2c3c50; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 2.5px solid #4f6d8f; break-after: avoid; }
h3 { font-size: 10.5pt; color: #3f5876; margin: 12pt 0 4pt; break-after: avoid; }
p { margin: 3pt 0 6pt; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 8.2pt; background: #eef1f5; padding: 0.5pt 3pt; border-radius: 3px; word-break: break-word; }
.pb { break-before: page; }
.chip { display: inline-block; color: #fff; font-size: 7.6pt; font-weight: 600; padding: 1.2pt 7pt; border-radius: 20pt; white-space: nowrap; letter-spacing: .1pt; }
.dots { color: #3f5876; letter-spacing: 1pt; font-size: 8pt; } .dots .off { color: #cbd5e1; }

/* Cover */
.cover { height: 297mm; padding: 0; background: linear-gradient(155deg, #1f2a38 0%, #344860 55%, #4f6d8f 100%); color: #fff; position: relative; }
.cover .in { padding: 38mm 24mm 0; }
.cover .tag { display: inline-block; border: 1.5px solid #9db2ca; color: #c5d2e1; padding: 3pt 12pt; border-radius: 20pt; font-size: 9pt; letter-spacing: 1.2pt; text-transform: uppercase; }
.cover h1c { display: block; font-size: 34pt; line-height: 1.1; font-weight: 800; margin: 16pt 0 10pt; }
.cover .sub { font-size: 14pt; line-height: 1.4; color: #e1e8f0; max-width: 150mm; }
.cover .mark { margin-top: 26pt; display: flex; gap: 10pt; flex-wrap: wrap; }
.cover .mark span { background: rgba(255,255,255,.14); border-radius: 8pt; padding: 7pt 12pt; font-size: 10pt; }
.cover .mark b { display: block; font-size: 20pt; line-height: 1.1; }
.cover .form { position: absolute; left: 24mm; right: 24mm; bottom: 34mm; background: #fff; color: #1e293b; border-radius: 10pt; padding: 12pt 16pt 6pt; }
.cover .form div { display: flex; gap: 8pt; align-items: flex-end; margin: 0 0 11pt; font-size: 9pt; color: #64748b; }
.cover .form div i { flex: 1; border-bottom: 1px solid #94a3b8; height: 11pt; }
.cover .foot { position: absolute; left: 24mm; right: 24mm; bottom: 14mm; font-size: 8.5pt; color: #c5d2e1; }

/* Statistik */
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin: 8pt 0 12pt; }
.tile { border-radius: 8pt; padding: 8pt 10pt; background: #f2f5f9; border: 1px solid #dbe3ec; }
.tile b { display: block; font-size: 22pt; line-height: 1.1; color: #2c3c50; }
.tile span { font-size: 8.3pt; color: #475569; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt 22pt; }
.bar { display: grid; grid-template-columns: 38mm 1fr 8mm; gap: 6pt; align-items: center; margin: 3pt 0; font-size: 8.8pt; }
.bt { height: 9pt; background: #e8edf3; border-radius: 5pt; overflow: hidden; } .bf { height: 100%; border-radius: 5pt; }
.bn { font-weight: 700; text-align: right; }
.legend { display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 0 14pt; }
.lg { margin: 0 0 5pt; } .ld { font-size: 8pt; color: #475569; line-height: 1.35; margin-top: 1.5pt; }

/* Tabelle */
table.ov { width: 100%; border-collapse: collapse; font-size: 8.4pt; }
table.ov th { background: #3f5876; color: #fff; text-align: left; padding: 4pt 5pt; font-size: 8pt; }
table.ov td { padding: 3pt 5pt; border-bottom: 1px solid #dbe3ec; vertical-align: middle; }
table.ov tr:nth-child(even) td { background: #f7f9fb; }
table.ov .c-id { font-weight: 700; color: #3f5876; width: 9mm; }

/* Kreislauf */
.cycle { display: flex; align-items: stretch; gap: 3pt; margin: 8pt 0 6pt; }
.cy { flex: 1; background: #f2f5f9; border: 1px solid #dbe3ec; border-radius: 8pt; padding: 7pt 6pt; font-size: 7.9pt; }
.cn { width: 16pt; height: 16pt; border-radius: 50%; background: #3f5876; color: #fff; font-weight: 700; text-align: center; line-height: 16pt; margin-bottom: 3pt; }
.ct { font-weight: 700; color: #2c3c50; margin-bottom: 2pt; font-size: 8.4pt; }
.ca { align-self: center; color: #6f8cad; font-size: 16pt; }

/* Zeitleiste */
.tl-item { display: flex; gap: 10pt; position: relative; padding-bottom: 7pt; break-inside: avoid; }
.tl-item::before { content: ""; position: absolute; left: 5pt; top: 12pt; bottom: -2pt; width: 2px; background: #c5d2e1; }
.tl-item:last-child::before { display: none; }
.dot { flex: 0 0 12pt; height: 12pt; border-radius: 50%; background: #3f5876; border: 3px solid #e1e8f0; margin-top: 2pt; z-index: 1; }
.dot.none { background: #15803d; }
.tl-h { font-size: 9.4pt; } .tm { color: #64748b; font-size: 8pt; margin-left: 6pt; }
.tl-t { font-size: 8.8pt; color: #475569; }
.tl-f { margin-top: 3pt; display: flex; gap: 3pt; flex-wrap: wrap; }
.fc { color: #fff; font-size: 7.8pt; font-weight: 700; padding: 1pt 6pt; border-radius: 4pt; }

/* Fehlerkarten */
.case { border: 1px solid #d5dde8; border-left: 5px solid var(--cc); border-radius: 8pt; padding: 8pt 11pt 9pt; margin: 0 0 10pt; background: #fff; }
.ch, .meta { break-after: avoid; }
.pbc { break-before: page; }
.blk, .two, .msg, .lesson, .loop, figure { break-inside: avoid; }
.ch { display: flex; gap: 8pt; align-items: center; }
.num { background: var(--cc); color: #fff; font-weight: 800; font-size: 10.5pt; padding: 2pt 8pt; border-radius: 6pt; }
.ttl { font-size: 11pt; font-weight: 700; color: #1e293b; line-height: 1.3; }
.meta { display: flex; flex-wrap: wrap; gap: 5pt 8pt; align-items: center; margin: 5pt 0 6pt; font-size: 8.3pt; color: #475569; }
.lbl { display: block; font-size: 7.3pt; font-weight: 800; letter-spacing: .8pt; text-transform: uppercase; color: var(--cc); margin-bottom: 1pt; }
.blk { margin: 0 0 5pt; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; }
.cause { background: #fff7ed; border-radius: 6pt; padding: 5pt 8pt; } .cause .lbl { color: #c2410c; }
.fix { background: #f0fdf4; border-radius: 6pt; padding: 5pt 8pt; } .fix .lbl { color: #15803d; }
.msg { background: #1e293b; border-radius: 6pt; padding: 5pt 9pt; margin: 0 0 5pt; }
.msg .lbl { color: #94a3b8; } .msg code { background: transparent; color: #fecaca; font-size: 8pt; padding: 0; }
.lesson { background: #eff6ff; border-radius: 6pt; padding: 5pt 9pt; margin-top: 5pt; border-left: 3px solid #2563eb; }
.lesson .lbl { color: #1d4ed8; }
.figs { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt; margin: 6pt 0 2pt; align-items: start; }
.figs.one { grid-template-columns: 1fr; }
figure { margin: 0; border: 1px solid #d5dde8; border-radius: 6pt; overflow: hidden; background: #fff; }
figure img { display: block; width: 100%; height: auto; }
figcaption { font-size: 7.4pt; color: #475569; padding: 2pt 6pt 3pt; background: #f2f5f9; }
.figs.one figure { max-width: 130mm; }

/* Diagramm Endlosschleife */
.loop { display: grid; gap: 5pt; margin: 6pt 0 3pt; }
.lp { border-radius: 6pt; padding: 5pt 8pt; } .lp.bad { background: #fef2f2; } .lp.good { background: #f0fdf4; }
.lt { font-size: 7.6pt; font-weight: 800; text-transform: uppercase; letter-spacing: .7pt; margin-bottom: 3pt; }
.bad .lt { color: #b91c1c; } .good .lt { color: #15803d; }
.flow { display: flex; align-items: center; gap: 4pt; flex-wrap: nowrap; }
.flow span { flex: 1; background: #fff; border: 1px solid #d5dde8; border-radius: 5pt; padding: 3pt 5pt; font-size: 7.6pt; text-align: center; line-height: 1.3; }
.flow span.warn { border-color: #f87171; background: #fff1f2; } .flow span.ok { border-color: #4ade80; background: #f0fdf4; }
.flow i { font-style: normal; color: #64748b; font-size: 11pt; } .flow i.back { color: #b91c1c; font-weight: 700; }

/* Erkenntnisse, Rollen */
.ls { display: flex; gap: 8pt; background: #f2f5f9; border-radius: 8pt; padding: 5pt 9pt; margin: 0 0 4pt; break-inside: avoid; font-size: 8.7pt; line-height: 1.4; }
.lsn { flex: 0 0 18pt; height: 18pt; border-radius: 50%; background: #3f5876; color: #fff; font-weight: 700; text-align: center; line-height: 18pt; }
.roles, .role, .note { break-inside: avoid; }
.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin: 6pt 0; }
.role { border: 1px solid #d5dde8; border-radius: 8pt; padding: 8pt 11pt; font-size: 9pt; }
.role h4 { margin: 0 0 3pt; color: #2c3c50; font-size: 10pt; } .role ul { margin: 2pt 0 0; padding-left: 14pt; }
.open li { margin: 2pt 0; list-style: none; margin-left: -14pt; }
.box { display: inline-block; width: 8pt; height: 8pt; border: 1.3px solid #3f5876; border-radius: 2px; margin-right: 7pt; vertical-align: -1pt; }
.glos { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18pt; font-size: 8pt; line-height: 1.34; }
.gl { break-inside: avoid; margin-bottom: 2pt; } .gl b { color: #2c3c50; display: block; }
.note { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6pt; padding: 6pt 10pt; font-size: 8.8pt; margin: 8pt 0; }
"""

HEAD = f'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Fehlerprotokoll Praxisverwaltung</title><style>{CSS}</style></head><body>'

cover = HEAD + f"""
<div class="cover">
  <div class="in">
    <span class="tag">Schulprojekt · Informatik</span>
    <span style="display:block;font-size:34pt;line-height:1.1;font-weight:800;margin:16pt 0 10pt">Aus Fehlern lernen</span>
    <div class="sub">Fehlerprotokoll zum Projekt <b>„Praxisverwaltung“</b>: Was bei der Entwicklung einer Web-App für Arztpraxen schiefging – und wie wir es behoben haben.</div>
    <div class="mark">
      <span><b>{N}</b>Fehlerfälle</span>
      <span><b>{n_ok + n_av}</b>gelöst oder vermieden</span>
      <span><b>{n_wk}</b>umgangen</span>
      <span><b>{n_op}</b>noch offen</span>
    </div>
  </div>
  <div class="form">
    <div>Name(n):<i></i></div>
    <div>Klasse / Kurs:<i></i></div>
    <div>Fach / Lehrkraft:<i></i></div>
    <div>Abgabedatum:<i></i></div>
  </div>
  <div class="foot">Stand: 18.11.2026 · Dieses Dokument wurde mit Unterstützung der KI Claude (Anthropic) aus dem Projektverlauf erstellt. Die KI-Nutzung ist im Abschnitt „Wer hat was gemacht?“ erklärt.</div>
</div></body></html>"""

index = HEAD + f"""
<h1>Worum geht es in diesem Dokument?</h1>
<p>Wir haben eine <b>Web-App zur Verwaltung von Arztpraxen</b> entwickelt (Termine, Wartezimmer, Patientenakte, Benachrichtigungen). Dabei sind – wie bei jedem Lernprojekt – viele Fehler passiert. Dieses Dokument zeigt <b>jeden Fehler einzeln</b>: Was passiert ist, wie die Fehlermeldung lautete, woran es lag, wie wir ihn behoben haben und was wir daraus gelernt haben. Fehler sind hier kein Makel, sondern der Nachweis für den Lernprozess.</p>

<div class="tiles">
  <div class="tile"><b>{N}</b><span>Fehlerfälle dokumentiert</span></div>
  <div class="tile"><b>{n_ok}</b><span>gelöst und erneut getestet</span></div>
  <div class="tile"><b>{len(big)}</b><span>schwere Fehler (Wirkung „groß“)</span></div>
  <div class="tile"><b>{n_op}</b><span>noch offen</span></div>
</div>

<h2>Die Zahlen auf einen Blick</h2>
<div class="grid2">
  <div><h3>Welche Art von Fehler?</h3>{cat_bars}</div>
  <div><h3>Wie ging es aus?</h3>{status_bars}
       <h3>Wer hat den Fehler entdeckt?</h3>{found_bars}
       <h3>Wie stark hat er uns aufgehalten?</h3>{impact_bars}</div>
</div>
<div class="note"><b>Auffällig:</b> Mit {count('cat','K2')} von {N} Fällen waren <b>Wissenslücken bei neuen Werkzeugen</b> die häufigste Fehlerart. Nur {count('found','team')} Fälle haben wir selbst beim Ausprobieren bemerkt, bei {count('found','sys')} hat das System den Fehler selbst gemeldet. <b>Genau lesen lohnt sich.</b></div>

<h3 style="margin-top:10pt">Unser Ablauf bei jedem Fehler</h3>
<div class="cycle" style="margin-top:4pt">{cycle_html}</div>

<h2 class="pb">So liest du dieses Dokument</h2>
<div class="legend">
  <div><h3>Fehlerart</h3>{legend_cat}</div>
  <div><h3>Ergebnis</h3>{legend_status}</div>
  <div><h3>Entdeckt durch</h3>{legend_found}<h3>Wirkung</h3><div class="lg"><span>{dots(1)} {dots(2)} {dots(3)}</span><div class="ld">klein · mittel · groß: wie stark der Fehler das Projekt aufgehalten hat.</div></div></div>
</div>

<h2 style="margin-top:14pt">Alle Fehlerfälle auf einen Blick</h2>
<p style="font-size:8.4pt;color:#64748b;margin:0 0 4pt">Ein Klick auf Nummer oder Titel springt zur ausführlichen Fehlerkarte.</p>
<table class="ov"><thead><tr><th>#</th><th>Fehler</th><th>Art</th><th>Ergebnis</th><th>Entdeckt</th><th>Wirkung</th></tr></thead><tbody>{overview_rows}</tbody></table>

<h2 style="margin-top:16pt">Der Weg durch das Projekt</h2>
<p>Die Reihenfolge ist ungefähr chronologisch. Uhrzeiten stammen von unseren Bildschirmfotos. Die Kürzel (F1 …) führen zu den Fehlerkarten, die Farbe zeigt die Fehlerart.</p>
{timeline_html}


<h2 class="pb">Die Fehlerkarten</h2>
<p style="font-size:8.8pt;color:#475569">Jede Karte folgt demselben Aufbau: <b>Was ist passiert?</b> → <b>Fehlermeldung</b> → <b>Ursache</b> und <b>Lösung</b> → <b>Gelernt</b>. Bildschirmfotos stammen aus der echten Arbeit; E-Mail-Adressen, Benutzernamen und Passwörter wurden geschwärzt bzw. nicht verwendet.</p>
{''.join(case_html(c) for c in CASES)}

<h2 style="margin-top:14pt">Was wir gelernt haben</h2>
{lessons_html}

<h2 style="margin-top:14pt">Wer hat was gemacht? (KI-Nutzung)</h2>
<div class="roles">
  <div class="role"><h4>Wir (Team)</h4><ul>
    <li>Anforderungen festgelegt (Lastenheft, 26 Fragen im Fragebogen)</li>
    <li>Entscheidungen getroffen, z. B. „keine Telefonnummer bei Gmail“</li>
    <li>Einstellungen bei Supabase, Vercel und Google vorgenommen</li>
    <li>Die laufende App ausprobiert und Fehler gemeldet</li></ul></div>
  <div class="role"><h4>KI (Claude)</h4><ul>
    <li>Programmcode, Datenbank und Tests geschrieben</li>
    <li>Fehler in Protokollen und Fotos gesucht und behoben</li>
    <li>Testdaten erzeugt, Dokumente und dieses Protokoll verfasst</li>
    <li>Fehler der KI selbst: siehe F18 und F19</li></ul></div>
</div>
<p style="font-size:8.8pt">Die Verantwortung für Prüfung, Freigabe und Datenschutz bleibt beim Team. Das erkennt man an den Fehlern F7 und F19: Die KI darf sich keine Rechte geben, und Veröffentlichungen brauchen eine ausdrückliche Zusage.</p>

<h2 style="margin-top:14pt">Offene Punkte</h2>
<ul class="open" style="padding-left:14pt">
  <li><span class="box"></span>Absender für E-Mails festlegen (Brevo oder eigene Domain plus Resend) und in Supabase <b>und</b> Vercel eintragen (F11)</li>
  <li><span class="box"></span>Danach „Confirm email“ wieder einschalten und die Testmail prüfen (F12)</li>
  <li><span class="box"></span>Geheimen Job-Schlüssel neu erzeugen und das Passwort des Gmail-Kontos ändern (F18)</li>
  <li><span class="box"></span>Abend-Testtermine entfernen oder in die Sprechzeiten verlegen (F16)</li>
  <li><span class="box"></span>Vor Echtbetrieb: Supabase Pro (Backups), Datenschutz-Verträge (AV-Vertrag), Datenschutz-Folgenabschätzung</li>
</ul>
<div class="note">Eine technisch ausführlichere Fassung mit 21 Einzelpunkten liegt im Projekt unter <code>docs/Probleme-und-Loesungen.md</code>. Hier sind verwandte Punkte zu {N} Fällen zusammengefasst (z. B. F9 = Build-Fehler, 404 und Redeploy).</div>

<h2 style="margin-top:14pt">Begriffe kurz erklärt</h2>
<div class="glos">{gloss_html}</div>
</body></html>"""

(HERE / "index.html").write_text(index, encoding="utf-8")
(HERE / "cover.html").write_text(cover, encoding="utf-8")
print("Fälle:", N, "| ok", n_ok, "avoid", n_av, "work", n_wk, "open", n_op, "| groß", len(big))

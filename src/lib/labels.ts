import type { AbsenceKind, AppointmentStatus, LocationKind, PracticeType, StaffRole, ProtocolField } from "./types";

export const PRACTICE_TYPES: Record<PracticeType, string> = {
  allgemeinmedizin: "Allgemeinmedizin",
  hausarzt: "Hausarztpraxis",
  orthopaedie: "Orthopädie",
  zahnarzt: "Zahnarztpraxis",
  augenarzt: "Augenheilkunde",
  hno: "Hals-Nasen-Ohren (HNO)",
  physiotherapie: "Physiotherapie",
  psychotherapie: "Psychotherapie",
  mvz: "MVZ (Medizinisches Versorgungszentrum)",
  sonstige: "Sonstige",
};

export const STAFF_ROLES: Record<StaffRole, string> = {
  arzt: "Arzt / Ärztin",
  therapeut: "Therapeut/in",
  mfa: "MFA / Empfang",
  verwaltung: "Verwaltung",
};

export const isProvider = (r: StaffRole) => r === "arzt" || r === "therapeut";

export const STATUS: Record<AppointmentStatus, { label: string; cls: string }> = {
  geplant: { label: "Geplant", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  bestaetigt: { label: "Bestätigt", cls: "bg-sky-50 text-sky-800 ring-sky-300" },
  eingecheckt: { label: "Im Wartezimmer", cls: "bg-amber-50 text-amber-800 ring-amber-300" },
  in_behandlung: { label: "In Behandlung", cls: "bg-indigo-50 text-indigo-800 ring-indigo-300" },
  abgeschlossen: { label: "Abgeschlossen", cls: "bg-emerald-50 text-emerald-800 ring-emerald-300" },
  abgesagt: { label: "Abgesagt", cls: "bg-rose-50 text-rose-700 ring-rose-200 line-through" },
  nicht_erschienen: { label: "Nicht erschienen", cls: "bg-rose-100 text-rose-800 ring-rose-300" },
};

export const ACTIVE_STATUSES: AppointmentStatus[] = ["geplant", "bestaetigt", "eingecheckt", "in_behandlung"];

export const LOCATION: Record<LocationKind, string> = {
  praxis: "In der Praxis",
  hausbesuch: "Hausbesuch",
  video: "Videosprechstunde",
};

export const ABSENCE: Record<AbsenceKind, string> = {
  urlaub: "Urlaub",
  krank: "Krankheit",
  fortbildung: "Fortbildung",
  sonstiges: "Sonstiges",
};

export const EVENT_LABELS: Record<string, string> = {
  angelegt: "Termin angelegt",
  status: "Status geändert",
  verschoben: "Verschoben",
  verspaetung: "Verzögerung",
  behandler_gewechselt: "Behandler gewechselt (Vertretung)",
  ort_geaendert: "Ort geändert",
};

const f = (key: string, label: string, type: ProtocolField["type"] = "textarea"): ProtocolField => ({ key, label, type });
const STD = [f("anamnese", "Anamnese"), f("befund", "Befund"), f("therapie", "Therapie / Maßnahmen")];

/** Vorlagen für Termintypen je Praxisart (beim Anlegen der Praxis) */
export const DEFAULT_TYPES: Record<PracticeType, { name: string; minutes: number; template: ProtocolField[] }[]> = {
  allgemeinmedizin: [
    { name: "Sprechstunde", minutes: 10, template: STD },
    { name: "Erstuntersuchung", minutes: 30, template: STD },
    { name: "Check-up 35", minutes: 30, template: [...STD, f("rr", "Blutdruck", "text")] },
    { name: "Blutabnahme", minutes: 10, template: [f("werte", "Angeforderte Werte")] },
    { name: "Impfung", minutes: 10, template: [f("impfstoff", "Impfstoff / Charge", "text")] },
    { name: "Hausbesuch", minutes: 45, template: STD },
  ],
  hausarzt: [
    { name: "Sprechstunde", minutes: 10, template: STD },
    { name: "Vorsorge / Check-up", minutes: 30, template: [...STD, f("rr", "Blutdruck", "text")] },
    { name: "DMP-Termin", minutes: 20, template: STD },
    { name: "Blutabnahme", minutes: 10, template: [f("werte", "Angeforderte Werte")] },
    { name: "Impfung", minutes: 10, template: [f("impfstoff", "Impfstoff / Charge", "text")] },
    { name: "Hausbesuch", minutes: 45, template: STD },
  ],
  orthopaedie: [
    { name: "Erstuntersuchung", minutes: 20, template: STD },
    { name: "Kontrolle", minutes: 10, template: STD },
    { name: "Röntgen", minutes: 15, template: [f("region", "Region", "text"), f("befund", "Befund")] },
    { name: "Injektion / Infiltration", minutes: 15, template: [f("praeparat", "Präparat", "text"), f("befund", "Verlauf")] },
    { name: "Stoßwellentherapie", minutes: 20, template: [f("region", "Region", "text"), f("impulse", "Impulse", "number")] },
  ],
  zahnarzt: [
    { name: "Kontrolle (01)", minutes: 20, template: [f("befund", "Zahnbefund"), f("empfehlung", "Empfehlung")] },
    { name: "Professionelle Zahnreinigung", minutes: 60, template: [f("befund", "Befund"), f("hinweise", "Hinweise")] },
    { name: "Füllungstherapie", minutes: 45, template: [f("zahn", "Zahn", "text"), f("material", "Material", "text"), f("anaesthesie", "Anästhesie", "checkbox")] },
    { name: "Wurzelbehandlung", minutes: 60, template: [f("zahn", "Zahn", "text"), f("verlauf", "Verlauf")] },
    { name: "Extraktion", minutes: 30, template: [f("zahn", "Zahn", "text"), f("verlauf", "Verlauf")] },
    { name: "Schmerzpatient", minutes: 20, template: STD },
  ],
  augenarzt: [
    { name: "Sehtest", minutes: 15, template: [f("visus", "Visus", "text"), f("refraktion", "Refraktion", "text")] },
    { name: "Augendruckmessung", minutes: 10, template: [f("iod", "Augeninnendruck", "text")] },
    { name: "Vorsorge", minutes: 20, template: STD },
    { name: "Netzhautuntersuchung (Weittropfen)", minutes: 40, template: STD },
    { name: "Kontrolle", minutes: 10, template: STD },
  ],
  hno: [
    { name: "Untersuchung", minutes: 15, template: STD },
    { name: "Hörtest", minutes: 20, template: [f("ergebnis", "Ergebnis")] },
    { name: "Allergietest", minutes: 30, template: [f("ergebnis", "Ergebnis")] },
    { name: "Kontrolle", minutes: 10, template: STD },
  ],
  physiotherapie: [
    { name: "Krankengymnastik (KG)", minutes: 25, template: [f("massnahmen", "Maßnahmen"), f("verlauf", "Verlauf")] },
    { name: "Manuelle Therapie (MT)", minutes: 25, template: [f("massnahmen", "Maßnahmen"), f("verlauf", "Verlauf")] },
    { name: "Lymphdrainage", minutes: 45, template: [f("verlauf", "Verlauf")] },
    { name: "Massage", minutes: 20, template: [f("verlauf", "Verlauf")] },
    { name: "Befundaufnahme", minutes: 45, template: STD },
  ],
  psychotherapie: [
    { name: "Psychotherapeutische Sprechstunde", minutes: 50, template: [f("anliegen", "Anliegen"), f("einschaetzung", "Einschätzung")] },
    { name: "Probatorik", minutes: 50, template: [f("inhalt", "Inhalt"), f("einschaetzung", "Einschätzung")] },
    { name: "Einzeltherapie", minutes: 50, template: [f("inhalt", "Sitzungsinhalt"), f("hausaufgabe", "Vereinbarungen")] },
    { name: "Akutbehandlung", minutes: 25, template: [f("inhalt", "Inhalt")] },
  ],
  mvz: [
    { name: "Sprechstunde", minutes: 15, template: STD },
    { name: "Erstuntersuchung", minutes: 30, template: STD },
    { name: "Kontrolle", minutes: 10, template: STD },
    { name: "Diagnostik", minutes: 30, template: STD },
  ],
  sonstige: [
    { name: "Termin", minutes: 15, template: STD },
    { name: "Erstgespräch", minutes: 30, template: STD },
  ],
};

export const STAFF_COLORS = ["#4f6d8f", "#5b8a8c", "#7a6f9b", "#9b7a5b", "#5f7f5a", "#8c5b6e", "#3f5f7f", "#6b8bb0"];

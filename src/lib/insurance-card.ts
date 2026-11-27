/** Quartal eines Datums (YYYY-MM-DD), z. B. „Q4/2026“. */
export function quarterOf(day: string) {
  const [y, m] = day.split("-").map(Number);
  return { y, q: Math.floor((m - 1) / 3) + 1, label: `Q${Math.floor((m - 1) / 3) + 1}/${y}` };
}

/**
 * Muss die Versichertenkarte (eGK) in diesem Quartal noch vorgelegt werden?
 * Gesetzlich (und unbekannt) ja, privat/Selbstzahler nein. Gleiche Regel wie private.needs_insurance_card in der DB.
 */
export function needsCard(p: { insurance_type: string | null; card_checked_on: string | null }, today: string) {
  if ((p.insurance_type ?? "gesetzlich") !== "gesetzlich") return false;
  if (!p.card_checked_on) return true;
  const a = quarterOf(p.card_checked_on), b = quarterOf(today);
  return a.y < b.y || (a.y === b.y && a.q < b.q);
}

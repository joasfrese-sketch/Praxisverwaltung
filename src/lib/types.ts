export type PracticeType =
  | "allgemeinmedizin" | "hausarzt" | "orthopaedie" | "zahnarzt" | "augenarzt" | "hno"
  | "physiotherapie" | "psychotherapie" | "mvz" | "sonstige";
export type StaffRole = "arzt" | "therapeut" | "mfa" | "verwaltung";
export type AppointmentStatus =
  | "geplant" | "bestaetigt" | "eingecheckt" | "in_behandlung" | "abgeschlossen" | "abgesagt" | "nicht_erschienen";
export type LocationKind = "praxis" | "hausbesuch" | "video";
export type AbsenceKind = "urlaub" | "krank" | "fortbildung" | "sonstiges";
export type AbsenceStatus = "beantragt" | "genehmigt" | "abgelehnt";

export interface Practice {
  id: string; name: string; practice_type: PracticeType;
  street: string | null; zip: string | null; city: string | null; phone: string | null; email: string | null;
  timezone: string; slot_minutes: number; buffer_minutes: number; emergency_slots_per_day: number;
  cancel_deadline_hours: number; reminder_hours: number[]; delay_notify_minutes: number;
  no_show_warn_threshold: number; no_show_ask_minutes: number; display_token: string;
  self_checkin_enabled: boolean; checkin_token: string; self_checkin_early_minutes: number;
  online_booking_enabled: boolean; booking_token: string; online_lead_hours: number; online_horizon_days: number;
}
export interface Staff {
  id: string; practice_id: string; user_id: string | null; role: StaffRole; is_admin: boolean;
  title: string | null; first_name: string; last_name: string; specialty: string | null;
  email: string | null; phone: string | null; color: string; can_read_medical: boolean;
  substitute_id: string | null; active: boolean; online_bookable: boolean;
}
export interface Room { id: string; practice_id: string; name: string; sort: number; active: boolean; capabilities: string[] }
export interface ProtocolField { key: string; label: string; type: "text" | "textarea" | "number" | "checkbox" }
export interface AppointmentType {
  id: string; practice_id: string; name: string; default_minutes: number; color: string;
  protocol_template: ProtocolField[]; active: boolean; required_capability: string | null; online_bookable: boolean;
}
export interface Patient {
  id: string; practice_id: string; first_name: string; last_name: string; birth_date: string | null;
  gender: string | null; email: string | null; phone: string | null; street: string | null; zip: string | null;
  city: string | null; insurance_type: string | null; insurance_name: string | null; insurance_number: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null; notify_email: boolean;
  reminder_hours: number[] | null; delay_notify_minutes: number | null; notes: string | null; created_at: string;
  card_checked_on: string | null; card_checked_by: string | null; created_online: boolean;
}
export interface Appointment {
  id: string; practice_id: string; patient_id: string; doctor_id: string; assistant_id: string | null;
  type_id: string | null; reason: string; starts_at: string; ends_at: string; location_kind: LocationKind;
  room_id: string | null; address: string | null; video_url: string | null; status: AppointmentStatus;
  is_emergency: boolean; delay_minutes: number; ticket_number: number | null; checked_in_at: string | null;
  called_at: string | null; actual_start: string | null; actual_end: string | null;
  patient_confirmed_at: string | null; cancelled_by: string | null; cancel_reason: string | null;
  notes: string | null; public_token: string; created_at: string; self_checked_in: boolean; booked_online: boolean;
}
export type AppointmentWithPatient = Appointment & {
  patient: Pick<Patient, "id" | "first_name" | "last_name" | "birth_date"> | null;
};
export interface Absence {
  id: string; practice_id: string; staff_id: string; kind: AbsenceKind; starts_on: string; ends_on: string; note: string | null;
  status: AbsenceStatus; created_by: string | null; decided_by: string | null; decided_at: string | null; decision_note: string | null;
}

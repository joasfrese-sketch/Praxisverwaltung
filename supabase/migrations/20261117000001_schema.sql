-- =====================================================================
-- Praxisverwaltung – Grundschema (mandantenfähig, RLS)
-- =====================================================================

create schema if not exists private;

-- ---------- Enums ----------
create type public.practice_type as enum (
  'allgemeinmedizin','hausarzt','orthopaedie','zahnarzt','augenarzt','hno',
  'physiotherapie','psychotherapie','mvz','sonstige'
);
create type public.staff_role as enum ('arzt','therapeut','mfa','verwaltung');
create type public.appointment_status as enum (
  'geplant','bestaetigt','eingecheckt','in_behandlung','abgeschlossen','abgesagt','nicht_erschienen'
);
create type public.location_kind as enum ('praxis','hausbesuch','video');
create type public.absence_kind as enum ('urlaub','krank','fortbildung','sonstiges');

-- ---------- Praxis ----------
create table public.practices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  practice_type public.practice_type not null,
  street text, zip text, city text, phone text, email text,
  timezone text not null default 'Europe/Berlin',
  slot_minutes int not null default 15 check (slot_minutes between 1 and 240),
  buffer_minutes int not null default 0 check (buffer_minutes >= 0),
  emergency_slots_per_day int not null default 0 check (emergency_slots_per_day >= 0),
  cancel_deadline_hours int not null default 24 check (cancel_deadline_hours >= 0),
  reminder_hours int[] not null default '{24}',
  delay_notify_minutes int not null default 15 check (delay_notify_minutes >= 0),
  no_show_warn_threshold int not null default 3 check (no_show_warn_threshold >= 1),
  display_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = Montag
  opens time not null,
  closes time not null,
  check (closes > opens)
);
create index on public.opening_hours (practice_id);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role public.staff_role not null,
  is_admin boolean not null default false,
  title text,
  first_name text not null,
  last_name text not null,
  specialty text,
  email text,
  phone text,
  color text not null default '#4f6d8f',
  can_read_medical boolean not null default false,
  substitute_id uuid references public.staff(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (practice_id, user_id)
);
create index on public.staff (practice_id);
create index on public.staff (user_id);
create index on public.staff (substitute_id);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);
create index on public.rooms (practice_id);

create table public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null,
  default_minutes int not null default 15 check (default_minutes > 0),
  color text not null default '#6b8bb0',
  -- strukturierte Protokoll-Vorlage: [{ "key": "befund", "label": "Befund", "type": "text" }]
  protocol_template jsonb not null default '[]'::jsonb,
  active boolean not null default true
);
create index on public.appointment_types (practice_id);

-- ---------- Patienten ----------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- für späteres Patientenportal
  first_name text not null,
  last_name text not null,
  birth_date date,
  gender text,
  email text,
  phone text,
  street text, zip text, city text,
  insurance_type text check (insurance_type in ('gesetzlich','privat','selbstzahler')),
  insurance_name text,
  insurance_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notify_email boolean not null default true,
  reminder_hours int[],          -- null = Praxis-Standard
  delay_notify_minutes int,      -- null = Praxis-Standard
  notes text,
  created_at timestamptz not null default now()
);
create index on public.patients (practice_id, last_name);
create index on public.patients (user_id);

create table public.care_assignments (
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (patient_id, staff_id)
);
create index on public.care_assignments (practice_id);
create index on public.care_assignments (staff_id);

-- ---------- Termine ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.staff(id) on delete restrict,
  assistant_id uuid references public.staff(id) on delete set null,
  type_id uuid references public.appointment_types(id) on delete set null,
  reason text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_kind public.location_kind not null default 'praxis',
  room_id uuid references public.rooms(id) on delete set null,
  address text,
  video_url text,
  status public.appointment_status not null default 'geplant',
  is_emergency boolean not null default false,
  delay_minutes int not null default 0,
  ticket_number int,
  checked_in_at timestamptz,
  called_at timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  patient_confirmed_at timestamptz,
  cancelled_by text check (cancelled_by in ('patient','praxis')),
  cancel_reason text,
  notes text,
  public_token uuid not null default gen_random_uuid() unique,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.appointments (practice_id, starts_at);
create index on public.appointments (doctor_id, starts_at);
create index on public.appointments (patient_id, starts_at);
create index on public.appointments (room_id);
create index on public.appointments (assistant_id);
create index on public.appointments (type_id);
create index on public.appointments (created_by);

create table public.appointment_protocols (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  author_id uuid references public.staff(id) on delete set null,
  content text,
  structured jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.appointment_protocols (appointment_id);
create index on public.appointment_protocols (practice_id);
create index on public.appointment_protocols (author_id);

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.appointment_events (appointment_id, created_at);
create index on public.appointment_events (practice_id);
create index on public.appointment_events (actor_id);

-- ---------- Patientenakte ----------
create table public.record_categories (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null,
  is_warning boolean not null default false,
  sort int not null default 0
);
create index on public.record_categories (practice_id);

create table public.patient_record_entries (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  category_id uuid references public.record_categories(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  title text not null,
  content text,
  author_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.patient_record_entries (patient_id, created_at desc);
create index on public.patient_record_entries (practice_id);
create index on public.patient_record_entries (category_id);
create index on public.patient_record_entries (appointment_id);
create index on public.patient_record_entries (author_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.attachments (patient_id);
create index on public.attachments (practice_id);
create index on public.attachments (appointment_id);
create index on public.attachments (uploaded_by);

-- angeheftete Notizen/Nachrichten an Patient oder Termin
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  author_id uuid references public.staff(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  check (patient_id is not null or appointment_id is not null)
);
create index on public.notes (practice_id);
create index on public.notes (patient_id);
create index on public.notes (appointment_id);
create index on public.notes (author_id);

-- ---------- Organisation ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  title text not null,
  description text,
  patient_id uuid references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  assignee_id uuid references public.staff(id) on delete set null,
  due_date date,
  done_at timestamptz,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.tasks (practice_id, done_at);
create index on public.tasks (assignee_id);
create index on public.tasks (patient_id);
create index on public.tasks (appointment_id);
create index on public.tasks (created_by);

create table public.staff_absences (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  kind public.absence_kind not null default 'sonstiges',
  starts_on date not null,
  ends_on date not null,
  note text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index on public.staff_absences (practice_id, starts_on);
create index on public.staff_absences (staff_id);
create index on public.staff_absences (created_by);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.staff(id) on delete set null,
  type_id uuid references public.appointment_types(id) on delete set null,
  note text,
  earliest_date date,
  latest_date date,
  priority smallint not null default 0,
  resolved_at timestamptz,
  resolved_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.waitlist_entries (practice_id, resolved_at);
create index on public.waitlist_entries (patient_id);
create index on public.waitlist_entries (doctor_id);
create index on public.waitlist_entries (type_id);
create index on public.waitlist_entries (resolved_appointment_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  recipient_staff_id uuid references public.staff(id) on delete cascade,
  recipient_patient_id uuid references public.patients(id) on delete cascade,
  channel text not null default 'in_app' check (channel in ('in_app','email')),
  kind text not null,
  title text not null,
  body text,
  appointment_id uuid references public.appointments(id) on delete cascade,
  status text not null default 'neu' check (status in ('neu','gelesen','ausstehend','gesendet','fehler')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  sent_at timestamptz,
  check (recipient_staff_id is not null or recipient_patient_id is not null)
);
create index on public.notifications (recipient_staff_id, status);
create index on public.notifications (practice_id, status);
create index on public.notifications (recipient_patient_id);
create index on public.notifications (appointment_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  practice_id uuid references public.practices(id) on delete cascade,
  user_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  at timestamptz not null default now()
);
create index on public.audit_log (practice_id, at desc);

-- =====================================================================
-- Rechte: Hilfsfunktionen (privates Schema, nicht über die API erreichbar)
-- =====================================================================

create or replace function private.my_staff_id(p_practice uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.staff s
  where s.practice_id = p_practice and s.user_id = (select auth.uid()) and s.active
  limit 1
$$;

create or replace function private.is_member(p_practice uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.practice_id = p_practice and s.user_id = (select auth.uid()) and s.active
  )
$$;

create or replace function private.is_admin(p_practice uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.practice_id = p_practice and s.user_id = (select auth.uid()) and s.active and s.is_admin
  )
$$;

create or replace function private.can_read_medical(p_practice uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.practice_id = p_practice and s.user_id = (select auth.uid()) and s.active
      and (s.is_admin or s.can_read_medical or s.role in ('arzt','therapeut'))
  )
$$;

create or replace function private.can_manage_absences(p_practice uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.practice_id = p_practice and s.user_id = (select auth.uid()) and s.active
      and (s.is_admin or s.role in ('mfa','verwaltung'))
  )
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.practices enable row level security;
alter table public.opening_hours enable row level security;
alter table public.staff enable row level security;
alter table public.rooms enable row level security;
alter table public.appointment_types enable row level security;
alter table public.patients enable row level security;
alter table public.care_assignments enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_protocols enable row level security;
alter table public.appointment_events enable row level security;
alter table public.record_categories enable row level security;
alter table public.patient_record_entries enable row level security;
alter table public.attachments enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.staff_absences enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Praxis
create policy "Mitglieder sehen Praxis" on public.practices for select to authenticated
  using (private.is_member(id));
create policy "Admins ändern Praxis" on public.practices for update to authenticated
  using (private.is_admin(id)) with check (private.is_admin(id));

-- Stammdaten, die nur Admins ändern
create policy "Mitglieder lesen" on public.opening_hours for select to authenticated using (private.is_member(practice_id));
create policy "Admins schreiben" on public.opening_hours for all to authenticated
  using (private.is_admin(practice_id)) with check (private.is_admin(practice_id));

create policy "Mitglieder lesen" on public.staff for select to authenticated using (private.is_member(practice_id));
create policy "Admins schreiben" on public.staff for all to authenticated
  using (private.is_admin(practice_id)) with check (private.is_admin(practice_id));

create policy "Mitglieder lesen" on public.rooms for select to authenticated using (private.is_member(practice_id));
create policy "Admins schreiben" on public.rooms for all to authenticated
  using (private.is_admin(practice_id)) with check (private.is_admin(practice_id));

create policy "Mitglieder lesen" on public.appointment_types for select to authenticated using (private.is_member(practice_id));
create policy "Admins schreiben" on public.appointment_types for all to authenticated
  using (private.is_admin(practice_id)) with check (private.is_admin(practice_id));

create policy "Mitglieder lesen" on public.record_categories for select to authenticated using (private.is_member(practice_id));
create policy "Admins schreiben" on public.record_categories for all to authenticated
  using (private.is_admin(practice_id)) with check (private.is_admin(practice_id));

-- Operative Daten: alle aktiven Mitglieder
create policy "Mitglieder verwalten" on public.patients for all to authenticated
  using (private.is_member(practice_id)) with check (private.is_member(practice_id));
create policy "Mitglieder verwalten" on public.care_assignments for all to authenticated
  using (private.is_member(practice_id)) with check (private.is_member(practice_id));
create policy "Mitglieder verwalten" on public.appointments for all to authenticated
  using (private.is_member(practice_id)) with check (private.is_member(practice_id));
create policy "Mitglieder verwalten" on public.notes for all to authenticated
  using (private.is_member(practice_id)) with check (private.is_member(practice_id));
create policy "Mitglieder verwalten" on public.tasks for all to authenticated
  using (private.is_member(practice_id)) with check (private.is_member(practice_id));
create policy "Mitglieder verwalten" on public.waitlist_entries for all to authenticated
  using (private.is_member(practice_id)) with check (private.is_member(practice_id));

-- Termin-Historie: lesen + anhängen, nie ändern
create policy "Mitglieder lesen" on public.appointment_events for select to authenticated using (private.is_member(practice_id));
create policy "Mitglieder anhängen" on public.appointment_events for insert to authenticated with check (private.is_member(practice_id));

-- Abwesenheiten: alle lesen, Admin + MFA/Verwaltung schreiben
create policy "Mitglieder lesen" on public.staff_absences for select to authenticated using (private.is_member(practice_id));
create policy "Admin/MFA schreiben" on public.staff_absences for all to authenticated
  using (private.can_manage_absences(practice_id)) with check (private.can_manage_absences(practice_id));

-- Medizinische Inhalte: nur Berechtigte; revisionssicher (kein Update/Delete)
create policy "Berechtigte lesen" on public.appointment_protocols for select to authenticated using (private.can_read_medical(practice_id));
create policy "Berechtigte schreiben" on public.appointment_protocols for insert to authenticated with check (private.can_read_medical(practice_id));
create policy "Berechtigte lesen" on public.patient_record_entries for select to authenticated using (private.can_read_medical(practice_id));
create policy "Berechtigte schreiben" on public.patient_record_entries for insert to authenticated with check (private.can_read_medical(practice_id));
create policy "Berechtigte lesen" on public.attachments for select to authenticated using (private.can_read_medical(practice_id));
create policy "Berechtigte schreiben" on public.attachments for insert to authenticated with check (private.can_read_medical(practice_id));

-- Benachrichtigungen: eigene + Patienten-Ausgang der Praxis
create policy "Eigene und Ausgang lesen" on public.notifications for select to authenticated
  using (private.is_member(practice_id) and (recipient_staff_id = private.my_staff_id(practice_id) or recipient_patient_id is not null));
create policy "Eigene als gelesen markieren" on public.notifications for update to authenticated
  using (recipient_staff_id = private.my_staff_id(practice_id))
  with check (recipient_staff_id = private.my_staff_id(practice_id));
create policy "Mitglieder erzeugen" on public.notifications for insert to authenticated
  with check (private.is_member(practice_id));

-- Audit-Log: nur Admins lesen; Schreiben nur über Trigger
create policy "Admins lesen" on public.audit_log for select to authenticated using (private.is_admin(practice_id));

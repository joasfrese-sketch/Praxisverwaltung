-- =====================================================================
-- Online-Terminbuchung für Patienten (ohne Konto)
-- Öffentliche Seite /buchen/[token]: Leistung → Behandler → freie Zeit → Daten → gebucht.
-- Nur freigegebene Leistungen/Behandler, mit Vorlauf und Horizont; keine fremden Daten sichtbar.
-- =====================================================================

alter table public.practices
  add column online_booking_enabled boolean not null default false,
  add column booking_token uuid not null default gen_random_uuid() unique,
  add column online_lead_hours int not null default 24 check (online_lead_hours between 0 and 336),
  add column online_horizon_days int not null default 90 check (online_horizon_days between 1 and 400);

alter table public.appointment_types add column online_bookable boolean not null default false;
alter table public.staff add column online_bookable boolean not null default true;
alter table public.appointments add column booked_online boolean not null default false;
alter table public.patients add column created_online boolean not null default false;

-- Freie Startzeiten (intern). Berücksichtigt Sprechzeiten, Raster, Puffer, genehmigte Abwesenheiten,
-- bestehende Termine, Vorlaufzeit und Horizont.
create or replace function private.online_free_slots(p_practice uuid, p_type uuid, p_doctor uuid, p_from date, p_to date)
returns table (doctor_id uuid, starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with p as (
    select pr.*, (now() at time zone pr.timezone)::date as today
    from public.practices pr where pr.id = p_practice and pr.online_booking_enabled
  ),
  t as (
    select at.default_minutes as dur from public.appointment_types at, p
    where at.id = p_type and at.practice_id = p.id and at.active and at.online_bookable
  ),
  docs as (
    select s.id from public.staff s, p
    where s.practice_id = p.id and s.active and s.online_bookable and s.role in ('arzt', 'therapeut')
      and (p_doctor is null or s.id = p_doctor)
  ),
  days as (
    select d::date as day from p, generate_series(greatest(p_from, p.today), least(p_to, p.today + p.online_horizon_days), interval '1 day') d
  ),
  cand as (
    select docs.id as doctor_id, (ts at time zone p.timezone) as starts_at, t.dur, days.day
    from p cross join t cross join docs cross join days
    join public.opening_hours h on h.practice_id = p_practice and h.weekday = extract(isodow from days.day)
    cross join lateral generate_series(days.day + h.opens, days.day + h.closes - make_interval(mins => t.dur),
                                       make_interval(mins => greatest(5, p.slot_minutes))) ts
  )
  select c.doctor_id, c.starts_at
  from cand c, p
  where c.starts_at >= now() + make_interval(hours => p.online_lead_hours)
    and not exists (
      select 1 from public.staff_absences ab
      where ab.staff_id = c.doctor_id and ab.status = 'genehmigt' and ab.starts_on <= c.day and ab.ends_on >= c.day)
    and not exists (
      select 1 from public.appointments a
      where a.doctor_id = c.doctor_id and a.status not in ('abgesagt', 'nicht_erschienen')
        and a.starts_at < c.starts_at + make_interval(mins => c.dur + p.buffer_minutes)
        and a.ends_at > c.starts_at - make_interval(mins => p.buffer_minutes))
  order by c.starts_at, c.doctor_id
$$;

-- Öffentlich: was kann gebucht werden?
create or replace function public.online_booking_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'practice', p.name, 'phone', p.phone, 'enabled', p.online_booking_enabled,
    'lead_hours', p.online_lead_hours, 'horizon_days', p.online_horizon_days,
    'today', (now() at time zone p.timezone)::date, 'timezone', p.timezone,
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'minutes', t.default_minutes) order by t.name)
      from public.appointment_types t where t.practice_id = p.id and t.active and t.online_bookable), '[]'::jsonb),
    'doctors', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', concat_ws(' ', s.title, s.first_name, s.last_name), 'specialty', s.specialty) order by s.last_name)
      from public.staff s where s.practice_id = p.id and s.active and s.online_bookable and s.role in ('arzt', 'therapeut')), '[]'::jsonb)
  )
  from public.practices p where p.booking_token = p_token
$$;

-- Öffentlich: freie Zeiten im Zeitraum (höchstens 6 Wochen, höchstens 600 Zeiten). Nur Zeiten, keine Termindaten.
create or replace function public.online_slots(p_token uuid, p_type uuid, p_doctor uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('d', x.doctor_id, 't', x.starts_at) order by x.starts_at), '[]'::jsonb)
  from (
    select f.* from public.practices p,
      private.online_free_slots(p.id, p_type, p_doctor, p_from, least(p_to, p_from + 42)) f
    where p.booking_token = p_token
    limit 600
  ) x
$$;

-- Öffentlich: Termin buchen
create or replace function public.online_book(
  p_token uuid, p_type uuid, p_doctor uuid, p_starts timestamptz,
  p_first text, p_last text, p_birth date, p_phone text, p_email text, p_insurance text, p_note text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_p public.practices%rowtype;
  v_t public.appointment_types%rowtype;
  v_first text := btrim(coalesce(p_first, ''));
  v_last text := btrim(coalesce(p_last, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_patient uuid;
  v_appt public.appointments%rowtype;
  v_doc text;
begin
  select * into v_p from public.practices where booking_token = p_token;
  if not found or not v_p.online_booking_enabled then return jsonb_build_object('result', 'deaktiviert'); end if;

  if v_first = '' or v_last = '' or v_phone = '' or length(v_first) > 100 or length(v_last) > 100 or length(v_phone) > 40
     or p_birth is null or p_birth < '1900-01-01' or p_birth > (now() at time zone v_p.timezone)::date
     or (v_email is not null and (length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
     or length(coalesce(p_note, '')) > 500
     or coalesce(p_insurance, 'gesetzlich') not in ('gesetzlich', 'privat', 'selbstzahler') then
    return jsonb_build_object('result', 'eingabe');
  end if;

  select * into v_t from public.appointment_types
    where id = p_type and practice_id = v_p.id and active and online_bookable;
  if not found then return jsonb_build_object('result', 'ungueltig'); end if;

  -- Schutz: höchstens 30 Online-Buchungen pro Stunde je Praxis
  if (select count(*) from public.appointments where practice_id = v_p.id and booked_online and created_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('result', 'limit');
  end if;

  -- gleichzeitige Buchungen desselben Behandlers nacheinander prüfen (kein Doppelbuchen)
  perform pg_advisory_xact_lock(hashtext(p_doctor::text));
  if not exists (
    select 1 from private.online_free_slots(v_p.id, p_type, p_doctor,
      (p_starts at time zone v_p.timezone)::date, (p_starts at time zone v_p.timezone)::date) f
    where f.doctor_id = p_doctor and f.starts_at = p_starts) then
    return jsonb_build_object('result', 'belegt');
  end if;

  -- Patient wiederfinden (Vorname + Nachname + Geburtsdatum) oder neu anlegen. Es wird nie verraten, ob er existiert.
  select id into v_patient from public.patients
    where practice_id = v_p.id and lower(btrim(first_name)) = lower(v_first) and lower(btrim(last_name)) = lower(v_last) and birth_date = p_birth
    order by created_at limit 1;
  if v_patient is null then
    insert into public.patients (practice_id, first_name, last_name, birth_date, phone, email, insurance_type, created_online, notes)
    values (v_p.id, v_first, v_last, p_birth, v_phone, v_email, coalesce(p_insurance, 'gesetzlich'), true, 'Online angelegt – Stammdaten beim ersten Besuch prüfen.')
    returning id into v_patient;
  else
    if (select count(*) from public.appointments where patient_id = v_patient and booked_online
          and status in ('geplant', 'bestaetigt') and starts_at > now()) >= 3 then
      return jsonb_build_object('result', 'limit');
    end if;
    update public.patients set phone = coalesce(phone, v_phone), email = coalesce(email, v_email) where id = v_patient;
  end if;

  insert into public.appointments (practice_id, patient_id, doctor_id, type_id, reason, starts_at, ends_at, location_kind, status, booked_online, notes)
  values (v_p.id, v_patient, p_doctor, v_t.id, v_t.name, p_starts, p_starts + make_interval(mins => v_t.default_minutes), 'praxis', 'geplant', true,
          nullif('Online gebucht. ' || coalesce('Hinweis des Patienten: ' || nullif(btrim(p_note), ''), ''), 'Online gebucht. '))
  returning * into v_appt;

  -- Empfang/Verwaltung/Admins informieren (der Behandler bekommt die normale „Neuer Termin“-Meldung)
  insert into public.notifications (practice_id, recipient_staff_id, kind, title, body, appointment_id)
  select v_p.id, s.id, 'online_buchung', 'Online-Buchung: ' || v_last || ', ' || v_first,
         private.fmt_ts(p_starts, v_p.timezone) || ' – ' || v_t.name || ' (bitte prüfen)', v_appt.id
  from public.staff s
  where s.practice_id = v_p.id and s.active and s.id <> p_doctor and (s.is_admin or s.role in ('mfa', 'verwaltung'));

  select concat_ws(' ', title, first_name, last_name) into v_doc from public.staff where id = p_doctor;
  return jsonb_build_object('result', 'ok', 'token', v_appt.public_token, 'starts_at', v_appt.starts_at, 'ends_at', v_appt.ends_at,
    'doctor', v_doc, 'type', v_t.name);
end $$;

revoke execute on function public.online_booking_info(uuid) from public;
revoke execute on function public.online_slots(uuid, uuid, uuid, date, date) from public;
revoke execute on function public.online_book(uuid, uuid, uuid, timestamptz, text, text, date, text, text, text, text) from public;
grant execute on function public.online_booking_info(uuid) to anon, authenticated;
grant execute on function public.online_slots(uuid, uuid, uuid, date, date) to anon, authenticated;
grant execute on function public.online_book(uuid, uuid, uuid, timestamptz, text, text, date, text, text, text, text) to anon, authenticated;

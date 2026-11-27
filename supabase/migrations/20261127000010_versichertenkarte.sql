-- =====================================================================
-- Versichertenkarte (eGK): Vorlage einmal pro Quartal vermerken
-- Die App liest keine Karte ein (das macht das zertifizierte PVS mit TI-Anschluss).
-- Der Empfang vermerkt nur „Karte in diesem Quartal vorgelegt“; der Selbst-Check-in
-- und „Heute“ erinnern, solange der Vermerk für gesetzlich Versicherte fehlt.
-- =====================================================================

alter table public.patients
  add column card_checked_on date,
  add column card_checked_by uuid references public.staff(id) on delete set null;
create index on public.patients (card_checked_by);

-- Braucht der Patient in diesem Quartal noch die Karte? (privat/Selbstzahler: nein; unbekannt: ja)
create or replace function private.needs_insurance_card(p_patient uuid, p_tz text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(pt.insurance_type, 'gesetzlich') = 'gesetzlich'
     and (pt.card_checked_on is null
          or date_trunc('quarter', pt.card_checked_on) < date_trunc('quarter', (now() at time zone p_tz)::date))
  from public.patients pt where pt.id = p_patient
$$;

create or replace function public.self_check_in(p_token uuid, p_last_name text, p_birth_date date)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_p public.practices%rowtype;
  v_name text := lower(btrim(coalesce(p_last_name, '')));
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_a public.appointments%rowtype;
  v_fails int;
  v_card boolean;
begin
  select * into v_p from public.practices where checkin_token = p_token;
  if not found or not v_p.self_checkin_enabled then
    return jsonb_build_object('result', 'deaktiviert');
  end if;

  -- höchstens 20 Fehlversuche in 10 Minuten je Praxis
  delete from private.self_checkin_attempts where created_at < now() - interval '1 day';
  select count(*) into v_fails from private.self_checkin_attempts
    where practice_id = v_p.id and created_at > now() - interval '10 minutes';
  if v_fails >= 20 then
    return jsonb_build_object('result', 'gesperrt');
  end if;

  if v_name = '' or p_birth_date is null then
    return jsonb_build_object('result', 'nicht_gefunden');
  end if;

  v_day_start := (date_trunc('day', now() at time zone v_p.timezone)) at time zone v_p.timezone;
  v_day_end := v_day_start + interval '1 day';

  -- heutiger, noch offener Praxistermin des Patienten (der nächstliegende zuerst)
  select a.* into v_a
  from public.appointments a
  join public.patients pt on pt.id = a.patient_id
  where a.practice_id = v_p.id
    and lower(btrim(pt.last_name)) = v_name
    and pt.birth_date = p_birth_date
    and a.location_kind = 'praxis'
    and a.starts_at >= v_day_start and a.starts_at < v_day_end
    and a.status in ('geplant', 'bestaetigt', 'eingecheckt')
  order by (a.status = 'eingecheckt') desc, abs(extract(epoch from a.starts_at - now()))
  limit 1;

  if not found then
    insert into private.self_checkin_attempts (practice_id) values (v_p.id);
    return jsonb_build_object('result', 'nicht_gefunden');
  end if;

  v_card := private.needs_insurance_card(v_a.patient_id, v_p.timezone);

  if v_a.status = 'eingecheckt' then
    return jsonb_build_object('result', 'bereits', 'ticket', v_a.ticket_number, 'karte', v_card,
      'time', to_char(v_a.starts_at at time zone v_p.timezone, 'HH24:MI'));
  end if;

  if v_a.starts_at > now() + make_interval(mins => v_p.self_checkin_early_minutes) then
    return jsonb_build_object('result', 'zu_frueh',
      'time', to_char(v_a.starts_at at time zone v_p.timezone, 'HH24:MI'),
      'ab', to_char((v_a.starts_at - make_interval(mins => v_p.self_checkin_early_minutes)) at time zone v_p.timezone, 'HH24:MI'));
  end if;

  update public.appointments set status = 'eingecheckt', self_checked_in = true
    where id = v_a.id
    returning * into v_a;

  return jsonb_build_object('result', 'ok', 'ticket', v_a.ticket_number, 'karte', v_card,
    'time', to_char(v_a.starts_at at time zone v_p.timezone, 'HH24:MI'));
end $$;


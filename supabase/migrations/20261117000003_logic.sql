-- =====================================================================
-- Geschäftslogik: Trigger + RPCs
-- =====================================================================

-- ---------- Termin: Status-Zeitstempel (BEFORE) ----------
create or replace function private.appointments_before()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tz text;
  v_day_start timestamptz;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'eingecheckt' and new.ticket_number is null then
      select timezone into v_tz from public.practices where id = new.practice_id;
      v_day_start := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
      new.checked_in_at := now();
      select coalesce(max(a.ticket_number), 0) + 1 into new.ticket_number
        from public.appointments a
        where a.practice_id = new.practice_id and a.checked_in_at >= v_day_start;
    elsif new.status = 'in_behandlung' then
      new.called_at := coalesce(new.called_at, now());
      new.actual_start := coalesce(new.actual_start, now());
    elsif new.status = 'abgeschlossen' then
      new.actual_end := coalesce(new.actual_end, now());
      new.actual_start := coalesce(new.actual_start, new.starts_at);
    elsif new.status = 'bestaetigt' and new.patient_confirmed_at is null and private.my_staff_id(new.practice_id) is null then
      new.patient_confirmed_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger appointments_before
  before insert or update on public.appointments
  for each row execute function private.appointments_before();

-- ---------- Termin: Historie, Akte, Benachrichtigungen (AFTER) ----------
create or replace function private.fmt_ts(p_ts timestamptz, p_tz text)
returns text language sql immutable set search_path = '' as $$
  select to_char(p_ts at time zone p_tz, 'DD.MM.YYYY HH24:MI')
$$;

create or replace function private.appointments_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.my_staff_id(new.practice_id);
  v_p public.practices%rowtype;
  v_pat public.patients%rowtype;
  v_doc text;
  v_shift int;
  v_delay_threshold int;
  v_cat uuid;
begin
  select * into v_p from public.practices where id = new.practice_id;
  select * into v_pat from public.patients where id = new.patient_id;
  select concat_ws(' ', s.title, s.first_name, s.last_name) into v_doc from public.staff s where s.id = new.doctor_id;

  if tg_op = 'INSERT' then
    insert into public.appointment_events (practice_id, appointment_id, kind, details, actor_id)
    values (new.practice_id, new.id, 'angelegt',
      jsonb_build_object('starts_at', new.starts_at, 'ends_at', new.ends_at, 'doctor_id', new.doctor_id), v_actor);

    if v_pat.email is not null and v_pat.notify_email then
      insert into public.notifications (practice_id, recipient_patient_id, channel, kind, title, body, appointment_id, status)
      values (new.practice_id, new.patient_id, 'email', 'terminbestaetigung',
        'Ihr Termin am ' || private.fmt_ts(new.starts_at, v_p.timezone),
        'Termin bei ' || v_doc || ' (' || new.reason || ').', new.id, 'ausstehend');
    end if;
    if v_actor is distinct from new.doctor_id then
      insert into public.notifications (practice_id, recipient_staff_id, kind, title, body, appointment_id)
      values (new.practice_id, new.doctor_id, 'neuer_termin',
        'Neuer Termin: ' || v_pat.last_name || ', ' || v_pat.first_name,
        private.fmt_ts(new.starts_at, v_p.timezone) || ' – ' || new.reason, new.id);
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    insert into public.appointment_events (practice_id, appointment_id, kind, details, actor_id)
    values (new.practice_id, new.id, 'status',
      jsonb_build_object('von', old.status, 'nach', new.status, 'durch', case when v_actor is null then 'patient' else 'praxis' end), v_actor);

    if new.status = 'abgesagt' then
      if new.cancelled_by = 'praxis' and v_pat.email is not null and v_pat.notify_email then
        insert into public.notifications (practice_id, recipient_patient_id, channel, kind, title, body, appointment_id, status)
        values (new.practice_id, new.patient_id, 'email', 'absage',
          'Ihr Termin am ' || private.fmt_ts(new.starts_at, v_p.timezone) || ' wurde abgesagt',
          coalesce(new.cancel_reason, 'Bitte kontaktieren Sie die Praxis für einen neuen Termin.'), new.id, 'ausstehend');
      end if;
      insert into public.notifications (practice_id, recipient_staff_id, kind, title, body, appointment_id)
      select new.practice_id, s.id, 'absage',
        'Termin abgesagt: ' || v_pat.last_name || ', ' || v_pat.first_name,
        private.fmt_ts(new.starts_at, v_p.timezone) || ' – Slot ist frei (Warteliste prüfen)', new.id
      from public.staff s
      where s.practice_id = new.practice_id and s.active and s.id is distinct from v_actor
        and (s.id = new.doctor_id or s.role in ('mfa','verwaltung'));
    elsif new.status = 'nicht_erschienen' then
      null;
    elsif new.status = 'abgeschlossen' then
      select id into v_cat from public.record_categories
        where practice_id = new.practice_id and name = 'Termine' limit 1;
      insert into public.patient_record_entries (practice_id, patient_id, category_id, appointment_id, title, content, author_id)
      values (new.practice_id, new.patient_id, v_cat, new.id,
        'Termin: ' || new.reason,
        'Behandler: ' || v_doc
          || E'\nGeplant: ' || private.fmt_ts(new.starts_at, v_p.timezone) || ' (' || (extract(epoch from new.ends_at - new.starts_at) / 60)::int || ' min)'
          || coalesce(E'\nTatsächlich: ' || (extract(epoch from new.actual_end - new.actual_start) / 60)::int || ' min', ''),
        coalesce(v_actor, new.doctor_id));
    end if;
  end if;

  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    v_shift := (extract(epoch from new.starts_at - old.starts_at) / 60)::int;
    insert into public.appointment_events (practice_id, appointment_id, kind, details, actor_id)
    values (new.practice_id, new.id, case when new.delay_minutes > old.delay_minutes then 'verspaetung' else 'verschoben' end,
      jsonb_build_object('von', old.starts_at, 'nach', new.starts_at, 'minuten', v_shift), v_actor);

    v_delay_threshold := coalesce(v_pat.delay_notify_minutes, v_p.delay_notify_minutes);
    if v_pat.email is not null and v_pat.notify_email
       and new.status not in ('abgesagt','abgeschlossen','nicht_erschienen')
       and (new.delay_minutes = old.delay_minutes or abs(v_shift) >= v_delay_threshold) then
      insert into public.notifications (practice_id, recipient_patient_id, channel, kind, title, body, appointment_id, status)
      values (new.practice_id, new.patient_id, 'email',
        case when new.delay_minutes > old.delay_minutes then 'verspaetung' else 'verschiebung' end,
        case when new.delay_minutes > old.delay_minutes
          then 'Verzögerung: Ihr Termin beginnt ca. ' || v_shift || ' Minuten später'
          else 'Ihr Termin wurde verschoben' end,
        'Neuer Beginn: ' || private.fmt_ts(new.starts_at, v_p.timezone) || ' bei ' || v_doc || '.', new.id, 'ausstehend');
    end if;
  end if;

  if new.doctor_id is distinct from old.doctor_id then
    insert into public.appointment_events (practice_id, appointment_id, kind, details, actor_id)
    values (new.practice_id, new.id, 'behandler_gewechselt',
      jsonb_build_object('von', old.doctor_id, 'nach', new.doctor_id), v_actor);
    insert into public.notifications (practice_id, recipient_staff_id, kind, title, body, appointment_id)
    values (new.practice_id, new.doctor_id, 'vertretung',
      'Vertretung übernommen: ' || v_pat.last_name || ', ' || v_pat.first_name,
      private.fmt_ts(new.starts_at, v_p.timezone) || ' – ' || new.reason, new.id);
    if v_pat.email is not null and v_pat.notify_email then
      insert into public.notifications (practice_id, recipient_patient_id, channel, kind, title, body, appointment_id, status)
      values (new.practice_id, new.patient_id, 'email', 'behandlerwechsel',
        'Änderung zu Ihrem Termin am ' || private.fmt_ts(new.starts_at, v_p.timezone),
        'Ihr Termin findet bei ' || v_doc || ' statt.', new.id, 'ausstehend');
    end if;
  end if;

  if new.room_id is distinct from old.room_id or new.location_kind is distinct from old.location_kind then
    insert into public.appointment_events (practice_id, appointment_id, kind, details, actor_id)
    values (new.practice_id, new.id, 'ort_geaendert',
      jsonb_build_object('raum_von', old.room_id, 'raum_nach', new.room_id, 'art', new.location_kind), v_actor);
  end if;

  return new;
end $$;

create trigger appointments_after
  after insert or update on public.appointments
  for each row execute function private.appointments_after();

-- ---------- Audit-Log ----------
create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.audit_log (practice_id, user_id, table_name, record_id, action)
  values (r.practice_id, (select auth.uid()), tg_table_name, r.id, lower(tg_op));
  return null;
end $$;

create trigger audit after insert or update or delete on public.patients for each row execute function private.audit();
create trigger audit after insert or update or delete on public.appointments for each row execute function private.audit();
create trigger audit after insert on public.appointment_protocols for each row execute function private.audit();
create trigger audit after insert on public.patient_record_entries for each row execute function private.audit();
create trigger audit after insert on public.attachments for each row execute function private.audit();
create trigger audit after insert or update or delete on public.staff for each row execute function private.audit();

-- =====================================================================
-- RPCs (öffentlich aufrufbar, intern geprüft)
-- =====================================================================

-- Neue Praxis anlegen; der Aufrufer wird Admin
create or replace function public.create_practice(
  p_name text, p_type public.practice_type,
  p_first_name text, p_last_name text, p_role public.staff_role, p_title text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_uid uuid := (select auth.uid()); d int;
begin
  if v_uid is null then raise exception 'Nicht angemeldet'; end if;
  insert into public.practices (name, practice_type) values (p_name, p_type) returning id into v_id;
  insert into public.staff (practice_id, user_id, role, is_admin, title, first_name, last_name, email, can_read_medical)
  values (v_id, v_uid, p_role, true, p_title, p_first_name, p_last_name, (select auth.email()), true);
  insert into public.record_categories (practice_id, name, is_warning, sort) values
    (v_id, 'Termine', false, 0), (v_id, 'Diagnosen', false, 1), (v_id, 'Medikation', false, 2),
    (v_id, 'Allergien / Warnhinweise', true, 3), (v_id, 'Befunde / Dokumente', false, 4),
    (v_id, 'Versicherung', false, 5), (v_id, 'Sonstiges', false, 6);
  for d in 1..5 loop
    insert into public.opening_hours (practice_id, weekday, opens, closes) values (v_id, d, '08:00', '12:00');
    if d <> 3 and d <> 5 then
      insert into public.opening_hours (practice_id, weekday, opens, closes) values (v_id, d, '14:00', '18:00');
    end if;
  end loop;
  return v_id;
end $$;
revoke execute on function public.create_practice from public, anon;
grant execute on function public.create_practice to authenticated;

-- Eingeladene Mitarbeiter (per E-Mail angelegt) mit Login verknüpfen
create or replace function public.claim_staff_invitations()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.staff set user_id = (select auth.uid())
  where user_id is null and email is not null and lower(email) = lower((select auth.email()))
    and not exists (select 1 from public.staff s2 where s2.practice_id = staff.practice_id and s2.user_id = (select auth.uid()));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.claim_staff_invitations from public, anon;
grant execute on function public.claim_staff_invitations to authenticated;

-- Patienten-Link: Termin ansehen
create or replace function public.appointment_by_token(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'practice', p.name, 'practice_phone', p.phone, 'timezone', p.timezone,
    'starts_at', a.starts_at, 'ends_at', a.ends_at, 'status', a.status, 'reason', a.reason,
    'location_kind', a.location_kind, 'room', r.name, 'address', a.address, 'video_url', a.video_url,
    'doctor', concat_ws(' ', s.title, s.first_name, s.last_name),
    'patient_first_name', pt.first_name,
    'confirmed', a.patient_confirmed_at is not null,
    'can_cancel', a.status in ('geplant','bestaetigt') and a.starts_at - make_interval(hours => p.cancel_deadline_hours) > now(),
    'cancel_deadline_hours', p.cancel_deadline_hours
  )
  from public.appointments a
  join public.practices p on p.id = a.practice_id
  join public.staff s on s.id = a.doctor_id
  join public.patients pt on pt.id = a.patient_id
  left join public.rooms r on r.id = a.room_id
  where a.public_token = p_token
$$;

-- Patienten-Link: bestätigen / absagen
create or replace function public.respond_to_appointment(p_token uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare a public.appointments%rowtype; v_deadline int;
begin
  select * into a from public.appointments where public_token = p_token;
  if not found then return 'nicht_gefunden'; end if;
  if a.status not in ('geplant','bestaetigt') then return 'nicht_moeglich'; end if;
  if p_action = 'bestaetigen' then
    update public.appointments set status = 'bestaetigt', patient_confirmed_at = now() where id = a.id;
    return 'bestaetigt';
  elsif p_action = 'absagen' then
    select cancel_deadline_hours into v_deadline from public.practices where id = a.practice_id;
    if a.starts_at - make_interval(hours => v_deadline) <= now() then return 'frist_abgelaufen'; end if;
    update public.appointments set status = 'abgesagt', cancelled_by = 'patient', cancel_reason = 'Abgesagt über Patienten-Link' where id = a.id;
    return 'abgesagt';
  end if;
  return 'ungueltig';
end $$;

-- Wartezimmer-Bildschirm (anonymisiert: nur Nummer + Raum)
create or replace function public.waiting_room_display(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with p as (select * from public.practices where display_token = p_token),
  day as (select (date_trunc('day', now() at time zone p.timezone)) at time zone p.timezone as start from p)
  select jsonb_build_object(
    'practice', (select name from p),
    'called', coalesce((
      select jsonb_agg(jsonb_build_object('ticket', a.ticket_number, 'room', coalesce(r.name, 'Behandlung'), 'at', a.called_at) order by a.called_at desc)
      from public.appointments a left join public.rooms r on r.id = a.room_id
      where a.practice_id = (select id from p) and a.status = 'in_behandlung'
        and a.called_at > now() - interval '20 minutes' and a.ticket_number is not null
    ), '[]'::jsonb),
    'waiting', coalesce((
      select jsonb_agg(a.ticket_number order by a.ticket_number)
      from public.appointments a
      where a.practice_id = (select id from p) and a.status = 'eingecheckt'
        and a.checked_in_at >= (select start from day)
    ), '[]'::jsonb)
  )
  where exists (select 1 from p)
$$;

grant execute on function public.appointment_by_token(uuid) to anon, authenticated;
grant execute on function public.respond_to_appointment(uuid, text) to anon, authenticated;
grant execute on function public.waiting_room_display(uuid) to anon, authenticated;

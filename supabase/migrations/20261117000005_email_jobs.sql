-- =====================================================================
-- E-Mail-Versand: Erinnerungen erzeugen, Ausgang abarbeiten (über App-Endpunkt)
-- Geheimnisse (job_secret, app_url) stehen in private.app_settings und werden
-- NICHT in dieser Datei gespeichert – sie werden separat gesetzt.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists private.app_settings (
  key text primary key,
  value text not null
);
revoke all on private.app_settings from public, anon, authenticated;

-- Zusätzlicher Status "in_versand" für gerade verarbeitete Mails
alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('neu','gelesen','ausstehend','in_versand','gesendet','fehler'));
alter table public.notifications add column if not exists attempts int not null default 0;
alter table public.notifications add column if not exists last_error text;

-- Erinnerungen in den Ausgang legen (Praxis- oder Patientenvorgabe, z. B. 24 h und 2 h vorher)
create or replace function private.queue_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record; h int;
begin
  for r in
    select a.id, a.practice_id, a.patient_id, a.starts_at, a.created_at, p.timezone,
           coalesce(pt.reminder_hours, p.reminder_hours) as hours,
           concat_ws(' ', s.title, s.first_name, s.last_name) as doc
    from public.appointments a
    join public.practices p on p.id = a.practice_id
    join public.patients pt on pt.id = a.patient_id
    join public.staff s on s.id = a.doctor_id
    where a.status in ('geplant','bestaetigt')
      and a.starts_at > now() and a.starts_at < now() + interval '15 days'
      and pt.email is not null and pt.notify_email
  loop
    foreach h in array r.hours loop
      if now() >= r.starts_at - make_interval(hours => h)
         and r.created_at < r.starts_at - make_interval(hours => h)
         and not exists (select 1 from public.notifications x where x.appointment_id = r.id and x.kind = 'erinnerung_' || h) then
        insert into public.notifications (practice_id, recipient_patient_id, channel, kind, title, body, appointment_id, status)
        values (r.practice_id, r.patient_id, 'email', 'erinnerung_' || h,
          'Erinnerung: Ihr Termin am ' || private.fmt_ts(r.starts_at, r.timezone),
          'Termin bei ' || r.doc || '.', r.id, 'ausstehend');
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- Für den App-Endpunkt: nächsten Stapel ausstehender Mails holen (nur mit gültigem Schlüssel)
create or replace function public.claim_email_batch(p_secret text, p_limit int default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if p_secret is null or p_secret is distinct from (select value from private.app_settings where key = 'job_secret') then
    raise exception 'unauthorized';
  end if;
  -- hängengebliebene Versuche nach 15 min erneut freigeben
  update public.notifications set status = 'ausstehend'
    where status = 'in_versand' and sent_at is null and created_at < now() - interval '15 minutes' and attempts < 5;
  with picked as (
    select n.id from public.notifications n
    where n.channel = 'email' and n.status = 'ausstehend' and n.attempts < 5
    order by n.created_at
    limit p_limit
    for update skip locked
  ), upd as (
    update public.notifications n set status = 'in_versand', attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'kind', u.kind, 'title', u.title, 'body', u.body,
    'to', pt.email, 'first_name', pt.first_name, 'last_name', pt.last_name,
    'practice', p.name, 'practice_phone', p.phone, 'practice_email', p.email,
    'practice_address', concat_ws(', ', p.street, concat_ws(' ', p.zip, p.city)),
    'timezone', p.timezone,
    'starts_at', a.starts_at, 'status', a.status, 'location_kind', a.location_kind,
    'room', r.name, 'video_url', a.video_url, 'cancel_reason', a.cancel_reason,
    'doctor', concat_ws(' ', s.title, s.first_name, s.last_name),
    'token', a.public_token
  )), '[]'::jsonb) into v
  from upd u
  join public.patients pt on pt.id = u.recipient_patient_id
  join public.practices p on p.id = u.practice_id
  left join public.appointments a on a.id = u.appointment_id
  left join public.rooms r on r.id = a.room_id
  left join public.staff s on s.id = a.doctor_id;
  return v;
end $$;

create or replace function public.finish_email(p_secret text, p_id uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.app_settings where key = 'job_secret') then
    raise exception 'unauthorized';
  end if;
  update public.notifications
    set status = case when p_ok then 'gesendet' when attempts >= 5 then 'fehler' else 'ausstehend' end,
        sent_at = case when p_ok then now() else null end,
        last_error = case when p_ok then null else left(p_error, 500) end
  where id = p_id;
end $$;

revoke execute on function public.claim_email_batch(text, int) from public, authenticated;
revoke execute on function public.finish_email(text, uuid, boolean, text) from public, authenticated;
grant execute on function public.claim_email_batch(text, int) to anon;
grant execute on function public.finish_email(text, uuid, boolean, text) to anon;

-- Alle 5 Minuten: Erinnerungen erzeugen und App-Endpunkt anstoßen (falls konfiguriert)
create or replace function private.run_email_jobs()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  perform private.queue_reminders();
  select value into v_url from private.app_settings where key = 'app_url';
  select value into v_secret from private.app_settings where key = 'job_secret';
  if v_url is not null and v_secret is not null
     and exists (select 1 from public.notifications where channel = 'email' and status = 'ausstehend') then
    perform net.http_post(
      url := v_url || '/api/jobs/emails',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end $$;

select cron.schedule('praxis-email-jobs', '*/5 * * * *', $$select private.run_email_jobs()$$);

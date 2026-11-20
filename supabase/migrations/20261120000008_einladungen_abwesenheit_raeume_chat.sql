-- =====================================================================
-- Einladungen fürs Personal, Abwesenheitsanträge, Raum-Fähigkeiten,
-- Team-Chat, Schriftgröße, Aufrufanzeige nur 2 Minuten
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Einladungslinks
--    Der Link enthält ein Zufallstoken; gespeichert wird nur dessen SHA-256.
--    Wer den Link öffnet, muss die hinterlegte E-Mail-Adresse eingeben
--    (die E-Mail „validiert“ die Person). Der Login wird ohne
--    Bestätigungs-Mail angelegt.
-- ---------------------------------------------------------------------
create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);
create index on public.staff_invites (practice_id);
create index on public.staff_invites (staff_id);
create index on public.staff_invites (created_by);
alter table public.staff_invites enable row level security;
create policy "Admins verwalten Einladungen" on public.staff_invites for all to authenticated
  using (private.is_admin(practice_id)) with check (private.is_admin(practice_id));

-- Was zeigt die Einladungsseite? (ohne Login aufrufbar; E-Mail nur maskiert)
create or replace function public.invite_info(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'practice', p.name,
    'name', concat_ws(' ', s.title, s.first_name, s.last_name),
    'email_hint', left(i.email, 1) || '…@' || split_part(i.email, '@', 2),
    'expires_at', i.expires_at
  )
  from public.staff_invites i
  join public.staff s on s.id = i.staff_id
  join public.practices p on p.id = i.practice_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.used_at is null and i.expires_at > now()
$$;

-- Einladung annehmen: prüft Token und E-Mail, legt bestätigten Login an, verknüpft Mitarbeiter
create or replace function public.accept_staff_invite(p_token text, p_email text, p_password text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.staff_invites%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
begin
  select * into v from public.staff_invites
    where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and used_at is null and expires_at > now()
    for update;
  if not found then return 'ungueltig'; end if;
  if v_email <> lower(v.email) then return 'email_falsch'; end if;
  if length(coalesce(p_password, '')) < 8 then return 'passwort_kurz'; end if;
  if exists (select 1 from public.staff where id = v.staff_id and user_id is not null) then return 'bereits_verknuepft'; end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    -- Konto gibt es schon (z. B. Arbeit in zwei Praxen): nur mit dem richtigen Passwort verknüpfen
    if not exists (select 1 from auth.users where id = v_uid and encrypted_password = extensions.crypt(p_password, encrypted_password)) then
      return 'email_vergeben';
    end if;
  else
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token, is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      now(), now(), '', '', '', '', '', '', '', '', false, false
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text, 'email',
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false), now(), now(), now());
  end if;

  if exists (select 1 from public.staff where practice_id = v.practice_id and user_id = v_uid) then return 'bereits_verknuepft'; end if;
  update public.staff set user_id = v_uid, email = v_email where id = v.staff_id;
  update public.staff_invites set used_at = now() where id = v.id;
  return 'ok';
end $$;

revoke execute on function public.invite_info(text) from public;
revoke execute on function public.accept_staff_invite(text, text, text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;
grant execute on function public.accept_staff_invite(text, text, text) to anon, authenticated;

-- Automatisches Verknüpfen per E-Mail entfällt: ohne Bestätigungs-Mail wäre es unsicher
-- (jeder könnte sich mit der E-Mail einer Mitarbeiterin registrieren).
drop function if exists public.claim_staff_invitations();

-- ---------------------------------------------------------------------
-- 2. Abwesenheiten: beantragen → Admin genehmigt oder lehnt ab
-- ---------------------------------------------------------------------
create type public.absence_status as enum ('beantragt', 'genehmigt', 'abgelehnt');
alter table public.staff_absences
  add column status public.absence_status not null default 'genehmigt',
  add column decided_by uuid references public.staff(id) on delete set null,
  add column decided_at timestamptz,
  add column decision_note text;
create index on public.staff_absences (decided_by);
create index on public.staff_absences (practice_id, status);

drop policy if exists "Admin/MFA schreiben" on public.staff_absences;
create policy "Admins verwalten Abwesenheiten" on public.staff_absences for all to authenticated
  using (private.is_admin(practice_id)) with check (private.is_admin(practice_id));
-- Alle dürfen für sich beantragen; MFA und Verwaltung auch für andere (z. B. telefonische Krankmeldung)
create policy "Mitarbeitende beantragen" on public.staff_absences for insert to authenticated
  with check (
    private.is_member(practice_id) and status = 'beantragt'
    and created_by = private.my_staff_id(practice_id)
    and (staff_id = private.my_staff_id(practice_id) or private.can_manage_absences(practice_id))
  );
create policy "Eigene Anträge zurückziehen" on public.staff_absences for delete to authenticated
  using (status = 'beantragt' and created_by = private.my_staff_id(practice_id));

create or replace function private.absence_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text; v_what text;
begin
  select concat_ws(' ', title, first_name, last_name) into v_name from public.staff where id = new.staff_id;
  v_what := case new.kind when 'urlaub' then 'Urlaub' when 'krank' then 'Krankheit' when 'fortbildung' then 'Fortbildung' else 'Abwesenheit' end
    || ' ' || to_char(new.starts_on, 'DD.MM.YYYY')
    || case when new.ends_on <> new.starts_on then ' bis ' || to_char(new.ends_on, 'DD.MM.YYYY') else '' end;
  if tg_op = 'INSERT' and new.status = 'beantragt' then
    insert into public.notifications (practice_id, recipient_staff_id, kind, title, body)
    select new.practice_id, s.id, 'abwesenheit_antrag', 'Abwesenheitsantrag: ' || v_name, v_what
    from public.staff s
    where s.practice_id = new.practice_id and s.active and s.is_admin and s.id is distinct from new.created_by;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('genehmigt', 'abgelehnt') then
    insert into public.notifications (practice_id, recipient_staff_id, kind, title, body)
    select distinct new.practice_id, r, 'abwesenheit_entscheidung',
      'Abwesenheit ' || case when new.status = 'genehmigt' then 'genehmigt' else 'abgelehnt' end || ': ' || v_name,
      v_what || coalesce(' (' || new.decision_note || ')', '')
    from unnest(array[new.created_by, new.staff_id]) r
    where r is not null and r is distinct from new.decided_by;
  end if;
  return null;
end $$;
create trigger absence_notify after insert or update on public.staff_absences
  for each row execute function private.absence_notify();

-- ---------------------------------------------------------------------
-- 3. Räume: Fähigkeiten (Röntgen, Untersuchung …) und Bedarf je Termintyp
-- ---------------------------------------------------------------------
alter table public.rooms add column capabilities text[] not null default '{}';
alter table public.appointment_types add column required_capability text;

-- ---------------------------------------------------------------------
-- 4. Team-Chat: Team-Kanal (recipient_id null) und Direktnachrichten
-- ---------------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  sender_id uuid not null references public.staff(id) on delete cascade,
  recipient_id uuid references public.staff(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.chat_messages (practice_id, created_at);
create index on public.chat_messages (sender_id);
create index on public.chat_messages (recipient_id);
alter table public.chat_messages enable row level security;
create policy "Team und eigene Nachrichten lesen" on public.chat_messages for select to authenticated
  using (private.is_member(practice_id) and (
    recipient_id is null or sender_id = private.my_staff_id(practice_id) or recipient_id = private.my_staff_id(practice_id)));
create policy "Als sich selbst schreiben" on public.chat_messages for insert to authenticated
  with check (
    private.is_member(practice_id) and sender_id = private.my_staff_id(practice_id)
    and (recipient_id is null or exists (select 1 from public.staff s where s.id = recipient_id and s.practice_id = chat_messages.practice_id)));

create table public.chat_reads (
  staff_id uuid not null references public.staff(id) on delete cascade,
  peer text not null,            -- 'team' oder ID des Gegenübers
  last_read_at timestamptz not null default now(),
  primary key (staff_id, peer)
);
alter table public.chat_reads enable row level security;
create policy "Eigene Lesestände" on public.chat_reads for all to authenticated
  using (staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid())))
  with check (staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid())));

-- Ungelesene Nachrichten je Gesprächspartner (für den angemeldeten Mitarbeiter)
create or replace function public.chat_unread(p_practice uuid)
returns table (peer text, unread int) language sql stable security invoker set search_path = '' as $$
  with me as (select private.my_staff_id(p_practice) as id),
  msgs as (
    select case when m.recipient_id is null then 'team' else m.sender_id::text end as peer, m.created_at
    from public.chat_messages m, me
    where m.practice_id = p_practice and m.sender_id <> me.id
      and (m.recipient_id is null or m.recipient_id = me.id)
  )
  select msgs.peer, count(*)::int
  from msgs
  left join public.chat_reads r on r.staff_id = (select id from me) and r.peer = msgs.peer
  where msgs.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by msgs.peer
$$;
revoke execute on function public.chat_unread(uuid) from public, anon;
grant execute on function public.chat_unread(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Persönliche Einstellungen (Schriftgröße) je Login
-- ---------------------------------------------------------------------
create table public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  font_scale int not null default 100 check (font_scale in (90, 100, 112, 125, 140)),
  updated_at timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
create policy "Eigene Einstellungen" on public.user_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 6. Aufrufanzeige: Aufruf nur 2 Minuten sichtbar, Raum für den Patienten
-- ---------------------------------------------------------------------
create or replace function public.waiting_room_display(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with p as (select * from public.practices where display_token = p_token),
  day as (select (date_trunc('day', now() at time zone p.timezone)) at time zone p.timezone as start from p)
  select jsonb_build_object(
    'practice', (select name from p),
    'called', coalesce((
      select jsonb_agg(jsonb_build_object('ticket', a.ticket_number, 'room', r.name, 'at', a.called_at) order by a.called_at desc)
      from public.appointments a left join public.rooms r on r.id = a.room_id
      where a.practice_id = (select id from p) and a.status = 'in_behandlung'
        and a.called_at > now() - interval '2 minutes' and a.ticket_number is not null
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

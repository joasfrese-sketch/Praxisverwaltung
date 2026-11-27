-- Fester, lesbarer Buchungslink: /buchen/<kurzname> (z. B. /buchen/termin)
alter table public.practices
  add column booking_slug text unique check (booking_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

-- Öffentlich: Kurzname → Buchungs-Schlüssel (der Kurzname ist ohnehin öffentlich)
create or replace function public.booking_token_by_slug(p_slug text)
returns uuid language sql stable security definer set search_path = '' as $$
  select booking_token from public.practices where booking_slug = lower(btrim(p_slug))
$$;
revoke execute on function public.booking_token_by_slug(text) from public;
grant execute on function public.booking_token_by_slug(text) to anon, authenticated;

-- bestehende Praxis bekommt „termin“
update public.practices set booking_slug = 'termin'
  where booking_slug is null and id = (select id from public.practices order by created_at limit 1)
    and not exists (select 1 from public.practices where booking_slug = 'termin');

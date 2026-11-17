-- Admins können fehlgeschlagene / hängende Patienten-E-Mails erneut in den Versand geben
-- (z. B. nachdem der SMTP-Server korrekt eingerichtet wurde).
create or replace function public.retry_failed_emails(p_practice uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_admin(p_practice) then raise exception 'Nur für Admins'; end if;
  update public.notifications
    set status = 'ausstehend', attempts = 0, last_error = null
  where practice_id = p_practice and channel = 'email' and status in ('fehler', 'in_versand');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.retry_failed_emails(uuid) from public, anon;
grant execute on function public.retry_failed_emails(uuid) to authenticated;

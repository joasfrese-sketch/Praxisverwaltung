-- Nach wie vielen Minuten ohne Check-in fragt die App an der Anmeldung nach, ob der Patient da ist
alter table public.practices
  add column if not exists no_show_ask_minutes int not null default 20
  check (no_show_ask_minutes between 1 and 240);

-- Online-Buchung: bis 1 Jahr im Voraus (Kontrolltermine „in 6 Monaten“ müssen buchbar sein)
alter table public.practices alter column online_horizon_days set default 365;
update public.practices set online_horizon_days = 365 where online_horizon_days = 90 and not online_booking_enabled;

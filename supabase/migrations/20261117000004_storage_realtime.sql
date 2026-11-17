-- Dateiablage für Befunde/Anhänge: Pfad = <practice_id>/<patient_id>/<datei>
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "Berechtigte lesen Anhänge" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and private.can_read_medical(((storage.foldername(name))[1])::uuid));
create policy "Berechtigte laden Anhänge hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and private.can_read_medical(((storage.foldername(name))[1])::uuid));

-- Echtzeit-Updates
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.staff_absences;

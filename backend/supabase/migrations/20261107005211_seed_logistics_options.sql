-- Datos iniciales de logística. Van en migración porque los schemas declarativos no admiten INSERT.
insert into public.logistics_options (code, label) values
  ('bus', 'Bus'),
  ('parking', 'Estacionamiento')
on conflict (code) do nothing;

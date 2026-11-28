-- Migración de datos (a mano): libera a las personas de las inscripciones que ya estaban vencidas o
-- canceladas antes de existir event_attendees.active y su trigger.
update public.event_attendees ea
set active = false
from public.event_registrations r
where r.id = ea.registration_id
  and r.status in ('expired', 'cancelled')
  and ea.active;

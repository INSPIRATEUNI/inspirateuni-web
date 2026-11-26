-- Migración de datos (a mano): las plantillas existentes quedaron como `individual` por el valor
-- por defecto de la columna. Se copian a colegios para que ambos sigan teniendo sus descargas;
-- después cada grupo se actualiza por separado desde la configuración.
insert into public.document_templates (audience, kind, version, drive_file_id, active)
select 'school', t.kind, t.version, t.drive_file_id, t.active
from public.document_templates t
where t.audience = 'individual'
on conflict (audience, kind, version) do nothing;

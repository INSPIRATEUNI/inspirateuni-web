-- Colegios para la inscripción pública del Open Day. La tabla no se lee ni se escribe directo:
-- el responsable busca su colegio y, si no aparece, lo registra con estas funciones.
-- Errores de negocio con errcode P0001 y código en HINT: invalid_input.

-- Para comparar nombres sin tildes ("Mariategui" encuentra "Mariátegui")
create extension if not exists "unaccent" with schema extensions;

-- Forma canónica de un nombre para buscar y comparar: sin tildes, en minúsculas y con un solo espacio.
create function public._school_key(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(extensions.unaccent(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')));
$$;

-- Busca colegios por nombre (al menos 3 caracteres). Devuelve solo los datos públicos.
create function public.search_schools(p_query text, p_limit integer default 10)
returns table (id uuid, name text, district text, ugel text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := public._school_key(p_query);
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
  v_pattern text;
begin
  perform public._require_user();

  if length(v_key) < 3 then
    return;
  end if;

  -- Los comodines que escriba el usuario se buscan como texto
  v_pattern := replace(replace(replace(v_key, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select s.id, s.name, s.district, s.ugel
  from public.schools s
  where public._school_key(s.name) like '%' || v_pattern || '%'
  order by
    (public._school_key(s.name) = v_key) desc,
    (public._school_key(s.name) like v_pattern || '%') desc,
    s.name
  limit v_limit;
end;
$$;

comment on function public.search_schools(text, integer) is
  'Busca colegios por nombre, sin distinguir tildes ni mayúsculas, para el formulario público del Open Day (máx. 20).';

-- Devuelve el id del colegio con ese nombre; si no existe, lo crea. Compara sin tildes, mayúsculas
-- ni espacios repetidos para no duplicar colegios por diferencias de tipeo triviales.
create function public.ensure_school(p_name text, p_district text default null, p_ugel text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_district text := nullif(regexp_replace(btrim(coalesce(p_district, '')), '\s+', ' ', 'g'), '');
  v_ugel text := nullif(regexp_replace(btrim(coalesce(p_ugel, '')), '\s+', ' ', 'g'), '');
  v_id uuid;
begin
  perform public._require_user();

  if length(v_name) < 3 or length(v_name) > 200 then
    perform public._fail('invalid_input', 'Indica el nombre del colegio (entre 3 y 200 caracteres)');
  end if;

  select s.id into v_id
  from public.schools s
  where public._school_key(s.name) = public._school_key(v_name)
  order by s.created_at
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.schools (name, district, ugel)
  values (v_name, v_district, v_ugel)
  on conflict (name) do nothing
  returning id into v_id;

  -- Otra transacción lo creó entre la búsqueda y el insert
  if v_id is null then
    select s.id into v_id from public.schools s where s.name = v_name;
  end if;

  return v_id;
end;
$$;

comment on function public.ensure_school(text, text, text) is
  'Obtiene o registra un colegio por nombre para iniciar una inscripción de colegio.';

revoke execute on function public._school_key(text) from public, anon, authenticated;

revoke execute on function
  public.search_schools(text, integer),
  public.ensure_school(text, text, text)
from public, anon;

grant execute on function
  public.search_schools(text, integer),
  public.ensure_school(text, text, text)
to authenticated;

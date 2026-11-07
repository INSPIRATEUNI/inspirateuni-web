-- 🐧
-- Test: búsqueda y registro de colegios para la inscripción pública del Open Day.
BEGIN;
SELECT plan(14);

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'resp@colegio.pe', '{}'::jsonb);

INSERT INTO public.schools (id, name, district) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'I.E. José Carlos Mariátegui', 'San Martín de Porres'),
  ('a0000000-0000-0000-0000-000000000002', 'Colegio 100% Ciencias', 'Rímac');

-- Permisos ---------------------------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT * FROM public.search_schools('Mariátegui') $$, '42501', NULL, 'anon no puede buscar colegios');
SELECT throws_ok($$ SELECT public.ensure_school('Colegio Nuevo') $$, '42501', NULL, 'anon no puede registrar colegios');
RESET ROLE;

SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.schools), 0, 'Sin inscripción, un usuario no ve la tabla de colegios');
RESET ROLE;

-- Búsqueda ---------------------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT name FROM public.search_schools('mariátegui')),
  'I.E. José Carlos Mariátegui',
  'La búsqueda no distingue mayúsculas'
);
SELECT is(
  (SELECT id FROM public.search_schools('jose carlos mariategui')),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'La búsqueda no distingue tildes'
);
SELECT is((SELECT count(*)::int FROM public.search_schools('ma')), 0, 'Menos de 3 caracteres no devuelve nada');
SELECT is((SELECT count(*)::int FROM public.search_schools('100%')), 1, 'El % se busca como texto');
SELECT is((SELECT count(*)::int FROM public.search_schools('%%%')), 0, 'Los comodines no listan todos los colegios');

-- Registro ---------------------------------------------------------------------------------------------
SELECT is(
  public.ensure_school('  i.e.   josé carlos mariátegui '),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Un nombre existente (con otros espacios y mayúsculas) devuelve el mismo colegio'
);
SELECT is(
  public.ensure_school('I.E. Jose Carlos Mariategui'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'El mismo nombre sin tildes devuelve el mismo colegio'
);

SELECT isnt(public.ensure_school('Colegio Nuevo', 'Comas', 'UGEL 04'), NULL, 'Registra un colegio nuevo');
SELECT is(
  public.ensure_school('Colegio Nuevo'),
  (SELECT s.id FROM public.search_schools('Colegio Nuevo') s),
  'Registrar dos veces el mismo nombre es idempotente'
);
SELECT throws_ok($$ SELECT public.ensure_school('  ') $$, 'P0001', NULL, 'Un nombre vacío falla');
RESET ROLE;

SELECT is(
  (SELECT district || ' / ' || ugel FROM public.schools WHERE name = 'Colegio Nuevo'),
  'Comas / UGEL 04',
  'Guarda distrito y UGEL'
);

SELECT * FROM finish();
ROLLBACK;

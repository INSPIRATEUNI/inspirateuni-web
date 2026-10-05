-- 🐧
BEGIN;
-- Le decimos a pgTAP cuántas pruebas vamos a ejecutar en este archivo
SELECT plan(3);

-- 1. Verificamos que la tabla profiles existe
SELECT has_table('public', 'profiles', 'La tabla profiles debe existir');

-- 2. Verificamos que la función del trigger existe
SELECT has_function('public', 'handle_new_user', 'La función handle_new_user debe existir');

-- 3. Prueba de integración: Inserción en auth.users dispara el trigger
-- Insertamos el registro mínimo necesario en auth.users
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'kapu.mota@uni.pe',
    '{"first_name": "Kapu", "last_name": "Mota"}'::jsonb
);

-- Usamos results_eq para comparar lo que hay en profiles con lo que esperamos
-- (Hacemos cast de email a text porque en tu esquema es de tipo citext)
SELECT results_eq(
    $$ SELECT first_name, last_name, email::text FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111' $$,
    $$ VALUES ('Kapu'::text, 'Mota'::text, 'kapu.mota@uni.pe'::text) $$,
    'El trigger on_auth_user_created debe insertar automáticamente los datos en public.profiles'
);

-- Finalizar las pruebas
SELECT * FROM finish();
ROLLBACK;
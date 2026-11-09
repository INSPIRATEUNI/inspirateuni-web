-- ============================================================================
-- USUARIOS DEL STAFF PARA PROBAR EL BACKOFFICE DEL OPEN DAY (SOLO LOCAL)
-- ============================================================================
-- Crea dos cuentas con contraseña para entrar a /intranet/open-day:
--   staff.board@openday.test  → directiva (valida, confirma, exporta, check-in)
--   staff.admin@openday.test  → admin (además: overrides y configuración)
-- Contraseña de ambas: OpenDayLocal2026  (valor de prueba, nunca en producción)
-- Usa el período activo si existe; si no, crea uno. Idempotente.
-- Uso: make db-seed-staff

BEGIN;

DO $$
DECLARE
  v_period uuid;
  v_board_role uuid;
  v_admin_role uuid;
  v_user record;
BEGIN
  SELECT id INTO v_period FROM public.management_periods WHERE status = 'active';
  IF v_period IS NULL THEN
    INSERT INTO public.management_periods (name, start_date, end_date, status)
    VALUES ('Período local', current_date - 30, current_date + 335, 'active')
    RETURNING id INTO v_period;
  END IF;

  INSERT INTO public.organizational_roles (name, access_level, is_global)
  VALUES ('Staff Open Day (local)', 'board', false)
  ON CONFLICT (name) DO UPDATE SET access_level = excluded.access_level
  RETURNING id INTO v_board_role;

  INSERT INTO public.organizational_roles (name, access_level, is_global)
  VALUES ('Admin Open Day (local)', 'admin', true)
  ON CONFLICT (name) DO UPDATE SET access_level = excluded.access_level
  RETURNING id INTO v_admin_role;

  FOR v_user IN
    SELECT * FROM (VALUES
      ('5aff0000-0000-0000-0000-00000000b0a1'::uuid, 'staff.board@openday.test', 'Directiva', 'Local', v_board_role),
      ('5aff0000-0000-0000-0000-00000000ad31'::uuid, 'staff.admin@openday.test', 'Admin', 'Local', v_admin_role)
    ) AS t (id, email, first_name, last_name, role_id)
  LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated', v_user.email,
      extensions.crypt('OpenDayLocal2026', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('first_name', v_user.first_name, 'last_name', v_user.last_name),
      now(), now(), '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE SET encrypted_password = excluded.encrypted_password;

    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    VALUES (
      v_user.id::text, v_user.id,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email', now(), now(), now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    INSERT INTO public.position_assignments (profile_id, role_id, period_id, status)
    VALUES (v_user.id, v_user.role_id, v_period, 'active')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

COMMIT;

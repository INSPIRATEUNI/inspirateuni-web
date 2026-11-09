import type { SupabaseClient } from "@supabase/supabase-js";
import { type CurrentUser, getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

/** Resultado de las server actions del backoffice: nunca lanzan, devuelven el mensaje. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Guarded =
  | { ok: true; user: CurrentUser; supabase: SupabaseClient }
  | { ok: false; error: string };

/**
 * Comprueba en cada action quién llama (renderizar el formulario no es una barrera).
 * La BD vuelve a comprobarlo en las RPC (`is_board()` / `is_admin()`).
 */
export async function guardStaff(level: "board" | "admin"): Promise<Guarded> {
  const user = await getCurrentUser();
  if (!user)
    return { ok: false, error: "Tu sesión venció. Vuelve a ingresar." };
  const allowed = level === "admin" ? user.isAdmin : user.isBoard;
  if (!allowed)
    return { ok: false, error: "No tienes permiso para esta acción." };
  return { ok: true, user, supabase: await createClient() };
}

type DbError = { code?: string; message?: string; hint?: string | null } | null;

/** Mensaje para mostrar a partir de un error de Supabase. */
export function staffError(
  error: DbError,
  fallback = "No pudimos guardar el cambio. Inténtalo de nuevo.",
) {
  if (!error) return fallback;
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  // Las RPC del Open Day ya responden en español (P0001 con hint, o 23514/22023 en la carga de CSV)
  if (
    ["P0001", "P0002", "23514", "22023"].includes(error.code ?? "") &&
    error.message
  ) {
    return error.message;
  }
  if (error.code === "23505") return "Ya existe un registro con esos datos.";
  if (error.code === "23503")
    return "No se puede: hay datos que dependen de este registro.";
  console.error("Error del backoffice", error);
  return fallback;
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

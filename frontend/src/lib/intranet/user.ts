import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AccessLevel = "admin" | "board" | "volunteer";

export type UserRole = {
  name: string;
  accessLevel: AccessLevel;
  isGlobal: boolean;
  areaId: string | null;
  areaName: string | null;
};

export type CurrentUser = {
  id: string;
  email: string;
  firstName: string;
  fullName: string;
  /** Cargos activos del período activo, del de mayor nivel al de menor. */
  roles: UserRole[];
  /** Cargo que se muestra como rol del usuario. */
  primaryRole: UserRole | null;
  accessLevel: AccessLevel;
  isBoard: boolean;
  /** Administrador, presidente y vice: gestionan tareas de todas las áreas. */
  canManageAllAreas: boolean;
};

type ProfileRow = { first_name: string | null; last_name: string | null };

type AssignmentRow = {
  role: {
    name: string;
    access_level: AccessLevel;
    is_global: boolean;
  } | null;
  area: { id: string; name: string } | null;
};

const ACCESS_RANK: Record<AccessLevel, number> = {
  admin: 3,
  board: 2,
  volunteer: 1,
};

/**
 * Usuario de la sesión con su perfil y cargos, leído en el servidor.
 * RLS limita cada consulta a los datos propios; `cache` evita repetirla
 * entre el layout y las páginas de una misma petición.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const [profileResult, assignmentsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", claims.sub)
      .maybeSingle(),
    supabase
      .from("position_assignments")
      .select(
        "role:organizational_roles(name, access_level, is_global), area:areas(id, name), period:management_periods!inner(status)",
      )
      .eq("profile_id", claims.sub)
      .eq("status", "active")
      .eq("period.status", "active"),
  ]);

  const profile = profileResult.data as ProfileRow | null;
  const assignments = (assignmentsResult.data ??
    []) as unknown as AssignmentRow[];

  const roles = assignments
    .filter((row) => row.role)
    .map(
      (row): UserRole => ({
        name: row.role?.name ?? "",
        accessLevel: row.role?.access_level ?? "volunteer",
        isGlobal: row.role?.is_global ?? false,
        areaId: row.area?.id ?? null,
        areaName: row.area?.name ?? null,
      }),
    )
    .sort((a, b) => ACCESS_RANK[b.accessLevel] - ACCESS_RANK[a.accessLevel]);

  const email = claims.email ?? "";
  const firstName =
    profile?.first_name?.trim() || (email.split("@")[0] ?? "voluntario");
  const fullName =
    [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || email;
  const primaryRole = roles[0] ?? null;
  const accessLevel = primaryRole?.accessLevel ?? "volunteer";

  return {
    id: claims.sub,
    email,
    firstName,
    fullName,
    roles,
    primaryRole,
    accessLevel,
    isBoard: accessLevel === "admin" || accessLevel === "board",
    canManageAllAreas: roles.some(
      (role) => role.isGlobal || role.accessLevel === "admin",
    ),
  };
});

/** Texto del cargo para mostrar: "Director - Área", o un respaldo sin cargo. */
export function formatRole(role: UserRole | null) {
  if (!role) return "Sin cargo asignado";
  return role.areaName ? `${role.name} - ${role.areaName}` : role.name;
}

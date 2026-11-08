import type { JwtPayload } from "@supabase/supabase-js";

/**
 * La intranet y la inscripción al Open Day comparten Supabase Auth. Los
 * voluntarios entran con correo y contraseña; los visitantes del Open Day, con
 * un código de un solo uso (OTP). El claim `amr` del JWT dice cómo se abrió la
 * sesión: solo una sesión con contraseña da acceso a la intranet.
 */
export function isIntranetSession(claims: JwtPayload | null | undefined) {
  const amr = claims?.amr ?? [];
  return amr.some(
    (entry) =>
      (typeof entry === "string" ? entry : entry.method) === "password",
  );
}

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isIntranetSession } from "./session";

const PROTECTED_PREFIX = "/intranet";

/**
 * Refresca la sesión de Supabase y protege las rutas bajo `/intranet`: solo
 * pasan las sesiones abiertas con contraseña (las de voluntarios), no las del
 * código OTP de la inscripción al Open Day.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Valida el JWT y renueva los tokens si hace falta
  const { data } = await supabase.auth.getClaims();
  // Una sesión del Open Day (OTP) no cuenta como sesión de la intranet
  const hasIntranetSession = isIntranetSession(data?.claims);
  const { pathname, search } = request.nextUrl;

  const isProtected =
    pathname === PROTECTED_PREFIX ||
    pathname.startsWith(`${PROTECTED_PREFIX}/`);

  if (!hasIntranetSession && isProtected) {
    return redirectTo(request, response, "/login", {
      next: `${pathname}${search}`,
    });
  }

  if (hasIntranetSession && pathname === "/login") {
    return redirectTo(request, response, PROTECTED_PREFIX);
  }

  return response;
}

/** Redirige conservando las cookies que Supabase haya renovado en `response`. */
function redirectTo(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  params: Record<string, string> = {},
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();

  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

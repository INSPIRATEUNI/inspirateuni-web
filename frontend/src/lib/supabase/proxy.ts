import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIX = "/intranet";

/** Refresca la sesión de Supabase y protege las rutas bajo `/intranet`. */
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
  const hasSession = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  const isProtected =
    pathname === PROTECTED_PREFIX ||
    pathname.startsWith(`${PROTECTED_PREFIX}/`);

  if (!hasSession && isProtected) {
    return redirectTo(request, response, "/login", {
      next: `${pathname}${search}`,
    });
  }

  if (hasSession && pathname === "/login") {
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

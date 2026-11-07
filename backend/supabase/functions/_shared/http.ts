// Utilidades HTTP comunes de las Edge Functions: CORS con lista de orígenes y respuestas JSON.

const DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

/** Orígenes del sitio que pueden llamar a las funciones (ALLOWED_ORIGINS, separados por coma). */
export function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return DEV_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/** Devuelve el origen de la petición solo si está permitido. */
export function validOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  return origin && allowedOrigins().includes(origin) ? origin : null;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = validOrigin(req);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Error de negocio con un código estable que lee el frontend. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(req: Request, err: unknown): Response {
  if (err instanceof HttpError) {
    return json(req, { code: err.code, message: err.message }, err.status);
  }
  console.error(err);
  return json(req, { code: "internal", message: "Ocurrió un error inesperado" }, 500);
}

/** Comparación en tiempo constante (para secretos compartidos). */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

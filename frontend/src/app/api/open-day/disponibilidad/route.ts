import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  AVAILABILITY_TTL,
  getCachedAvailability,
} from "@/lib/open-day/availability";

const querySchema = z.object({ event: z.guid() });

/**
 * Disponibilidad pública de recorridos del Open Day.
 * Los navegadores consultan aquí (no a PostgREST): la respuesta se cachea unos
 * segundos en el servidor (`unstable_cache`) y en la CDN (`s-maxage`).
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    event: request.nextUrl.searchParams.get("event"),
  });
  if (!parsed.success) {
    return Response.json(
      { code: "invalid_input", message: "Falta el evento." },
      { status: 400 },
    );
  }

  try {
    const availability = await getCachedAvailability(parsed.data.event);
    return Response.json(availability, {
      headers: {
        "Cache-Control": `public, s-maxage=${AVAILABILITY_TTL}, stale-while-revalidate=${AVAILABILITY_TTL * 2}`,
      },
    });
  } catch {
    return Response.json(
      {
        code: "unavailable",
        message: "No pudimos cargar los recorridos. Inténtalo de nuevo.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

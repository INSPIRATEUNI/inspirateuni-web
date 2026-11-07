import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { fetchAvailability } from "./data";

/** Segundos que se reutiliza la disponibilidad antes de volver a consultar la BD. */
export const AVAILABILITY_TTL = 5;

/**
 * Cliente anónimo y sin cookies: la vista `v_tour_availability` es pública y
 * así la respuesta es la misma para todos y se puede cachear.
 */
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Disponibilidad de un evento, cacheada unos segundos en el servidor: a la BD
 * llega una consulta cada pocos segundos sin importar cuántos navegadores
 * consulten. La verdad sobre el cupo la decide siempre `hold_tour`.
 */
export const getCachedAvailability = unstable_cache(
  async (eventId: string) => ({
    sessions: await fetchAvailability(anonClient(), eventId),
    fetchedAt: new Date().toISOString(),
  }),
  ["openday-availability"],
  { revalidate: AVAILABILITY_TTL, tags: ["openday-availability"] },
);

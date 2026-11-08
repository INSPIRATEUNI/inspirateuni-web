"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { AVAILABILITY_ENDPOINT } from "@/lib/open-day/constants";
import { fetchRegistration } from "@/lib/open-day/data";
import type { Registration, TourSession } from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/client";

/** Usuario de la sesión (OTP) en el navegador; `undefined` mientras se consulta. */
export function useSessionUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return user;
}

/** Inscripción del dueño leída con RLS; `reload` tras cada RPC. */
export function useRegistration(id: string | null, enabled: boolean) {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(Boolean(id && enabled));
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    if (!id || !enabled) {
      setRegistration(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    const result = await fetchRegistration(createClient(), id);
    setRegistration(result);
    setNotFound(result === null);
    setLoading(false);
    return result;
  }, [id, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { registration, loading, notFound, reload };
}

type AvailabilityState = {
  sessions: TourSession[];
  error: string | null;
  loading: boolean;
};

/**
 * Disponibilidad desde el route handler cacheado (nunca desde PostgREST).
 * Se refresca cada `intervalMs` mientras la pestaña está visible.
 */
export function useAvailability(eventId: string, intervalMs = 10_000) {
  const [state, setState] = useState<AvailabilityState>({
    sessions: [],
    error: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `${AVAILABILITY_ENDPOINT}?event=${encodeURIComponent(eventId)}`,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message);
      setState({ sessions: body.sessions, error: null, loading: false });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "No pudimos cargar los recorridos.",
      }));
    }
  }, [eventId]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { ...state, refresh };
}

import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para componentes de cliente (usa las cookies de sesión). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  );
}

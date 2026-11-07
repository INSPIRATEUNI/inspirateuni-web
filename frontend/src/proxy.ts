import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Excluye estáticos, optimización de imágenes, archivos de public/ y la
    // disponibilidad del Open Day (pública y cacheable: no debe tocar cookies)
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/open-day/disponibilidad|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)",
  ],
};

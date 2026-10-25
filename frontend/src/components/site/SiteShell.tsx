import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { NavBar } from "./NavBar";

/** Estructura del sitio público: barra superior, contenido y pie. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <NavBar />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}

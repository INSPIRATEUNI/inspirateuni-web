"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/intranet/open-day", label: "Resumen" },
  { href: "/intranet/open-day/inscripciones", label: "Inscripciones" },
  { href: "/intranet/open-day/horarios", label: "Horarios" },
  { href: "/intranet/open-day/check-in", label: "Check-in" },
  { href: "/intranet/open-day/exportaciones", label: "Exportaciones" },
  {
    href: "/intranet/open-day/configuracion",
    label: "Configuración",
    adminOnly: true,
  },
];

/** Pestañas del backoffice; conservan el evento elegido (`?evento=`). */
export function OpenDayTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const evento = useSearchParams().get("evento");
  const tabs = TABS.filter((tab) => isAdmin || !tab.adminOnly);
  const current = tabs
    .filter(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    // min-w-0: en móvil la barra se desplaza de lado en vez de ensanchar la página
    <nav aria-label="Secciones del Open Day" className="min-w-0 print:hidden">
      <ul className="flex gap-1 overflow-x-auto border-b-2 border-border pb-px">
        {tabs.map((tab) => {
          const active = tab.href === current;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={
                  (evento ? `${tab.href}?evento=${evento}` : tab.href) as Route
                }
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-0.5 block border-b-2 px-4 py-2.5 text-sm font-bold transition-colors duration-250",
                  active
                    ? "border-magenta text-magenta-deep"
                    : "border-transparent text-foreground/70 hover:border-border hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

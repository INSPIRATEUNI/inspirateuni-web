"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/intranet/actions";
import { CloseIcon, LogoutIcon, MenuIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";
import { relayAt, relayClasses } from "@/lib/relay";
import { activeHref, intranetNav } from "./navigation";

const PANEL_ID = "menu-intranet";

type IntranetSidebarProps = {
  name: string;
  role: string;
  isBoard: boolean;
};

export function IntranetSidebar({ name, role, isBoard }: IntranetSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Cierra el menú móvil al navegar
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const items = intranetNav.filter((item) => isBoard || !item.boardOnly);
  const current = activeHref(pathname, items);

  return (
    <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex h-16 items-center justify-between px-5 lg:h-auto lg:px-6 lg:pt-6">
        <Link href="/intranet" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="Inspírate UNI, ir al inicio de la intranet"
            width={1600}
            height={434}
            className="h-10 w-auto"
          />
        </Link>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-md text-foreground transition-colors duration-250 hover:bg-magenta-soft lg:hidden"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      <div
        id={PANEL_ID}
        className={cn(
          "flex-col gap-6 px-5 pt-2 pb-6 lg:flex lg:h-[calc(100dvh-5.5rem)] lg:px-6 lg:pt-6",
          open ? "flex" : "hidden",
        )}
      >
        <div className="rounded-lg bg-background px-4 py-3">
          <p className="truncate font-extrabold">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{role}</p>
        </div>

        <nav aria-label="Intranet" className="flex-1">
          <ul className="grid gap-1">
            {items.map((item, index) => {
              const relay = relayClasses[relayAt(index)];
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-4 py-2.5 text-[0.95rem] font-bold transition-colors duration-250",
                      active
                        ? relay.active
                        : cn("text-foreground/80", relay.hover),
                    )}
                  >
                    <item.icon className="size-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-[0.95rem] font-bold text-foreground/80 transition-colors duration-250 hover:bg-blue-soft hover:text-blue-deep focus-visible:outline-2 focus-visible:outline-blue"
          >
            <LogoutIcon className="size-5 shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}

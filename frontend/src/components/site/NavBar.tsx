"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { relayAt, relayClasses } from "@/lib/relay";
import { CloseIcon, MenuIcon } from "./Icons";
import { loginLink, mainNav, visitCta } from "./navigation";

const PANEL_ID = "menu-principal";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavBar() {
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

  const links = mainNav.map((item, index) => {
    const relay = relayClasses[relayAt(index)];
    const active = isActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "block rounded-md px-4 py-2.5 text-[0.95rem] font-bold transition-colors duration-250 lg:px-3.5 lg:py-2 lg:text-sm",
            active ? relay.active : cn("text-foreground/80", relay.hover),
          )}
        >
          {item.label}
        </Link>
      </li>
    );
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-md">
      <div className="container-site flex h-(--header-h) items-center justify-between gap-6">
        <Link href="/" className="group inline-flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt="Inspírate UNI, ir al inicio"
            width={776}
            height={175}
            preload
            className="h-11 w-auto transition-transform duration-250 group-hover:-rotate-2"
          />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">{links}</ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href={loginLink.href}
            className="rounded-md px-3.5 py-2 text-sm font-bold text-foreground/80 transition-colors duration-250 hover:bg-blue-soft hover:text-blue-deep"
          >
            {loginLink.label}
          </Link>
          <Button href={visitCta.href} size="sm" bolt>
            {visitCta.label}
          </Button>
        </div>

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

      <nav
        id={PANEL_ID}
        aria-label="Principal móvil"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-surface px-5 pt-4 pb-6 shadow-soft sm:px-8 lg:hidden"
      >
        <ul className="flex flex-col gap-1">
          {links}
          <li>
            <Link
              href={loginLink.href}
              className="block rounded-md px-4 py-2.5 text-[0.95rem] font-bold text-foreground/80 transition-colors duration-250 hover:bg-blue-soft hover:text-blue-deep"
            >
              {loginLink.label}
            </Link>
          </li>
        </ul>
        <Button href={visitCta.href} size="sm" bolt className="mt-3">
          {visitCta.label}
        </Button>
      </nav>
    </header>
  );
}

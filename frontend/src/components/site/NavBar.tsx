"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { relayAt, relayClasses } from "@/lib/relay";
import { ChevronDownIcon, CloseIcon, MenuIcon } from "./Icons";
import { loginLink, mainNav, type NavItem, visitCta } from "./navigation";

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

  const linkClasses = (index: number, active: boolean) => {
    const relay = relayClasses[relayAt(index)];
    return cn(
      "block rounded-md px-4 py-2.5 text-[0.95rem] font-bold transition-colors duration-250 lg:px-3.5 lg:py-2 lg:text-sm",
      active ? relay.active : cn("text-foreground/80", relay.hover),
    );
  };

  const desktopLinks = mainNav.map((item, index) => (
    <li key={item.href}>
      {item.children ? (
        <SubMenu
          item={item}
          items={item.children}
          pathname={pathname}
          className={linkClasses(index, isActive(pathname, item.href))}
        />
      ) : (
        <Link
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={linkClasses(index, isActive(pathname, item.href))}
        >
          {item.label}
        </Link>
      )}
    </li>
  ));

  // En móvil los subprogramas se listan sangrados bajo su programa.
  const mobileLinks = mainNav.map((item, index) => (
    <li key={item.href}>
      <Link
        href={item.href}
        aria-current={pathname === item.href ? "page" : undefined}
        className={linkClasses(index, isActive(pathname, item.href))}
      >
        {item.label}
      </Link>
      {item.children && (
        <ul className="mt-1 ml-4 grid gap-1 border-l-2 border-border pl-3">
          {item.children
            .filter((child) => child.href !== item.href)
            .map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={pathname === child.href ? "page" : undefined}
                  className={linkClasses(index, pathname === child.href)}
                >
                  {child.label}
                </Link>
              </li>
            ))}
        </ul>
      )}
    </li>
  ));

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-md">
      <div className="container-site flex h-(--header-h) items-center justify-between gap-6">
        <Link href="/" className="group inline-flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt="Inspírate UNI, ir al inicio"
            width={1600}
            height={434}
            preload
            className="h-11 w-auto transition-transform duration-250 group-hover:-rotate-2"
          />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">{desktopLinks}</ul>
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
          {mobileLinks}
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

type SubMenuProps = {
  item: NavItem;
  items: NavItem[];
  pathname: string;
  className: string;
};

/** Programa con subprogramas: enlace al programa y botón que abre el panel. */
function SubMenu({ item, items, pathname, className }: SubMenuProps) {
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = `submenu-${item.href.replaceAll("/", "")}`;

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className={cn("flex items-center gap-0.5 lg:pr-1.5", className)}>
        <Link
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          {item.label}
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Abrir submenú de ${item.label}`}
          onClick={() => setOpen((value) => !value)}
          className="grid size-6 place-items-center rounded-sm"
        >
          <ChevronDownIcon
            className={cn(
              "size-3.5 transition-transform duration-250",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full left-0 z-10 pt-2"
      >
        <ul className="grid w-64 gap-1 rounded-leaf-sm border border-border bg-surface p-2 shadow-soft">
          {items.map((child) => {
            const active = pathname === child.href;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 transition-colors duration-250",
                    active
                      ? "bg-orange-soft text-orange-ink"
                      : "hover:bg-orange-soft hover:text-orange-ink",
                  )}
                >
                  <span className="block text-sm font-bold">{child.label}</span>
                  {child.description && (
                    <span className="block text-xs text-muted-foreground">
                      {child.description}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

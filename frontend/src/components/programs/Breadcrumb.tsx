import type { Route } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/site/Icons";

type BreadcrumbProps = {
  parent: { label: string; href: Route };
  current: string;
};

/** Ubica un subprograma dentro de su programa (por ejemplo, PROVOV). */
export function Breadcrumb({ parent, current }: BreadcrumbProps) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-5">
      <ol className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
        <li>
          <Link
            href={parent.href}
            className="transition-colors duration-250 hover:text-orange-ink"
          >
            {parent.label}
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRightIcon className="size-3.5" />
        </li>
        <li aria-current="page" className="text-foreground">
          {current}
        </li>
      </ol>
    </nav>
  );
}

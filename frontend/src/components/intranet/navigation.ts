import type { ComponentType, SVGProps } from "react";
import {
  CheckCircleIcon,
  ClipboardIcon,
  ClockIcon,
  HomeIcon,
  PlusIcon,
} from "@/components/site/Icons";

export type IntranetNavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Solo para la directiva (board y admin). */
  boardOnly?: boolean;
};

/** Secciones de la intranet; las rutas se crean en las issues 1.4.3 a 1.4.6. */
export const intranetNav: IntranetNavItem[] = [
  { label: "Inicio", href: "/intranet", icon: HomeIcon },
  { label: "Mis tareas", href: "/intranet/tareas", icon: ClipboardIcon },
  {
    label: "Historial de horas",
    href: "/intranet/horas/historial",
    icon: ClockIcon,
  },
  {
    label: "Nueva tarea",
    href: "/intranet/tareas/nueva",
    icon: PlusIcon,
    boardOnly: true,
  },
  {
    label: "Revisión",
    href: "/intranet/revision",
    icon: CheckCircleIcon,
    boardOnly: true,
  },
];

/** Marca activo el ítem más específico que coincide con la ruta actual. */
export function activeHref(pathname: string, items: IntranetNavItem[]) {
  return items
    .filter(({ href }) =>
      href === "/intranet"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

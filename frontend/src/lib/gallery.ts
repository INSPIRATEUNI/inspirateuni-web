import type { Route } from "next";
import type { ReactNode } from "react";
import type { RelayColor } from "@/lib/relay";

export type GalleryImage = { src?: string; alt: string };

export type GalleryIcon = "campus" | "girl" | "pin" | "heart";

/**
 * Contenido agnóstico de la galería
 */
export type GalleryItem = {
  id: string;
  title: string;
  description: string;
  details?: ReactNode;
  date?: string;
  location?: string;
  category?: { label: string; tone: RelayColor };
  image?: GalleryImage;
  icon?: GalleryIcon;
  cta?: { label: string; href: Route };
};

export type GalleryLayout = "list" | "choices";

/** Los X elementos con fecha más cercana, del más próximo al más lejano. */
export function upcoming(items: GalleryItem[], n: number) {
  return items
    .filter((item) => item.date)
    .toSorted((a, b) => Date.parse(a.date ?? "") - Date.parse(b.date ?? ""))
    .slice(0, n);
}

const TIME_ZONE = "America/Lima";

const dayFormat = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  timeZone: TIME_ZONE,
});
const monthFormat = new Intl.DateTimeFormat("es-PE", {
  month: "short",
  timeZone: TIME_ZONE,
});
const longFormat = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function formatEventDate(iso: string) {
  const date = new Date(iso);
  return {
    day: dayFormat.format(date),
    month: monthFormat.format(date).replace(".", ""),
    long: longFormat.format(date),
  };
}

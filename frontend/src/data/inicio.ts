import type { Route } from "next";
import type { GalleryImage } from "@/lib/gallery";
import type { RelayColor } from "@/lib/relay";

export type Slide = {
  id: string;
  title: string;
  description: string;
  tone: RelayColor;
  image: GalleryImage & { src: string };
  cta?: { label: string; href: Route };
};

/** Fotos reales del Open Day 2019. */
export const slides: Slide[] = [
  {
    id: "open-day",
    title: "Un día entero dentro de la UNI",
    description:
      "Talleres, laboratorios abiertos y estudiantes de las 11 facultades listos para contarte cómo es su día a día.",
    tone: "orange",
    image: {
      src: "/fotos/open-day/faua-taller-estructuras.webp",
      alt: "Escolares arman una estructura de varillas en un taller de Arquitectura",
    },
    cta: { label: "Conoce el Open Day", href: "/provov/open-day" },
  },
  {
    id: "feria",
    title: "Una feria con todas las carreras",
    description:
      "Cada escuela te muestra su carrera, sus campos de aplicación y su malla curricular, con experimentos en vivo.",
    tone: "blue",
    image: {
      src: "/fotos/open-day/fiee-demo-circuito.webp",
      alt: "Escolares prueban un circuito junto a estudiantes de la FIEE",
    },
    cta: { label: "Conoce el PROVOV", href: "/provov" },
  },
  {
    id: "inspirate-girl",
    title: "Más mujeres en carreras STEM",
    description:
      "Olvida los estereotipos y cree en ti: egresadas y alumnas te cuentan su camino en la ciencia y la ingeniería.",
    tone: "magenta",
    image: {
      src: "/fotos/voluntariado/voluntarias.webp",
      alt: "Cuatro voluntarias de Inspírate UNI posan juntas en el campus",
    },
    cta: { label: "Conoce Inspírate Girl", href: "/inspirate-girl" },
  },
  {
    id: "voluntariado",
    title: "Hecho por agentes de cambio",
    description:
      "Somos estudiantes de la UNI que un día también tuvimos dudas. En 2019 fuimos 358 voluntarios.",
    tone: "green",
    image: {
      src: "/fotos/voluntariado/equipo-con-mascota.webp",
      alt: "Equipo de voluntarios de Inspírate UNI con la mascota en el jardín del campus",
    },
    cta: { label: "Súmate al equipo", href: "/voluntariado" },
  },
];

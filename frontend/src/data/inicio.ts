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

/** Fotos de prueba*/
export const slides: Slide[] = [
  {
    id: "open-day",
    title: "Un día entero dentro de la UNI",
    description:
      "Laboratorios abiertos, guías por facultad y estudiantes listos para contarte cómo es su día a día.",
    tone: "orange",
    image: {
      src: "/fotos/prueba/carrusel-1.jpg",
      alt: "Escolares recorriendo el campus de la UNI",
    },
    cta: { label: "Conoce el Open Day", href: "/OpenDay" },
  },
  {
    id: "charlas",
    title: "Charlas de tú a tú",
    description:
      "Escucha a estudiantes de cada carrera hablar sin filtros de lo que estudian y de lo que viene después.",
    tone: "blue",
    image: {
      src: "/fotos/prueba/carrusel-2.jpg",
      alt: "Estudiante conversando con un grupo de escolares",
    },
    cta: { label: "Mira los eventos", href: "/eventos" },
  },
  {
    id: "inspirate-girl",
    title: "Más mujeres en la ingeniería",
    description:
      "Ingenieras y científicas te cuentan su camino para que te animes a dar el paso.",
    tone: "magenta",
    image: {
      src: "/fotos/prueba/carrusel-3.jpg",
      alt: "Estudiantes de ingeniería trabajando en equipo",
    },
    cta: { label: "Conoce Inspírate Girl", href: "/Igirl" },
  },
  {
    id: "voluntariado",
    title: "Hecho por voluntarios",
    description:
      "Somos estudiantes de la UNI que un día también tuvimos dudas. Ahora te acompañamos a ti.",
    tone: "green",
    image: {
      src: "/fotos/prueba/carrusel-4.jpg",
      alt: "Voluntarios de Inspírate UNI reunidos en el campus",
    },
    cta: { label: "Súmate al equipo", href: "/voluntariado" },
  },
];

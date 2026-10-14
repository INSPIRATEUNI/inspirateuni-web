import type { Route } from "next";
import type { GalleryImage } from "@/lib/gallery";
import type { RelayColor } from "@/lib/relay";

/** Fuente: Perfil Completo de Inspírate UNI v0.1, sección 6. */

export type Componente = {
  id: string;
  name: string;
  kind: "Operación" | "Programa";
  description: string;
  tone: RelayColor;
  stats: { value: string; label: string }[];
  image?: GalleryImage & { src: string };
  cta?: { label: string; href: Route };
};

export const componentes: Componente[] = [
  {
    id: "open-day",
    name: "Open Day",
    kind: "Operación",
    description:
      "Un día entero en el campus de la UNI: recorridos por las 11 facultades, feria de carreras, talleres vivenciales y charlas para jóvenes y padres.",
    tone: "orange",
    stats: [
      { value: "6000", label: "Escolares esperados (2023)" },
      { value: "11", label: "Facultades" },
    ],
    image: {
      src: "/fotos/open-day/faua-taller-estructuras.webp",
      alt: "Escolares arman una estructura de varillas en un taller de Arquitectura",
    },
    cta: { label: "Ver Open Day", href: "/provov/open-day" },
  },
  {
    id: "visitas-guiadas",
    name: "Visitas guiadas",
    kind: "Programa",
    description:
      "Recorridos por la UNI para colegios, academias y grupos de estudio, y visitas inspiradas que llevan la orientación vocacional a tu colegio.",
    tone: "blue",
    stats: [
      { value: "+450", label: "Participantes en la UNI (2023)" },
      { value: "+12", label: "Colegios visitados (2023)" },
    ],
    image: {
      src: "/fotos/open-day/fiee-recorrido-aerogenerador.webp",
      alt: "Grupo de escolares recorre los exteriores de la FIEE junto a un aerogenerador",
    },
    cta: { label: "Pide una visita", href: "/provov/visitas-guiadas" },
  },
  {
    id: "ponencias",
    name: "Ponencias Inspiradoras",
    kind: "Programa",
    description:
      "Divulgadores, egresados destacados y agrupaciones estudiantiles comparten su camino para motivarte a desarrollar tu máximo potencial.",
    tone: "magenta",
    stats: [
      { value: "+732", label: "Participantes con egresados (2023)" },
      { value: "+613", label: "En ponencias virtuales (2023)" },
    ],
    image: {
      src: "/fotos/open-day/fieecs-grupo-auditorio.webp",
      alt: "Escolares y voluntarios reunidos en un auditorio de la FIEECS",
    },
  },
  {
    id: "ovpgs",
    name: "Orientación virtual (OVPGS)",
    kind: "Operación",
    description:
      "Orientaciones vocacionales virtuales, personalizadas o grupales, con un embajador de la especialidad que te interesa.",
    tone: "green",
    stats: [
      { value: "+100", label: "Escolares de todo el país (2021)" },
      { value: "24 h", label: "De disponibilidad en 2026" },
    ],
  },
];

/** Ponentes que ya pasaron por las Ponencias Inspiradoras. */
export const ponentesFrecuentes = [
  "Hugo X",
  "Chugo X",
  "Lenin Tamayo",
  "Henry Spencer",
  "Alejandra Ruiz León",
  "Damián Pedraza",
  "Aldo Bartra",
  "José Aguirre",
  "Sergio R. Santa María",
];

export const ponencias = {
  proyectos: [
    "Ponentes inspiradores: youtubers, divulgadores, deportistas e invitados extraordinarios",
    "Egresados destacados de la UNI",
    "Agrupaciones y organizaciones estudiantiles",
  ],
};

export const ovpgs = {
  inicio: "2026-12-05T00:00:00-05:00",
  description:
    "Desde el 5 de diciembre, estudiantes de las distintas especialidades estarán disponibles las 24 horas para orientarte de forma virtual.",
};

export const openDay = {
  hashtag: "#OpenDayUNI",
  audience: "Escolares de 3.º, 4.º y 5.º de secundaria",
  place: "Campus UNI, Av. Túpac Amaru 210, Rímac",
  description:
    "Una experiencia vivencial en el campus para jóvenes interesados en carreras STEAM. Te ayudamos a identificar tu vocación y a decidir con más seguridad.",
  actividades: [
    {
      title: "Tours por las facultades",
      text: "Recorre las 11 facultades guiado por estudiantes de cada carrera.",
    },
    {
      title: "Feria de carreras",
      text: "Stands donde cada escuela presenta su carrera, campos de aplicación y malla curricular.",
    },
    {
      title: "Talleres vivenciales",
      text: "Experiencias académicas, culturales e institucionales para probar con tus manos.",
    },
    {
      title: "Charlas y ponencias",
      text: "Charlas para jóvenes y padres, y ponencias de figuras inspiradoras.",
    },
  ],
};

export type FotoFacultad = GalleryImage & { src: string; faculty: string };

/** Galería del Open Day 2019 por facultad. */
export const galeriaOpenDay: FotoFacultad[] = [
  {
    faculty: "FAUA",
    src: "/fotos/open-day/faua-taller-equipo.webp",
    alt: "Escolares construyen una estructura con sorbetes en el taller de Arquitectura",
  },
  {
    faculty: "FAUA",
    src: "/fotos/open-day/faua-maquetas.webp",
    alt: "Escolares observan maquetas de arquitectura en el patio de la FAUA",
  },
  {
    faculty: "FC",
    src: "/fotos/open-day/fc-quimica-laboratorio.webp",
    alt: "Un estudiante de Química explica a escolares dentro del laboratorio",
  },
  {
    faculty: "FIEE",
    src: "/fotos/open-day/fiee-demo-agua.webp",
    alt: "Demostración de un circuito con un recipiente de agua en la FIEE",
  },
  {
    faculty: "FIEE",
    src: "/fotos/open-day/fiee-demo-circuito.webp",
    alt: "Escolares prueban un circuito junto a estudiantes de la FIEE",
  },
  {
    faculty: "FIEECS",
    src: "/fotos/open-day/fieecs-stand-egresados.webp",
    alt: "Stand de egresados destacados de Estadística e Ingeniería Económica",
  },
  {
    faculty: "FIEECS",
    src: "/fotos/open-day/fieecs-laboratorio-computo.webp",
    alt: "Escolares en un laboratorio de cómputo de la FIEECS",
  },
  {
    faculty: "FAUA",
    src: "/fotos/open-day/faua-exposicion-maquetas.webp",
    alt: "Vista desde arriba de una exposición de maquetas con escolares alrededor",
  },
];

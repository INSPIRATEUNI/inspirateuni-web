import type { GalleryItem } from "@/lib/gallery";

/** Datos de ejemplo hasta conectar la tabla de eventos en Supabase. */
export const eventos: GalleryItem[] = [
  {
    id: "open-day-2026",
    title: "Open Day UNI 2026",
    description:
      "Recorre el campus, entra a los laboratorios y conversa con estudiantes de todas las facultades en un solo día.",
    details:
      "Llega con tu familia: habrá guías por facultad, demostraciones en vivo y un espacio para resolver tus dudas sobre el examen de admisión.",
    date: "2026-11-14T09:00:00-05:00",
    location: "Campus UNI, Rímac",
    category: { label: "Presencial", tone: "orange" },
    image: {
      src: "/fotos/prueba/evento-open-day-2026.jpg",
      alt: "Estudiantes recorriendo el campus durante el Open Day",
    },
    cta: { label: "Quiero ir", href: "/OpenDay" },
  },
  {
    id: "charla-elegir-carrera",
    title: "Cómo elegir tu carrera sin miedo",
    description:
      "Una charla para descubrir qué te mueve y cómo se conecta con las ingenierías, contada por estudiantes como tú.",
    date: "2026-10-22T18:00:00-05:00",
    location: "En línea",
    category: { label: "Charlas", tone: "blue" },
    image: {
      src: "/fotos/prueba/evento-charla-elegir-carrera.jpg",
      alt: "Estudiante dando una charla frente a escolares",
    },
  },
  {
    id: "mujeres-en-ciencia",
    title: "Mujeres que inspiran ciencia",
    description:
      "Ingenieras y científicas comparten su camino, sus retos y lo que les hubiera gustado saber a tu edad.",
    date: "2026-10-30T16:00:00-05:00",
    location: "Auditorio de la Facultad de Ciencias",
    category: { label: "Inspírate Girl", tone: "magenta" },
    image: {
      src: "/fotos/prueba/evento-mujeres-en-ciencia.jpg",
      alt: "Panel de ingenieras conversando con escolares",
    },
    cta: { label: "Conoce Inspírate Girl", href: "/Igirl" },
  },
  {
    id: "taller-robotica",
    title: "Taller de robótica para escolares",
    description:
      "Arma y programa tu primer robot en equipo, guiado por estudiantes de Ingeniería Mecatrónica.",
    date: "2026-11-07T10:00:00-05:00",
    location: "Laboratorio de Mecatrónica",
    category: { label: "Programa", tone: "green" },
    image: {
      src: "/fotos/prueba/evento-taller-robotica.jpg",
      alt: "Escolares armando un robot en el laboratorio",
    },
  },
];

export const programas: GalleryItem[] = [
  {
    id: "open-day",
    title: "Open Day",
    description:
      "Un día de puertas abiertas para que vivas la UNI por dentro antes de postular.",
    icon: "campus",
    cta: { label: "Ver Open Day", href: "/OpenDay" },
  },
  {
    id: "inspirate-girl",
    title: "Inspírate Girl",
    description:
      "Charlas y mentorías con mujeres en ciencia e ingeniería para que te animes a dar el paso.",
    icon: "girl",
    cta: { label: "Ver Inspírate Girl", href: "/Igirl" },
  },
  {
    id: "visitas-guiadas",
    title: "Visitas guiadas",
    description:
      "Agenda una visita con tu colegio y recorre las facultades acompañado por voluntarios.",
    icon: "pin",
    cta: { label: "Pide una visita", href: "/ovpgs" },
  },
  {
    id: "voluntariado",
    title: "Voluntariado",
    description:
      "Si ya estás en la UNI, súmate al equipo y ayuda a otros escolares a encontrar su camino.",
    icon: "heart",
    cta: { label: "Quiero ser voluntario", href: "/voluntariado" },
  },
];

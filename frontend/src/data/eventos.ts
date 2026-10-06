import type { GalleryItem } from "@/lib/gallery";
import { ovpgs } from "./provov";
import { convocatoria } from "./voluntariado";

/**
 * Eventos confirmados en el Perfil de Inspírate UNI v0.1, hasta conectar la
 * tabla de eventos en Supabase. Lo que aún no tiene fecha va sin `date`.
 */
export const eventos: GalleryItem[] = [
  {
    id: "convocatoria-voluntarios-2026",
    title: "Convocatoria de voluntarios 2026",
    description:
      "Si estudias en la UNI, súmate como agente de cambio para el Open Day y los programas de Inspírate.",
    details: `${convocatoria.label}. Incluye 4 módulos de capacitación y horas extracurriculares certificadas.`,
    date: convocatoria.end,
    location: "Universidad Nacional de Ingeniería",
    category: { label: "Voluntariado", tone: "green" },
    image: {
      src: "/fotos/voluntariado/equipo-con-mascota.webp",
      alt: "Equipo de voluntarios de Inspírate UNI con la mascota en el jardín del campus",
    },
    cta: { label: "Quiero ser voluntario", href: "/voluntariado" },
  },
  {
    id: "ovpgs-2026",
    title: "Inicia la orientación virtual (OVPGS)",
    description:
      "Orientaciones vocacionales virtuales, personalizadas o grupales, con estudiantes de las distintas especialidades.",
    details: ovpgs.description,
    date: ovpgs.inicio,
    allDay: true,
    location: "En línea",
    category: { label: "PROVOV", tone: "orange" },
    image: {
      src: "/fotos/open-day/fieecs-laboratorio-computo.webp",
      alt: "Estudiante orienta a escolares en un laboratorio de cómputo",
    },
    cta: { label: "Conoce el PROVOV", href: "/provov" },
  },
  {
    id: "open-day-2026",
    title: "Open Day UNI 2026",
    description:
      "Un día para recorrer las 11 facultades, visitar la feria de carreras y vivir talleres en el campus. Fecha por anunciar.",
    details:
      "En 2026 la Feria de Carreras y la Feria Cultural comparten el Coliseo. Síguenos en redes con #OpenDayUNI para enterarte de la fecha.",
    location: "Campus UNI, Rímac",
    category: { label: "PROVOV", tone: "orange" },
    image: {
      src: "/fotos/open-day/fc-quimica-demostracion.webp",
      alt: "Escolares y padres frente al stand de Química en la feria de carreras",
    },
    cta: { label: "Ver Open Day", href: "/provov/open-day" },
  },
  {
    id: "dia-de-la-nina",
    title: "Día de la Niña",
    description:
      "Niñas y adolescentes visitan la UNI y eligen qué carreras conocer, con visitas guiadas y talleres. Fecha por anunciar.",
    details:
      "Se conmemora cada 11 de octubre. Facultades propuestas: FIM, FIC, FIIS, FC, FIA y FIEECS.",
    location: "Campus UNI, Rímac",
    category: { label: "Inspírate Girl", tone: "magenta" },
    image: {
      src: "/fotos/open-day/escolares-laboratorio-quimica.webp",
      alt: "Escolares escuchan a un estudiante en el laboratorio de Química",
    },
    cta: { label: "Conoce Inspírate Girl", href: "/inspirate-girl" },
  },
];

import type { Route } from "next";
import type { GalleryImage } from "@/lib/gallery";
import type { RelayColor } from "@/lib/relay";

/** Fuente: Perfil Completo de Inspírate UNI v0.1. */

export const lemas = {
  principal: "Que tus logros inspiren al mundo",
  provov: "Vive la experiencia UNI",
  igirl: "Un joven que inspira, inspira a una nación",
};

export const mision =
  "Brindar orientaciones vocacionales a jóvenes con iniciativas vivenciales y virtuales, para que estén plenamente informados y decidan con acierto su futuro profesional.";

export const vision =
  "Ser una asociación estudiantil posicionada y referente nacional en asesoramiento vocacional, con proyectos estructurados, eficientes e innovadores que fomenten el compromiso social de los universitarios.";

export const porQue = [
  "Canalizar la pasión por las vocaciones en espacios seguros para intercambiar opiniones.",
  "Promover las carreras universitarias para arreglar el ascensor social latinoamericano.",
  "Disminuir la deserción universitaria afianzando la identidad con la carrera.",
];

export const valores = [
  {
    name: "Ética",
    description:
      "Integridad y principios en todas nuestras actividades y eventos.",
  },
  {
    name: "Trabajo en equipo",
    description:
      "Sinergia entre agentes de cambio para lograr objetivos comunes.",
  },
  {
    name: "Servicio excepcional",
    description: "Una experiencia única y de calidad para cada joven.",
  },
  {
    name: "Vocación de servicio",
    description:
      "Actitud de servicio con la comunidad universitaria y la sociedad.",
  },
];

/** Cifras de cabecera, tomadas del impacto histórico. */
export const cifras = [
  { value: "+6500", label: "Escolares en el Open Day 2019" },
  { value: "358", label: "Voluntarios en una edición" },
  { value: "11", label: "Facultades por recorrer" },
  { value: "7", label: "Ediciones desde 2017" },
];

export type Edicion = {
  year: number;
  mode: "Presencial" | "Virtual";
  students: string;
  volunteers: string;
  note?: string;
};

/** Impacto histórico del PROVOV (brochure). */
export const ediciones: Edicion[] = [
  { year: 2017, mode: "Presencial", students: "+2500", volunteers: "+320" },
  {
    year: 2019,
    mode: "Presencial",
    students: "+6500",
    volunteers: "358",
    note: "Primer proyecto independiente del PROVOV",
  },
  { year: 2020, mode: "Virtual", students: "+2000", volunteers: "144" },
  {
    year: 2021,
    mode: "Virtual",
    students: "+2000",
    volunteers: "113",
    note: "La orientación virtual atendió a +100 escolares",
  },
  {
    year: 2022,
    mode: "Presencial",
    students: "+2500",
    volunteers: "200",
    note: "Regreso a la presencialidad",
  },
  {
    year: 2023,
    mode: "Presencial",
    students: "+5000",
    volunteers: "+250",
    note: "15 de noviembre, con visitas guiadas, ponencias y ferias",
  },
  {
    year: 2025,
    mode: "Presencial",
    students: "+4000",
    volunteers: "+200",
    note: "25 de julio",
  },
];

export type Programa = {
  id: string;
  name: string;
  fullName: string;
  description: string;
  tone: RelayColor;
  image: GalleryImage & { src: string };
  href: Route;
  cta: string;
};

/** Los dos programas con página propia. */
export const programas: Programa[] = [
  {
    id: "provov",
    name: "PROVOV",
    fullName: "Programa Vivencial de Orientaciones Vocacionales",
    description:
      "Enciende la chispa de la vocación con experiencias vivenciales: el Open Day, visitas guiadas, ponencias inspiradoras y orientación virtual.",
    tone: "orange",
    image: {
      src: "/fotos/open-day/fc-quimica-stand.webp",
      alt: "Voluntaria de Química explica un experimento a escolares en la feria de carreras",
    },
    href: "/provov",
    cta: "Conoce el PROVOV",
  },
  {
    id: "inspirate-girl",
    name: "Inspírate Girl",
    fullName: "Mujeres en carreras STEM",
    description:
      "Inspira a niñas, adolescentes y jóvenes a incursionar en ciencia, tecnología, ingeniería y matemáticas, rompiendo estereotipos.",
    tone: "magenta",
    image: {
      src: "/fotos/voluntariado/marco-voluntarias.webp",
      alt: "Cuatro voluntarias de Inspírate UNI posan dentro del marco del logo",
    },
    href: "/inspirate-girl",
    cta: "Conoce Inspírate Girl",
  },
];

/** Línea de ayuda social; sin página propia por ahora. */
export const asiri = {
  name: "ASIRI",
  lema: "Regalemos sonrisas",
  description:
    "Nuestra línea de ayuda social: bienestar, educación, medio ambiente y ayuda humanitaria junto a la comunidad universitaria.",
  acciones: [
    "NAVIUNI: campaña navideña en Balcones del Paraíso (Villa María del Triunfo) y Casa de los Pitufos (Comas)",
    "Limpieza de playas junto a ADEIA",
    "Visitas a casas hogar y campañas de vaso de leche",
    "Rescate y adopción de animales junto a ADRA-UNI",
  ],
};

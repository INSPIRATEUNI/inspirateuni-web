import type { RegistrationKind, TemplateKind } from "./types";

/**
 * Declaraciones que se aceptan antes de enviar la inscripción. Cada una tiene su
 * documento descargable (plantilla de `template`, que se sube en Configuración).
 * Si cambia algún texto, hay que subir `TERMS_VERSION` (`constants.ts`): es lo que
 * queda registrado al enviar.
 */
export type Condition = {
  template: TemplateKind;
  title: string;
  intro: string;
  items: string[];
  /** Párrafos que van después de la lista. */
  notes: string[];
};

const PRIVACY_NOTE =
  "El tratamiento de las imágenes y datos personales se realiza conforme a la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento. Puedo solicitar el acceso, la rectificación o el retiro de esta autorización escribiendo por el chat de la inscripción o por los canales oficiales de Inspírate UNI; el retiro no afecta a las publicaciones realizadas antes de la solicitud.";

const IMAGE_USE =
  "con fines de difusión académica e institucional, en medios digitales y redes sociales oficiales, sin fines comerciales y sin derecho a contraprestación económica.";

const SCHOOL: Condition[] = [
  {
    template: "commitment_letter",
    title: "Declaración de responsabilidad del docente acompañante",
    intro:
      "Como representante de la delegación, declaro en mi nombre y en el de los docentes o cuidadores registrados nuestro compromiso de:",
    items: [
      "Acompañar y supervisar permanentemente al grupo de estudiantes durante todo el evento.",
      "Cumplir y hacer cumplir las indicaciones de los organizadores, voluntarios y personal de seguridad.",
      "Respetar la puerta de ingreso, los horarios y los recorridos asignados, comprendiendo que la llegada tarde puede implicar la pérdida del recorrido programado.",
      "Garantizar una conducta respetuosa, responsable y de sana convivencia por parte de los estudiantes a nuestro cargo.",
      "Servir como punto de contacto con el equipo organizador y comunicarle de inmediato cualquier incidencia.",
    ],
    notes: [
      "Declaro además que la institución educativa ha autorizado la asistencia de la delegación y cuenta con el permiso de los padres, madres o apoderados de los estudiantes menores de edad.",
    ],
  },
  {
    template: "guardian_declaration",
    title: "Declaración jurada de cuidado de instalaciones y bienes",
    intro:
      "Declaro bajo juramento que informaremos y supervisaremos a los estudiantes a nuestro cargo para que:",
    items: [
      "Cuiden y hagan uso adecuado de las instalaciones, equipos, mobiliario y demás bienes de la Universidad Nacional de Ingeniería.",
      "No manipulen equipos ni materiales sin la autorización del personal responsable.",
      "Mantengan bajo su cuidado sus pertenencias personales; la organización no se responsabiliza por su pérdida.",
    ],
    notes: [
      "Nos comprometemos a informar de inmediato cualquier daño y a asumir la responsabilidad que corresponda conforme a ley por los daños que, por acción u omisión, ocasionen los integrantes de la delegación.",
    ],
  },
  {
    template: "consent",
    title: "Autorización de uso de imagen",
    intro: `Autorizo a la Universidad Nacional de Ingeniería y a Inspírate UNI a capturar, registrar y utilizar fotografías y videos de los integrantes de la delegación de nuestra institución durante el Open Day UNI 2026, ${IMAGE_USE}`,
    items: [],
    notes: [
      "Respecto de los estudiantes menores de edad, declaro que la institución cuenta con la autorización de sus padres, madres o apoderados. Me comprometo a identificar ante el equipo organizador, antes de iniciar las actividades, a quienes no cuenten con ella.",
      PRIVACY_NOTE,
    ],
  },
];

function individual(hasMinors: boolean): Condition[] {
  return [
    {
      template: "commitment_letter",
      title: "Carta de compromiso y aceptación de condiciones",
      intro:
        "En mi nombre y en el de las personas de esta inscripción, declaramos nuestro compromiso de participar en el Open Day UNI 2026 aceptando las siguientes condiciones:",
      items: [
        "Asistir en la fecha y horario establecidos e ingresar por la puerta asignada.",
        "Presentar el código de acceso y el documento de identidad cuando se soliciten.",
        "Seguir las indicaciones de los organizadores, voluntarios y personal de seguridad durante todo el evento.",
        "Respetar la programación y los turnos de actividades, comprendiendo que la llegada tarde puede implicar la pérdida del recorrido programado.",
        "Mantener una conducta respetuosa y de sana convivencia con todos los participantes.",
        ...(hasMinors
          ? [
              "El adulto acompañante permanecerá con los menores de edad y los supervisará durante todo el evento.",
            ]
          : []),
      ],
      notes: [],
    },
    {
      template: "guardian_declaration",
      title: "Declaración jurada de cuidado de instalaciones y bienes",
      intro:
        "Declaramos bajo juramento que durante nuestra participación en el Open Day UNI 2026:",
      items: [
        "Cuidaremos y haremos uso adecuado de las instalaciones, equipos, mobiliario y demás bienes de la Universidad Nacional de Ingeniería.",
        "No manipularemos equipos ni materiales sin la autorización del personal responsable.",
        "Informaremos de inmediato cualquier daño y asumiremos la responsabilidad que corresponda conforme a ley por los daños que, por acción u omisión, podamos ocasionar.",
        "Mantendremos bajo nuestro cuidado nuestras pertenencias personales; la organización no se responsabiliza por su pérdida.",
      ],
      notes: hasMinors
        ? [
            "Por los menores de edad de esta inscripción, estos compromisos los asume el adulto responsable de ellos.",
          ]
        : [],
    },
    {
      template: "consent",
      title: "Autorización de uso de imagen",
      intro: `Autorizo a la Universidad Nacional de Ingeniería y a Inspírate UNI a capturar, registrar y utilizar fotografías y videos en los que ${
        hasMinors
          ? "aparezcamos yo, los menores de edad y las demás personas de esta inscripción"
          : "aparezcamos yo y las demás personas de esta inscripción"
      } durante el Open Day UNI 2026, ${IMAGE_USE}`,
      items: [],
      notes: [
        ...(hasMinors
          ? [
              "Respecto de cada menor de edad, declaro que soy mayor de edad y que soy su padre, madre o apoderado legal, o que cuento con la autorización expresa de quien ejerce su patria potestad o tutela.",
            ]
          : []),
        "Declaro que las demás personas mayores de edad de esta inscripción conocen y aceptan esta autorización.",
        PRIVACY_NOTE,
      ],
    },
  ];
}

/** `hasMinors` solo cambia los textos de las personas libres. */
export function conditionsFor(
  kind: RegistrationKind,
  hasMinors: boolean,
): Condition[] {
  return kind === "school" ? SCHOOL : individual(hasMinors);
}

type DownloadableDocument = {
  kind: TemplateKind;
  title: string;
  /** Solo se pide si en la inscripción hay menores de edad. */
  onlyMinors?: boolean;
};

/**
 * Los documentos que cada grupo descarga, firma y lleva el día del evento, en el
 * orden en que se muestran. Los que además se aceptan en pantalla usan el mismo
 * título que su declaración.
 */
export const DOCUMENTS: Record<RegistrationKind, DownloadableDocument[]> = {
  school: [
    {
      kind: "presentation_letter",
      title: "Carta de presentación y autorización de delegación escolar",
    },
    {
      kind: "commitment_letter",
      title: "Declaración de responsabilidad del docente acompañante",
    },
    {
      kind: "guardian_declaration",
      title: "Declaración jurada de cuidado de instalaciones y bienes",
    },
    { kind: "consent", title: "Autorización de uso de imagen" },
  ],
  individual: [
    {
      kind: "commitment_letter",
      title: "Carta de compromiso y aceptación de condiciones",
    },
    {
      kind: "guardian_declaration",
      title: "Declaración jurada de cuidado de instalaciones y bienes",
    },
    { kind: "consent", title: "Autorización de uso de imagen" },
    {
      kind: "minor_authorization",
      title: "Autorización de participación del menor",
      onlyMinors: true,
    },
  ],
};

/** Nombre del documento descargable según a quién va. */
export function templateLabel(audience: RegistrationKind, kind: TemplateKind) {
  return DOCUMENTS[audience].find((d) => d.kind === kind)?.title ?? "Documento";
}

/** Las plantillas que le tocan a una inscripción, ya ordenadas. */
export function templatesFor<T extends { kind: TemplateKind }>(
  audience: RegistrationKind,
  hasMinors: boolean,
  templates: T[],
): T[] {
  return DOCUMENTS[audience]
    .filter((d) => hasMinors || !d.onlyMinors)
    .flatMap((d) => templates.filter((t) => t.kind === d.kind));
}

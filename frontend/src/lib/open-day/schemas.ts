import { z } from "zod";
import { ageOn, todayInLima } from "./format";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** aaaa-mm-dd que existe en el calendario (descarta 30/02 o 31/04). */
function isCalendarDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d &&
    y >= 1900
  );
}

const email = z
  .email("Escribe un correo válido.")
  .trim()
  .toLowerCase()
  .max(254, "El correo es demasiado largo.");

// Acceso con código de un solo uso (OTP) -------------------------------------------------------

export const otpEmailSchema = z.object({ email });
export type OtpEmailValues = z.infer<typeof otpEmailSchema>;

export const otpCodeSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código tiene 6 dígitos."),
});
export type OtpCodeValues = z.infer<typeof otpCodeSchema>;

// Datos de la inscripción -----------------------------------------------------------------------

const contactName = z
  .string()
  .trim()
  .min(3, "Escribe tu nombre completo.")
  .max(120, "El nombre puede tener hasta 120 caracteres.");

const contactPhone = z
  .string()
  .trim()
  .min(1, "Escribe un celular de contacto.")
  .max(20, "El celular puede tener hasta 20 caracteres.")
  .regex(/^\+?[\d\s-]{6,}$/, "Celular no válido.");

/** Paso "Datos y cantidades" del colegio; `maxVisitors` viene del evento. */
export function schoolDetailsSchema(maxVisitors: number | null) {
  return z.object({
    schoolId: z.guid("Elige tu colegio o regístralo."),
    contactName,
    contactEmail: email,
    contactPhone,
    expectedVisitors: z
      .number("Indica cuántos escolares irán.")
      .int("Usa un número entero.")
      .min(1, "Debe ir al menos un escolar.")
      .max(
        maxVisitors ?? 2000,
        maxVisitors
          ? `El máximo por inscripción es ${maxVisitors} escolares.`
          : "Revisa la cantidad.",
      ),
  });
}
export type SchoolDetailsValues = z.infer<
  ReturnType<typeof schoolDetailsSchema>
>;

export const newSchoolSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Escribe el nombre del colegio.")
    .max(200, "El nombre puede tener hasta 200 caracteres."),
  district: z.string().trim().max(80),
  ugel: z.string().trim().max(80),
});
export type NewSchoolValues = z.infer<typeof newSchoolSchema>;

/** Paso "Tus datos" de una persona libre; `maxVisitors` es el tope del evento (sin contar apoderados). */
export function individualDetailsSchema(maxVisitors: number) {
  return z.object({
    contactName,
    contactEmail: email,
    contactPhone,
    expectedVisitors: z
      .number("Indica cuántas personas asistirán.")
      .int("Usa un número entero.")
      .min(1, "Debe asistir al menos una persona.")
      .max(
        maxVisitors,
        `El máximo por inscripción es ${maxVisitors} ${maxVisitors === 1 ? "persona" : "personas"}.`,
      ),
  });
}
export type IndividualDetailsValues = z.infer<
  ReturnType<typeof individualDetailsSchema>
>;

// Personas ----------------------------------------------------------------------------------------

export const docTypes = ["dni", "ce", "passport", "other"] as const;
export const attendeeRoles = ["visitor", "chaperone", "guardian"] as const;

export const personSchema = z
  .object({
    docType: z.enum(docTypes, "Elige el tipo de documento."),
    docNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(4, "Escribe el número de documento.")
      .max(20, "El documento es demasiado largo."),
    firstName: z.string().trim().min(1, "Escribe los nombres.").max(80),
    lastName: z.string().trim().min(1, "Escribe los apellidos.").max(80),
    birthDate: z
      .string()
      .regex(ISO_DATE, "Escribe la fecha de nacimiento.")
      .refine(isCalendarDate, "Esa fecha no existe.")
      .refine(
        (value) => value <= todayInLima(),
        "La fecha no puede ser futura.",
      ),
    grade: z.string().trim().max(40),
    email: z.union([z.literal(""), email]),
    phone: z
      .string()
      .trim()
      .max(20)
      .refine(
        (value) => value === "" || /^\+?[\d\s-]{6,}$/.test(value),
        "Teléfono no válido.",
      ),
    role: z.enum(attendeeRoles),
    relationship: z.string().trim().max(60),
  })
  .superRefine((person, ctx) => {
    if (person.docType === "dni" && !/^\d{8}$/.test(person.docNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["docNumber"],
        message: "El DNI tiene 8 dígitos.",
      });
    }
  });
export type PersonValues = z.infer<typeof personSchema>;

/** Representante del colegio; su nombre, correo y celular ya son los del contacto. */
export const representativeSchema = z
  .object({
    role: z
      .string()
      .trim()
      .min(2, "Escribe su cargo (director, coordinador, profesor…).")
      .max(60),
    docType: z.enum(docTypes, "Elige el tipo de documento."),
    docNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(4, "Escribe el número de documento.")
      .max(20, "El documento es demasiado largo."),
    attends: z.boolean(),
  })
  .superRefine((rep, ctx) => {
    if (rep.docType === "dni" && !/^\d{8}$/.test(rep.docNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["docNumber"],
        message: "El DNI tiene 8 dígitos.",
      });
    }
  });
export type RepresentativeValues = z.infer<typeof representativeSchema>;

/**
 * Representante y tutores de un colegio (`save_school_people`). Los escolares no
 * se registran. Exige al menos un tutor, contando al representante si asiste.
 */
export function schoolPeopleSchema(eventDate: string) {
  return z
    .object({
      representative: representativeSchema,
      people: z.array(personSchema),
    })
    .superRefine(({ representative, people }, ctx) => {
      if (people.length === 0 && !representative.attends) {
        ctx.addIssue({
          code: "custom",
          path: ["people"],
          message:
            "Registra al menos un tutor, o marca que el representante asistirá.",
        });
      }
      const seen = new Map<string, number>();
      people.forEach((person, index) => {
        const doc = person.docNumber.trim().toUpperCase();
        const key = `${person.docType}:${doc}`;
        const first = seen.get(key);
        if (first !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "docNumber"],
            message: `Este documento ya está en la fila ${first + 1}.`,
          });
        } else {
          seen.set(key, index);
        }
        if (
          representative.attends &&
          key ===
            `${representative.docType}:${representative.docNumber.trim().toUpperCase()}`
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "docNumber"],
            message: "El representante ya cuenta como tutor: quita esta fila.",
          });
        }
        if (
          ISO_DATE.test(person.birthDate) &&
          ageOn(person.birthDate, eventDate) < 18
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "birthDate"],
            message: "Los tutores deben ser mayores de edad el día del evento.",
          });
        }
        if (person.phone.trim() === "") {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "phone"],
            message: "Escribe su celular.",
          });
        }
      });
    });
}
export type SchoolPeopleValues = {
  representative: RepresentativeValues;
  people: PersonValues[];
};

/**
 * Lista de personas de una inscripción. Valida en el cliente lo mismo que
 * `set_attendees`/`submit_registration` (edad de los adultos en la fecha del
 * evento, documentos repetidos); la RPC siempre tiene la última palabra.
 */
export function peopleSchema(options: {
  eventDate: string;
  kind: "school" | "individual";
  expectedVisitors: number;
}) {
  return z
    .object({ people: z.array(personSchema) })
    .superRefine(({ people }, ctx) => {
      const seen = new Map<string, number>();
      let visitors = 0;
      if (
        options.kind === "individual" &&
        people.some(
          (p) =>
            p.role === "visitor" &&
            ISO_DATE.test(p.birthDate) &&
            ageOn(p.birthDate, options.eventDate) < 18,
        ) &&
        !people.some((p) => p.role !== "visitor")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["people"],
          message:
            "Un visitante menor de edad debe ir con un adulto acompañante.",
        });
      }
      people.forEach((person, index) => {
        const key = `${person.docType}:${person.docNumber.trim().toUpperCase()}`;
        const first = seen.get(key);
        if (first !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "docNumber"],
            message: `Este documento ya está en la fila ${first + 1}.`,
          });
        } else {
          seen.set(key, index);
        }

        if (person.role === "visitor") visitors += 1;
        if (
          person.role !== "visitor" &&
          ISO_DATE.test(person.birthDate) &&
          ageOn(person.birthDate, options.eventDate) < 18
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "birthDate"],
            message:
              "Los acompañantes o tutores deben ser mayores de edad el día del evento.",
          });
        }
        if (options.kind === "individual" && person.role === "chaperone") {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "role"],
            message:
              "En una inscripción individual el adulto va como acompañante.",
          });
        }
        if (person.role !== "visitor" && person.relationship.trim() === "") {
          ctx.addIssue({
            code: "custom",
            path: ["people", index, "relationship"],
            message:
              options.kind === "school"
                ? "Indica su cargo (por ejemplo, profesor)."
                : "Indica el parentesco (por ejemplo, madre).",
          });
        }
      });

      if (visitors > options.expectedVisitors) {
        ctx.addIssue({
          code: "custom",
          path: ["people"],
          message: `Declaraste ${options.expectedVisitors} visitantes y hay ${visitors}.`,
        });
      }
    });
}
export type PeopleValues = { people: PersonValues[] };

export function emptyPerson(role: PersonValues["role"]): PersonValues {
  return {
    docType: "dni",
    docNumber: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    grade: "",
    email: "",
    phone: "",
    role,
    relationship: "",
  };
}

/** Forma que espera `set_attendees(p_people)`. */
export function toRpcPeople(people: PersonValues[]) {
  return people.map((person) => ({
    doc_type: person.docType,
    doc_number: person.docNumber.trim().toUpperCase(),
    first_name: person.firstName.trim(),
    last_name: person.lastName.trim(),
    birth_date: person.birthDate,
    grade: person.grade.trim() || null,
    email: person.email.trim() || null,
    phone: person.phone.trim() || null,
    attendee_role: person.role,
    relationship: person.relationship.trim() || null,
  }));
}

// Logística ---------------------------------------------------------------------------------------

export const logisticsSchema = z.object({
  items: z.array(
    z
      .object({
        optionCode: z.string(),
        selected: z.boolean(),
        quantity: z.number("Indica la cantidad.").int().min(0).max(500),
        notes: z.string().trim().max(300),
      })
      .refine((item) => !item.selected || item.quantity > 0, {
        path: ["quantity"],
        message: "Indica la cantidad.",
      }),
  ),
});
export type LogisticsValues = z.infer<typeof logisticsSchema>;

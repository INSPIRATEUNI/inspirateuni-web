import { z } from "zod";
import { areasDeApoyo, facultades } from "@/data/voluntariado";

/**
 * Esquemas de los formularios públicos. Los usa el formulario (resolver) y se
 * vuelven a validar en la Server Action.
 */

export type FormResult = { ok: true } | { ok: false; error: string };

export type Option = { value: string; label: string };

/** Etiqueta legible de una opción (para la hoja y los correos). */
export function optionLabel(options: readonly Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Fecha aaaa-mm-dd en Lima, desplazada `offsetDays` días (Lima no cambia de hora). */
export function limaDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Lima" },
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CELLPHONE = /^9\d{8}$/;
const CELLPHONE_ERROR = "Escribe un celular de 9 dígitos que empiece con 9.";

/** aaaa-mm-dd que existe en el calendario (descarta 30/02 o 31/04). */
function isCalendarDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function text(min: number, max: number, minMessage: string) {
  return z
    .string()
    .trim()
    .min(min, minMessage)
    .max(max, `Puede tener hasta ${max} caracteres.`);
}

function optionalText(max: number) {
  return z.string().trim().max(max, `Puede tener hasta ${max} caracteres.`);
}

/** Valor de un select: debe ser una de las opciones. */
function choice(values: readonly string[], message: string) {
  return z.string().refine((value) => values.includes(value), message);
}

const values = (options: readonly Option[]) => options.map((o) => o.value);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "El correo es demasiado largo.")
  .pipe(z.email("Escribe un correo válido."));

const digits = (value: string) => value.replace(/[\s-]/g, "");

const cellphone = z
  .string()
  .transform(digits)
  .refine((value) => CELLPHONE.test(value), CELLPHONE_ERROR);

const optionalCellphone = z
  .string()
  .transform(digits)
  .refine((value) => value === "" || CELLPHONE.test(value), CELLPHONE_ERROR);

const consent = z
  .boolean()
  .refine((value) => value, "Necesitamos tu permiso para contactarte.");

// Voluntariado ----------------------------------------------------------------------------------

export const cycles: Option[] = Array.from({ length: 10 }, (_, index) => ({
  value: String(index + 1),
  label: `Ciclo ${index + 1}`,
}));

export const volunteerSchema = z
  .object({
    firstName: text(2, 80, "Escribe tus nombres."),
    lastName: text(2, 80, "Escribe tus apellidos."),
    email,
    phone: cellphone,
    studentCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^\d{8}[A-Z]$/,
        "Tu código UNI tiene 8 dígitos y una letra, como 20231234A.",
      ),
    faculty: choice(facultades, "Elige tu facultad."),
    cycle: choice(values(cycles), "Elige tu ciclo."),
    area: choice(values(areasDeApoyo), "Elige dónde te gustaría apoyar."),
    motivation: text(
      30,
      1000,
      "Cuéntanos un poco más (al menos 30 caracteres).",
    ),
    consent,
  })
  .superRefine((form, ctx) => {
    if (form.area === "embajador" && Number(form.cycle) < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["cycle"],
        message: "Para ser embajador debes estar entre 5.º y 10.º ciclo.",
      });
    }
  });
export type VolunteerValues = z.infer<typeof volunteerSchema>;

// Inspírate Girl --------------------------------------------------------------------------------

export const igirlInterests: Option[] = [
  { value: "participar", label: "Quiero participar en las actividades" },
  { value: "voluntaria", label: "Quiero ser voluntaria" },
  { value: "aliada", label: "Represento a un colegio u organización" },
];

export const igirlSchema = z.object({
  interest: choice(values(igirlInterests), "Elige cómo quieres participar."),
  firstName: text(2, 80, "Escribe tus nombres."),
  lastName: text(2, 80, "Escribe tus apellidos."),
  email,
  phone: optionalCellphone,
  institution: text(2, 120, "Escribe tu colegio, universidad u organización."),
  grade: optionalText(40),
  message: optionalText(500),
  consent,
});
export type IgirlValues = z.infer<typeof igirlSchema>;

// Visitas guiadas -------------------------------------------------------------------------------

export const visitModes: Option[] = [
  { value: "uni", label: "Vamos a la UNI" },
  { value: "colegio", label: "Vengan a nuestro colegio" },
];

export const visitShifts: Option[] = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
];

export const visitSchema = z.object({
  school: text(3, 160, "Escribe el nombre de tu colegio."),
  district: text(2, 80, "Escribe el distrito."),
  students: z
    .number("Indica cuántos escolares serán.")
    .int("Usa un número entero.")
    .min(10, "Las visitas son para grupos de 10 escolares o más.")
    .max(500, "Para más de 500 escolares, escríbenos."),
  mode: choice(values(visitModes), "Elige dónde será la visita."),
  date: z
    .string()
    .regex(ISO_DATE, "Elige una fecha.")
    .refine(isCalendarDate, "Esa fecha no existe.")
    .refine((value) => value >= limaDate(1), "Elige una fecha desde mañana.")
    .refine(
      (value) => value <= limaDate(365),
      "Elige una fecha dentro del próximo año.",
    ),
  shift: choice(values(visitShifts), "Elige un turno."),
  name: text(3, 120, "Escribe tu nombre."),
  email,
  phone: optionalCellphone,
  consent,
});
export type VisitValues = z.infer<typeof visitSchema>;

// Antispam --------------------------------------------------------------------------------------

/** Datos que acompañan cada envío; el servidor decide con ellos si es spam. */
export const antispamSchema = z.object({
  /** Mismo id en los reintentos: Apps Script no duplica la fila. */
  submissionId: z.uuid(),
  /** Campo trampa: una persona no lo ve, un bot lo llena. */
  website: z.string().max(500),
  /** Milisegundos entre que se mostró el formulario y el envío. */
  elapsedMs: z.number().int().nonnegative(),
  captchaToken: z.string().max(10_000).nullable(),
});
export type AntispamMeta = z.infer<typeof antispamSchema>;

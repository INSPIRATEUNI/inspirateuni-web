import { type PersonValues, personSchema } from "./schemas";
import type { AttendeeRole, DocType } from "./types";

/**
 * Importa personas pegadas desde Excel (columnas separadas por tabulador) o
 * desde un CSV (`,` o `;`). La primera fila debe tener los encabezados de la
 * plantilla; se aceptan variantes sin tildes ni mayúsculas.
 */

const COLUMNS = [
  { key: "role", header: "Rol" },
  { key: "docType", header: "Tipo de documento" },
  { key: "docNumber", header: "Número de documento" },
  { key: "firstName", header: "Nombres" },
  { key: "lastName", header: "Apellidos" },
  { key: "birthDate", header: "Fecha de nacimiento" },
  { key: "grade", header: "Grado" },
  { key: "email", header: "Correo" },
  { key: "phone", header: "Celular" },
  { key: "relationship", header: "Cargo o parentesco" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const HEADER_ALIASES: Record<string, ColumnKey> = {
  rol: "role",
  tipo: "role",
  "tipo de documento": "docType",
  "tipo documento": "docType",
  documento: "docNumber",
  "numero de documento": "docNumber",
  "nro de documento": "docNumber",
  dni: "docNumber",
  nombres: "firstName",
  nombre: "firstName",
  apellidos: "lastName",
  apellido: "lastName",
  "fecha de nacimiento": "birthDate",
  nacimiento: "birthDate",
  grado: "grade",
  "grado o ano": "grade",
  correo: "email",
  email: "email",
  celular: "phone",
  telefono: "phone",
  "cargo o parentesco": "relationship",
  cargo: "relationship",
  parentesco: "relationship",
};

const ROLE_ALIASES: Record<string, AttendeeRole> = {
  visitante: "visitor",
  escolar: "visitor",
  alumno: "visitor",
  estudiante: "visitor",
  acompanante: "chaperone",
  profesor: "chaperone",
  docente: "chaperone",
  apoderado: "guardian",
  adulto: "guardian",
  "adulto acompanante": "guardian",
};

const DOC_ALIASES: Record<string, DocType> = {
  dni: "dni",
  ce: "ce",
  "carne de extranjeria": "ce",
  pasaporte: "passport",
  passport: "passport",
  otro: "other",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.°º]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Separa una línea respetando comillas dobles (CSV estándar). */
function splitLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function detectSeparator(headerLine: string) {
  const counts = ["\t", ";", ","].map(
    (sep) => [sep, headerLine.split(sep).length - 1] as const,
  );
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : "\t";
}

/** Acepta dd/mm/aaaa, dd-mm-aaaa y aaaa-mm-dd. */
function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return trimmed;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export type ImportRowError = { line: number; message: string };

export type ImportResult = {
  people: PersonValues[];
  errors: ImportRowError[];
};

export function parsePeople(
  text: string,
  defaultRole: AttendeeRole = "visitor",
): ImportResult {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { people: [], errors: [{ line: 0, message: "No hay datos." }] };
  }

  const separator = detectSeparator(lines[0]);
  const headers = splitLine(lines[0], separator).map(
    (header) => HEADER_ALIASES[normalize(header)],
  );
  const missing = (["docNumber", "firstName", "lastName", "birthDate"] as const)
    .filter((key) => !headers.includes(key))
    .map((key) => COLUMNS.find((c) => c.key === key)?.header);
  if (missing.length > 0) {
    return {
      people: [],
      errors: [
        {
          line: 1,
          message: `Faltan columnas: ${missing.join(", ")}. Usa los encabezados de la plantilla.`,
        },
      ],
    };
  }

  const people: PersonValues[] = [];
  const errors: ImportRowError[] = [];

  lines.slice(1).forEach((line, index) => {
    const lineNumber = index + 2;
    const cells = splitLine(line, separator);
    const raw: Partial<Record<ColumnKey, string>> = {};
    headers.forEach((key, column) => {
      if (key) raw[key] = cells[column] ?? "";
    });

    const role = raw.role ? ROLE_ALIASES[normalize(raw.role)] : defaultRole;
    if (!role) {
      errors.push({
        line: lineNumber,
        message: `Rol desconocido: “${raw.role}”.`,
      });
      return;
    }
    const docType = raw.docType ? DOC_ALIASES[normalize(raw.docType)] : "dni";
    if (!docType) {
      errors.push({
        line: lineNumber,
        message: `Tipo de documento desconocido: “${raw.docType}”.`,
      });
      return;
    }

    const candidate = {
      role,
      docType,
      // Excel suele quitar los ceros iniciales del DNI
      docNumber:
        docType === "dni"
          ? (raw.docNumber ?? "").replace(/\D/g, "").padStart(8, "0")
          : (raw.docNumber ?? ""),
      firstName: raw.firstName ?? "",
      lastName: raw.lastName ?? "",
      birthDate: normalizeDate(raw.birthDate ?? ""),
      grade: raw.grade ?? "",
      email: raw.email ?? "",
      phone: raw.phone ?? "",
      relationship: raw.relationship ?? "",
    };

    const parsed = personSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const column = COLUMNS.find((c) => c.key === issue.path[0])?.header;
      errors.push({
        line: lineNumber,
        message: column ? `${column}: ${issue.message}` : issue.message,
      });
      return;
    }
    people.push(parsed.data);
  });

  return { people, errors };
}

function csvCell(value: string) {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Plantilla CSV (con BOM para que Excel respete las tildes) y dos filas de ejemplo. */
export function peopleTemplateCsv(kind: "school" | "individual") {
  const header = COLUMNS.map((c) => c.header);
  const examples =
    kind === "school"
      ? [
          [
            "Visitante",
            "DNI",
            "71234567",
            "Ana Lucía",
            "Quispe Rojas",
            "15/03/2009",
            "5.° de secundaria",
            "",
            "",
            "",
          ],
          [
            "Acompañante",
            "DNI",
            "40123456",
            "Jorge",
            "Huamán Torres",
            "02/08/1985",
            "",
            "jorge@colegio.edu.pe",
            "987654321",
            "Profesor",
          ],
        ]
      : [
          [
            "Visitante",
            "DNI",
            "71234567",
            "Ana Lucía",
            "Quispe Rojas",
            "15/03/2009",
            "5.° de secundaria",
            "ana@correo.com",
            "987654321",
            "",
          ],
          [
            "Adulto acompañante",
            "DNI",
            "40123456",
            "Rosa",
            "Rojas Díaz",
            "02/08/1980",
            "",
            "rosa@correo.com",
            "912345678",
            "Madre",
          ],
        ];
  const rows = [header, ...examples].map((row) => row.map(csvCell).join(";"));
  return `﻿${rows.join("\r\n")}\r\n`;
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  driveFileIdFrom,
  type EventConfigInput,
  eventConfigSchema,
} from "@/lib/open-day/staff/config-schema";
import { fromLimaInput } from "@/lib/open-day/staff/dates";
import {
  type ActionResult,
  fail,
  guardStaff,
  ok,
  staffError,
} from "@/lib/open-day/staff/guard";

/**
 * Configuración del Open Day (solo admin). La RLS de admin permite escribir directo
 * en `events`, `event_faculties`, `document_templates` y `logistics_options`.
 * Nunca se envía `seats_taken`: lo mantienen los triggers.
 */

function refresh() {
  revalidatePath("/intranet/open-day", "layout");
  revalidatePath("/provov/open-day", "layout");
}

export async function saveEvent(
  eventId: string | null,
  input: EventConfigInput,
): Promise<ActionResult<string>> {
  const parsed = eventConfigSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Revisa los datos.");
  if (eventId && !z.guid().safeParse(eventId).success)
    return fail("Evento no válido.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;

  const v = parsed.data;
  const row = {
    name: v.name,
    event_date: v.eventDate,
    venue: v.venue || null,
    registration_open: v.registrationOpen,
    registration_opens_at: fromLimaInput(v.registrationOpensAt),
    registration_closes_at: fromLimaInput(v.registrationClosesAt),
    // Vacío: el trigger events_set_defaults lo calcula (cierre + horas de reserva)
    docs_close_at: v.docsCloseAt ? fromLimaInput(v.docsCloseAt) : null,
    hold_minutes: v.holdMinutes,
    reservation_hours: v.reservationHours,
    max_file_mb: v.maxFileMb,
    students_per_chaperone: v.studentsPerChaperone,
    max_visitors_per_registration:
      v.maxVisitorsPerRegistration === "" ? null : v.maxVisitorsPerRegistration,
    max_adults_per_registration:
      v.maxAdultsPerRegistration === "" ? null : v.maxAdultsPerRegistration,
    max_drafts_per_email: v.maxDraftsPerEmail,
    travel_buffer_minutes: v.travelBufferMinutes,
  };

  const { data, error } = eventId
    ? await guard.supabase
        .from("events")
        .update(row)
        .eq("id", eventId)
        .select("id")
        .maybeSingle()
    : await guard.supabase
        .from("events")
        .insert(row)
        .select("id")
        .maybeSingle();
  if (error) return fail(staffError(error));
  if (!data) return fail("No encontramos el evento.");
  refresh();
  return ok(data.id as string);
}

const tier = z.enum(["high", "mid", "low"]);

export async function addEventFaculty(input: {
  eventId: string;
  facultyId: string;
  tier: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ eventId: z.guid(), facultyId: z.guid(), tier })
    .safeParse(input);
  if (!parsed.success) return fail("Elige la facultad y el nivel.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;
  const { error } = await guard.supabase.from("event_faculties").insert({
    event_id: parsed.data.eventId,
    faculty_id: parsed.data.facultyId,
    tier: parsed.data.tier,
  });
  if (error) {
    return fail(
      error.code === "23505"
        ? "Esa facultad ya está en el evento."
        : staffError(error),
    );
  }
  refresh();
  return ok(null);
}

export async function updateEventFaculty(input: {
  id: string;
  tier: string;
}): Promise<ActionResult> {
  const parsed = z.object({ id: z.guid(), tier }).safeParse(input);
  if (!parsed.success) return fail("Nivel no válido.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;
  const { error } = await guard.supabase
    .from("event_faculties")
    .update({ tier: parsed.data.tier })
    .eq("id", parsed.data.id);
  if (error) return fail(staffError(error));
  refresh();
  return ok(null);
}

export async function removeEventFaculty(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = z.object({ id: z.guid() }).safeParse(input);
  if (!parsed.success) return fail("Facultad no válida.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;
  const { error } = await guard.supabase
    .from("event_faculties")
    .delete()
    .eq("id", parsed.data.id);
  if (error) {
    return fail(
      error.code === "23503"
        ? "No se puede quitar: ya tiene recorridos. Cancélalos en Horarios."
        : staffError(error),
    );
  }
  refresh();
  return ok(null);
}

const templateKind = z.enum([
  "consent",
  "guardian_declaration",
  "commitment_letter",
]);

export async function addTemplate(input: {
  kind: string;
  driveFile: string;
  activate: boolean;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      kind: templateKind,
      driveFile: z.string().trim().min(10),
      activate: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success)
    return fail("Elige el tipo y pega el enlace del archivo.");
  const fileId = driveFileIdFrom(parsed.data.driveFile);
  if (!fileId) return fail("No reconocemos ese enlace de Drive.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;

  const { data: last } = await guard.supabase
    .from("document_templates")
    .select("version")
    .eq("kind", parsed.data.kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (parsed.data.activate) {
    // Solo una versión activa por tipo (índice único parcial)
    const { error } = await guard.supabase
      .from("document_templates")
      .update({ active: false })
      .eq("kind", parsed.data.kind)
      .eq("active", true);
    if (error) return fail(staffError(error));
  }
  const { error } = await guard.supabase.from("document_templates").insert({
    kind: parsed.data.kind,
    version: (last?.version ?? 0) + 1,
    drive_file_id: fileId,
    active: parsed.data.activate,
  });
  if (error) return fail(staffError(error));
  refresh();
  return ok(null);
}

export async function activateTemplate(input: {
  id: string;
  kind: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.guid(), kind: templateKind })
    .safeParse(input);
  if (!parsed.success) return fail("Plantilla no válida.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;
  const off = await guard.supabase
    .from("document_templates")
    .update({ active: false })
    .eq("kind", parsed.data.kind)
    .eq("active", true);
  if (off.error) return fail(staffError(off.error));
  const on = await guard.supabase
    .from("document_templates")
    .update({ active: true })
    .eq("id", parsed.data.id);
  if (on.error) return fail(staffError(on.error));
  refresh();
  return ok(null);
}

export async function saveLogisticsOption(input: {
  code: string;
  label: string;
  active: boolean;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      code: z
        .string()
        .trim()
        .toLowerCase()
        .regex(
          /^[a-z0-9_]{2,30}$/,
          "El código va en minúsculas, sin espacios (ej.: bus).",
        ),
      label: z.string().trim().min(2, "Escribe el nombre.").max(80),
      active: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Revisa los datos.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;
  const { error } = await guard.supabase
    .from("logistics_options")
    .upsert(parsed.data, { onConflict: "code" });
  if (error) return fail(staffError(error));
  refresh();
  return ok(null);
}

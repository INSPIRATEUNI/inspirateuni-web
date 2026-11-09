import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  FacultiesEditor,
  LogisticsEditor,
  TemplatesEditor,
} from "@/components/intranet/open-day/ConfigLists";
import { EventBar } from "@/components/intranet/open-day/EventBar";
import { EventConfigForm } from "@/components/intranet/open-day/EventConfigForm";
import { Heading } from "@/components/ui/Heading";
import { getCurrentUser } from "@/lib/intranet/user";
import type { EventConfigInput } from "@/lib/open-day/staff/config-schema";
import { toLimaInput } from "@/lib/open-day/staff/dates";
import { resolveStaffEvent } from "@/lib/open-day/staff/event";
import { fetchEventFaculties } from "@/lib/open-day/staff/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Configuración del Open Day - Inspírate UNI",
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border-2 border-border bg-surface p-5 sm:p-6">
      <Heading variant="item" level={2}>
        {title}
      </Heading>
      {children}
    </section>
  );
}

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  venue: string | null;
  registration_open: boolean;
  registration_opens_at: string;
  registration_closes_at: string;
  docs_close_at: string | null;
  hold_minutes: number;
  reservation_hours: number;
  max_file_mb: number;
  students_per_chaperone: number;
  max_visitors_per_registration: number | null;
  max_adults_per_registration: number | null;
  max_drafts_per_email: number;
  travel_buffer_minutes: number;
};

const NEW_EVENT: EventConfigInput = {
  name: "Open Day UNI",
  eventDate: "",
  venue: "Universidad Nacional de Ingeniería",
  registrationOpen: false,
  registrationOpensAt: "",
  registrationClosesAt: "",
  docsCloseAt: "",
  holdMinutes: 30,
  reservationHours: 48,
  maxFileMb: 20,
  studentsPerChaperone: 10,
  maxVisitorsPerRegistration: "",
  maxAdultsPerRegistration: "",
  maxDraftsPerEmail: 3,
  travelBufferMinutes: 15,
};

export default async function ConfigPage({
  searchParams,
}: PageProps<"/intranet/open-day/configuracion">) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  const params = await searchParams;
  const supabase = await createClient();
  const { events, selected } = await resolveStaffEvent(supabase, params.evento);
  const creating = !selected || params.nuevo === "1";

  const [eventRow, eventFaculties, catalog, templates, logistics] =
    await Promise.all([
      selected && !creating
        ? supabase
            .from("events")
            .select("*")
            .eq("id", selected.id)
            .maybeSingle<EventRow>()
        : Promise.resolve({ data: null }),
      selected && !creating
        ? fetchEventFaculties(supabase, selected.id)
        : Promise.resolve([]),
      supabase.from("faculties").select("id, name").order("name"),
      supabase
        .from("document_templates")
        .select("id, kind, version, drive_file_id, active"),
      supabase
        .from("logistics_options")
        .select("code, label, active")
        .order("label"),
    ]);
  const event = eventRow.data;

  const defaults: EventConfigInput = event
    ? {
        name: event.name,
        eventDate: event.event_date,
        venue: event.venue ?? "",
        registrationOpen: event.registration_open,
        registrationOpensAt: toLimaInput(event.registration_opens_at),
        registrationClosesAt: toLimaInput(event.registration_closes_at),
        docsCloseAt: toLimaInput(event.docs_close_at),
        holdMinutes: event.hold_minutes,
        reservationHours: event.reservation_hours,
        maxFileMb: event.max_file_mb,
        studentsPerChaperone: event.students_per_chaperone,
        maxVisitorsPerRegistration: event.max_visitors_per_registration ?? "",
        maxAdultsPerRegistration: event.max_adults_per_registration ?? "",
        maxDraftsPerEmail: event.max_drafts_per_email,
        travelBufferMinutes: event.travel_buffer_minutes,
      }
    : NEW_EVENT;

  return (
    <div className="grid gap-8">
      {selected && !creating && (
        <EventBar events={events} selected={selected} />
      )}

      <Card title={creating ? "Crear un Open Day" : "Evento"}>
        <EventConfigForm
          eventId={creating ? null : (event?.id ?? null)}
          defaults={defaults}
        />
        {!creating && (
          <a
            href="/intranet/open-day/configuracion?nuevo=1"
            className="text-link text-sm"
          >
            Crear otro Open Day
          </a>
        )}
      </Card>

      {selected && !creating && (
        <Card title="Facultades y niveles">
          <FacultiesEditor
            eventId={selected.id}
            eventFaculties={eventFaculties}
            catalog={catalog.data ?? []}
          />
        </Card>
      )}

      <Card title="Plantillas de documentos">
        <TemplatesEditor
          templates={(templates.data ?? []).map((t) => ({
            id: t.id,
            kind: t.kind,
            version: t.version,
            driveFileId: t.drive_file_id,
            active: t.active,
          }))}
        />
      </Card>

      <Card title="Opciones de logística">
        <LogisticsEditor options={logistics.data ?? []} />
      </Card>
    </div>
  );
}

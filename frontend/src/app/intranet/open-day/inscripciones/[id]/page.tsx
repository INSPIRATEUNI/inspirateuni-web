import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPanel } from "@/components/intranet/open-day/AdminPanel";
import { DocumentButton } from "@/components/intranet/open-day/DocumentButton";
import {
  type ValidationDocument,
  ValidationPanel,
} from "@/components/intranet/open-day/ValidationPanel";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { getCurrentUser } from "@/lib/intranet/user";
import {
  DOC_TYPE_LABELS,
  DOCUMENT_LABELS,
  ROLE_LABELS,
  requiredDocuments,
  STATUS_LABELS,
  STATUS_TONES,
  TIER_LABELS,
} from "@/lib/open-day/constants";
import { fetchEvent, fetchRegistration } from "@/lib/open-day/data";
import {
  ageOn,
  formatDateTime,
  formatGate,
  formatTime,
  formatTimeRange,
  isMinorOn,
} from "@/lib/open-day/format";
import { toLimaInput, toLimaTime } from "@/lib/open-day/staff/dates";
import {
  fetchRegistrationExtras,
  fetchUsedGates,
} from "@/lib/open-day/staff/queries";
import type { DocumentKind } from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Inscripción del Open Day - Inspírate UNI",
};

const EVENT_LABELS: Record<string, string> = {
  created: "Creó la inscripción",
  hold: "Retuvo un recorrido",
  hold_released: "Soltó un recorrido",
  hold_renewed: "Renovó el tiempo",
  hold_expired: "Venció la retención",
  selection_confirmed: "Confirmó los recorridos",
  attendees_replaced: "Guardó la lista de personas",
  attendee_conflict: "Conflicto con otra inscripción",
  logistics_set: "Guardó la logística",
  submitted: "Envió la inscripción",
  resubmitted: "Reenvió tras la observación",
  confirmed: "Confirmó la inscripción",
  docs_observed: "Observó documentos",
  session_cancelled: "Se canceló un recorrido",
  expired: "Venció el plazo",
  override_reopen: "Reabrió (admin)",
  override_attendees: "Editó las personas (admin)",
  override_limits: "Ajustó la cantidad (admin)",
  override_cancel: "Canceló (admin)",
  document_uploaded: "Subió un documento",
  credentials_generated: "Se generaron los códigos",
  document_viewed: "Vio un documento",
  checked_in: "Registró un ingreso",
};

const UPLOAD_KINDS: DocumentKind[] = [
  "school_consolidated",
  "consent",
  "guardian_declaration",
  "commitment_letter",
];

export default async function RegistrationDetailPage({
  params,
}: PageProps<"/intranet/open-day/inscripciones/[id]">) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const registration = await fetchRegistration(supabase, id);
  if (!registration) notFound();

  const [event, extras, usedGates] = await Promise.all([
    fetchEvent(supabase, registration.eventId),
    fetchRegistrationExtras(
      supabase,
      registration.id,
      registration.eventId,
      registration.attendees.map((a) => a.participantId),
    ),
    fetchUsedGates(supabase, registration.eventId),
  ]);
  if (!event) notFound();

  const minorVisitor = registration.attendees.some(
    (a) => a.role === "visitor" && isMinorOn(a.birthDate, event.eventDate),
  );
  const current = extras.documents.filter((d) => !d.supersededAt);
  const validationDocs: ValidationDocument[] = current
    .filter((d): d is typeof d & { kind: DocumentKind } =>
      UPLOAD_KINDS.includes(d.kind as DocumentKind),
    )
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      fileName: d.fileName,
      uploadedAt: d.uploadedAt,
      observation: d.observation,
      verifiedAt: d.verifiedAt,
    }));
  const missing = requiredDocuments(registration.kind, minorVisitor).filter(
    (kind) => !validationDocs.some((d) => d.kind === kind),
  );
  const older = extras.documents.filter((d) => d.supersededAt);
  const credentials = current.filter((d) => d.kind === "credentials");

  const firstTour = extras.enrollments[0]?.startsAt;
  const defaultArrival = registration.arrivalAt
    ? toLimaTime(registration.arrivalAt)
    : firstTour
      ? toLimaTime(
          new Date(Date.parse(firstTour) - 30 * 60 * 1000).toISOString(),
        )
      : "08:30";
  const defaultDeadline = toLimaInput(
    new Date(
      Date.now() + event.reservationHours * 60 * 60 * 1000,
    ).toISOString(),
  );
  const passByParticipant = new Map(
    extras.passes.map((p) => [p.participantId, p]),
  );
  const visitors = registration.attendees.filter(
    (a) => a.role === "visitor",
  ).length;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={
              `/intranet/open-day/inscripciones?evento=${registration.eventId}` as Route
            }
            className="text-sm font-bold text-blue-deep hover:underline"
          >
            ← Volver a la bandeja
          </Link>
          <Heading variant="section" level={2} className="mt-2">
            <span className="font-mono">{registration.referenceCode}</span> ·{" "}
            {registration.school?.name ?? registration.contactName}
          </Heading>
          <p className="mt-1 text-muted-foreground">
            {registration.kind === "school" ? "Colegio" : "Persona libre"} ·{" "}
            {registration.contactName} · {registration.contactEmail}
          </p>
        </div>
        <Tag tone={STATUS_TONES[registration.status]}>
          {STATUS_LABELS[registration.status]}
        </Tag>
      </div>

      <dl className="grid gap-4 rounded-lg border-2 border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Visitantes",
            `${visitors} de ${registration.expectedVisitors} declarados`,
          ],
          [
            "Enviada",
            registration.submittedAt
              ? formatDateTime(registration.submittedAt)
              : "—",
          ],
          [
            "Plazo de documentos",
            registration.docsDeadline
              ? formatDateTime(registration.docsDeadline)
              : "—",
          ],
          [
            "Puerta y llegada",
            registration.gate && registration.arrivalAt
              ? `${formatGate(registration.gate)}, ${formatTime(registration.arrivalAt)}`
              : "Se define al confirmar",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm font-semibold text-muted-foreground">
              {label}
            </dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-8">
          <ValidationPanel
            registrationId={registration.id}
            status={registration.status}
            documents={validationDocs}
            missing={missing}
            usedGates={usedGates}
            defaultGate={registration.gate ?? ""}
            defaultArrival={defaultArrival}
            defaultDeadline={defaultDeadline}
          />

          {(older.length > 0 || credentials.length > 0) && (
            <section className="grid gap-3">
              <Heading variant="item" level={2}>
                Otros archivos
              </Heading>
              <ul className="divide-y divide-border rounded-lg border-2 border-border bg-surface">
                {[...credentials, ...older].map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">{DOCUMENT_LABELS[d.kind]}</p>
                      <p className="text-sm text-muted-foreground">
                        {d.fileName} · {formatDateTime(d.uploadedAt)}
                        {d.supersededAt && " · reemplazado"}
                      </p>
                    </div>
                    <DocumentButton documentId={d.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid gap-3">
            <Heading variant="item" level={2}>
              Personas ({registration.attendees.length})
            </Heading>
            {registration.attendees.length === 0 ? (
              <p className="text-muted-foreground">Aún no registra personas.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
                <table className="w-full min-w-[44rem] border-collapse">
                  <caption className="sr-only">
                    Personas de la inscripción
                  </caption>
                  <thead className="bg-background">
                    <tr>
                      {[
                        "Nombre",
                        "Documento",
                        "Rol",
                        "Edad",
                        "Código",
                        "Ingreso",
                      ].map((label) => (
                        <th
                          key={label}
                          className="px-4 py-3 text-left text-sm font-extrabold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {registration.attendees.map((a) => {
                      const pass = passByParticipant.get(a.participantId);
                      return (
                        <tr key={a.participantId}>
                          <td className="px-4 py-3">
                            <p className="font-semibold">
                              {a.firstName} {a.lastName}
                            </p>
                            {(a.email || a.phone) && (
                              <p className="text-sm text-muted-foreground">
                                {[a.email, a.phone].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {DOC_TYPE_LABELS[a.docType]} {a.docNumber}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ROLE_LABELS[a.role]}
                            {a.relationship && ` (${a.relationship})`}
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums">
                            {ageOn(a.birthDate, event.eventDate)}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm">
                            {pass?.status === "active" ? pass.accessCode : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {pass?.checkedInAt
                              ? formatTime(pass.checkedInAt)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <Heading variant="item" level={2}>
              Recorridos
            </Heading>
            {extras.enrollments.length === 0 ? (
              <p className="text-muted-foreground">Sin recorridos.</p>
            ) : (
              <ul className="grid gap-2">
                {extras.enrollments.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-border bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">{e.facultyName}</p>
                      <p className="text-sm text-muted-foreground">
                        {TIER_LABELS[e.tier]}
                        {e.meetingPoint && ` · ${e.meetingPoint}`}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums">
                      {formatTimeRange(e.startsAt, e.endsAt)} · {e.seats}{" "}
                      {e.seats === 1 ? "cupo" : "cupos"}
                      {e.status === "held" && " · retenido"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {registration.logistics.length > 0 && (
            <section className="grid gap-3">
              <Heading variant="item" level={2}>
                Logística
              </Heading>
              <ul className="grid gap-2">
                {registration.logistics.map((l) => (
                  <li
                    key={l.optionCode}
                    className="rounded-md border-2 border-border bg-surface px-4 py-3"
                  >
                    <span className="font-semibold">
                      {extras.logisticsLabels[l.optionCode] ?? l.optionCode}:
                    </span>{" "}
                    {l.quantity}
                    {l.notes && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {l.notes}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-8">
          {user?.isAdmin && (
            <AdminPanel event={event} registration={registration} />
          )}

          <section className="grid gap-3">
            <Heading variant="item" level={2}>
              Bitácora
            </Heading>
            <ol className="grid gap-3 border-l-2 border-border pl-4">
              {extras.timeline.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <p className="font-semibold">
                    {EVENT_LABELS[entry.eventType] ?? entry.eventType}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateTime(entry.createdAt)} · {entry.actorName}
                  </p>
                  {entry.reason && (
                    <p className="mt-1 whitespace-pre-line">{entry.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

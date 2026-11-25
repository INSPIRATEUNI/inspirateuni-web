// Plantillas de los correos del Open Day. `email_outbox.template` elige la plantilla y
// `email_outbox.payload` trae los datos (siempre incluye reference_code). Todo valor dinámico se escapa.

export type Rendered = { subject: string; html: string; text: string };
export type Payload = Record<string, unknown>;

/** Plantillas cuyo correo lleva el PDF de códigos: las envía Apps Script (ver apps-script/credentials). */
export const CREDENTIALS_TEMPLATES = new Set(["registration_confirmed", "credentials_updated"]);

const TZ = "America/Lima";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function when(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "full", timeStyle: "short", timeZone: TZ }).format(date);
}

/** Recuadro destacado (p. ej. las observaciones del staff), con saltos de línea respetados. */
function callout(label: string, text: unknown): string {
  const body = esc(text).replace(/\r?\n/g, "<br>");
  return `<div style="margin:0 0 18px;padding:14px 16px;border-left:4px solid #f58a1f;background:#fff4e8;border-radius:8px"><p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#b45309">${esc(label)}</p><p style="margin:0">${body}</p></div>`;
}

function layout(title: string, paragraphs: string[], link?: { href: string; label: string }): string {
  // "10:00 a. m." ya termina en punto: evita el doble punto al cerrar la oración
  const fix = (p: string) => p.replace(/\.(<\/strong>)\./g, ".$1").replace(/\.\.(?!\.)/g, ".");
  // Los bloques que ya son un <div> (recuadros) no se envuelven en <p>
  const body = paragraphs
    .map((p) => (p.startsWith("<div") ? p : `<p style="margin:0 0 14px">${fix(p)}</p>`))
    .join("");
  const button = link
    ? `<p style="margin:22px 0"><a href="${esc(link.href)}" style="background:#e6007e;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">${esc(link.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f6f9;font-family:Nunito,Arial,sans-serif;color:#1c1c28">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<h1 style="font-size:22px;margin:0 0 18px">${esc(title)}</h1>${body}${button}
<p style="margin:26px 0 0;font-size:12px;color:#6b6b80">InspírateUNI · Este correo es automático.</p>
</div></body></html>`;
}

function strip(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1")
    .replace(/<\/p>|<\/h1>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function build(subject: string, title: string, paragraphs: string[], link?: { href: string; label: string }): Rendered {
  const html = layout(title, paragraphs, link);
  return { subject, html, text: strip(html) };
}

/** Devuelve null si la plantilla no existe (error permanente: no tiene sentido reintentar). */
export function render(
  template: string,
  payload: Payload,
  siteUrl: string,
  registrationId?: string | null,
): Rendered | null {
  const ref = esc(payload.reference_code);
  const event = esc(payload.event_name ?? "el Open Day");
  const myRegistration = { href: `${siteUrl}/provov/open-day/inscripcion/mi-inscripcion`, label: "Ir a Mi inscripción" };
  const codesHref = `${siteUrl}/provov/open-day/inscripcion/mi-inscripcion/codigos${registrationId ? `?id=${encodeURIComponent(registrationId)}` : ""}`;
  const code = `Código de referencia: <strong>${ref}</strong>.`;

  switch (template) {
    case "registration_reserved":
      return build(
        `Tu reserva para ${payload.event_name ?? "el Open Day"} está lista`,
        "¡Tu reserva está lista!",
        [
          `Reservamos tus recorridos para ${event}. Para conservarlos, sube tus documentos y envía la inscripción <strong>antes del ${esc(when(payload.docs_deadline))}</strong>.`,
          "Si no la envías a tiempo, los cupos se liberan automáticamente.",
          code,
        ],
        myRegistration,
      );
    case "reservation_reminder":
      return build(
        "Tu reserva vence pronto",
        "Tu reserva vence pronto",
        [
          `Aún no enviaste tu inscripción a ${event}. Tienes hasta el <strong>${esc(when(payload.docs_deadline))}</strong> para subir los documentos y enviarla.`,
          code,
        ],
        myRegistration,
      );
    case "reservation_expired":
      return build(
        "Tu reserva venció",
        "Tu reserva venció",
        [
          `No recibimos tu inscripción a tiempo y los cupos reservados se liberaron.`,
          "Si todavía hay lugar, puedes iniciar una nueva inscripción desde la página del Open Day.",
          code,
        ],
        { href: `${siteUrl}/provov/open-day`, label: "Ver el Open Day" },
      );
    case "registration_received":
      return build(
        "Recibimos tu inscripción",
        "Recibimos tu inscripción",
        [
          payload.kind === "school"
            ? `Gracias por inscribir a tu colegio a ${event}. Nuestro equipo revisará la inscripción y te escribirá cuando esté confirmada.`
            : `Gracias por inscribirte a ${event}. Nuestro equipo revisará tus documentos y te escribirá cuando esté confirmada.`,
          payload.kind === "school"
            ? callout(
                "Importante",
                "Recuerda llevar impresos y firmados los documentos del colegio el día del evento. Sin ellos, los escolares no podrán ingresar.",
              )
            : "",
          code,
        ].filter(Boolean),
        myRegistration,
      );
    case "documents_observed":
      return build(
        "Necesitamos que corrijas tus documentos",
        "Necesitamos que corrijas tus documentos",
        [
          "Revisamos tus documentos y encontramos observaciones:",
          callout("Observaciones del equipo", payload.observation),
          `Puedes reemplazarlos y reenviar tu inscripción hasta el <strong>${esc(when(payload.deadline))}</strong>.`,
          code,
        ],
        myRegistration,
      );
    case "registration_reopened":
      return build(
        "Reabrimos tu inscripción",
        "Reabrimos tu inscripción",
        [
          "Nuestro equipo reabrió tu inscripción para que puedas hacer correcciones:",
          callout("Motivo", payload.reason),
          `Puedes corregir los datos y los documentos, y volver a enviarla hasta el <strong>${esc(when(payload.deadline))}</strong>.`,
          code,
        ],
        myRegistration,
      );
    case "registration_cancelled":
      return build(
        "Tu inscripción fue cancelada",
        "Tu inscripción fue cancelada",
        // payload.reason es una nota interna del admin: no se muestra al usuario
        [`Tu inscripción a ${event} fue cancelada. Si crees que es un error, escríbenos indicando tu código de referencia.`, code],
      );
    case "session_cancelled":
      return build(
        "Se canceló uno de tus recorridos",
        "Se canceló uno de tus recorridos",
        [
          "Uno de los recorridos que elegiste se canceló. Entra a Mi inscripción para ver el estado y escoger una alternativa si hace falta.",
          code,
        ],
        myRegistration,
      );
    case "event_reminder":
      return build(
        "Mañana es el Open Day",
        "¡Mañana es el Open Day!",
        [
          `Te esperamos mañana en ${event}.`,
          payload.gate ? `Ingresa por <strong>${esc(payload.gate)}</strong>${payload.arrival_at ? ` a las <strong>${esc(when(payload.arrival_at))}</strong>` : ""}.` : "",
          "Lleva tus códigos QR (impresos o en el celular) y tu documento de identidad.",
          code,
        ].filter(Boolean),
        { href: codesHref, label: "Ver mis códigos" },
      );
    case "registration_confirmed":
      return build(
        "Tu inscripción está confirmada",
        "¡Tu inscripción está confirmada!",
        [
          `Confirmamos tu inscripción a ${event}.`,
          `Ingresa por <strong>${esc(payload.gate)}</strong> a las <strong>${esc(when(payload.arrival_at))}</strong>.`,
          "Adjuntamos el PDF con los códigos QR de cada persona. Cada una debe presentar el suyo (impreso o en el celular) junto con su documento de identidad.",
          payload.kind === "school"
            ? callout(
                "Importante",
                "Lleven impresos y firmados los documentos del colegio (autorizaciones y carta de compromiso). Sin ellos, los escolares no podrán ingresar.",
              )
            : "",
          code,
        ].filter(Boolean),
        { href: codesHref, label: "Ver mis códigos" },
      );
    case "credentials_updated":
      return build(
        "Actualizamos tus códigos de acceso",
        "Actualizamos tus códigos de acceso",
        [
          "Se modificó la lista de personas de tu inscripción. Adjuntamos el PDF con los códigos actualizados; los anteriores ya no sirven.",
          code,
        ],
        { href: codesHref, label: "Ver mis códigos" },
      );
    default:
      return null;
  }
}

// Worker de la cola de correos (email_outbox).
// Lo dispara el webhook de la BD (trigger + pg_net al encolar, y un job de pg_cron cada minuto para
// reintentos). Reclama filas con claim_outbox_emails (FOR UPDATE SKIP LOCKED: varias invocaciones
// a la vez no se pisan), envía y cierra con complete_outbox_email.
//
// Entrega al menos una vez. Contra duplicados: dedupe_key al encolar, Message-ID = id de la fila y,
// en los correos con PDF de códigos, idempotencia propia en Apps Script (por outbox_id).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";
import { json, safeEqual } from "../_shared/http.ts";
import { CREDENTIALS_TEMPLATES, type Payload, render } from "./templates.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const MAX_ATTEMPTS = 5;
const BATCH = 10;
const BUDGET_MS = 100_000; // la función corta a los 150 s: se deja margen

type OutboxRow = {
  id: string;
  registration_id: string | null;
  to_email: string;
  template: string;
  payload: Payload;
  attempts: number;
};

type Outcome = { ok: true } | { ok: false; error: string; permanent: boolean };

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function smtp() {
  if (!transport) {
    const port = Number(Deno.env.get("SMTP_PORT") ?? 587);
    transport = nodemailer.createTransport({
      host: env("SMTP_HOST"),
      port,
      secure: port === 465,
      auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transport;
}

function fromAddress(): string {
  return env("MAIL_FROM"); // p. ej. "InspírateUNI <no-reply@inspirateuni.org>"
}

function messageId(rowId: string): string {
  const domain = fromAddress().match(/@([^>\s]+)/)?.[1] ?? "inspirateuni.org";
  return `<${rowId}@${domain}>`;
}

/** Errores SMTP 5xx (buzón inexistente, rechazo) no mejoran al reintentar. */
function smtpOutcome(err: unknown): Outcome {
  const code = (err as { responseCode?: number }).responseCode ?? 0;
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: `smtp: ${message}`, permanent: code >= 500 && code < 600 };
}

async function sendPlain(row: OutboxRow, subject: string, html: string, text: string): Promise<Outcome> {
  try {
    await smtp().sendMail({
      from: fromAddress(),
      to: row.to_email,
      subject,
      html,
      text,
      messageId: messageId(row.id),
    });
    return { ok: true };
  } catch (err) {
    return smtpOutcome(err);
  }
}

/** Apps Script genera el PDF de códigos, guarda su copia en Drive y envía el correo con el adjunto. */
async function sendWithCredentials(
  admin: SupabaseClient,
  row: OutboxRow,
  subject: string,
  html: string,
  text: string,
): Promise<Outcome> {
  if (!row.registration_id) return { ok: false, error: "El correo no tiene inscripción", permanent: true };

  const { data, error } = await admin.rpc("credentials_payload", { p_registration_id: row.registration_id });
  if (error) return { ok: false, error: `credentials_payload: ${error.message}`, permanent: false };
  if (!data) return { ok: false, error: "No existe la inscripción", permanent: true };
  if (data.registration.status !== "confirmed") {
    return { ok: false, error: "La inscripción ya no está confirmada", permanent: true };
  }
  if (!data.people?.length) return { ok: false, error: "La inscripción no tiene personas con pase", permanent: true };

  const res = await fetch(env("APPS_SCRIPT_URL"), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // Apps Script no lee cabeceras: el secreto va en el cuerpo
    body: JSON.stringify({
      secret: env("APPS_SCRIPT_SECRET"),
      action: "send_credentials",
      outbox_id: row.id,
      to: row.to_email,
      from_name: fromAddress().match(/^"?([^"<]+?)"?\s*</)?.[1] ?? "InspírateUNI",
      subject,
      html,
      text,
      data,
    }),
  });
  if (!res.ok) return { ok: false, error: `apps script: HTTP ${res.status}`, permanent: false };
  const result = await res.json().catch(() => null);
  if (!result?.ok) {
    return { ok: false, error: `apps script: ${result?.error ?? "respuesta no válida"}`, permanent: result?.permanent === true };
  }

  // Si esto falla, el reintento no reenvía el correo: Apps Script devuelve el resultado guardado
  const { error: recordError } = await admin.rpc("record_registration_document", {
    p_registration_id: row.registration_id,
    p_actor_id: null,
    p_kind: "credentials",
    p_drive_file_id: result.file_id,
    p_file_name: result.file_name,
    p_size_bytes: result.size ?? null,
  });
  if (recordError) return { ok: false, error: `registro del PDF: ${recordError.message}`, permanent: false };
  return { ok: true };
}

async function deliver(admin: SupabaseClient, row: OutboxRow): Promise<Outcome> {
  const rendered = render(row.template, row.payload ?? {}, env("SITE_URL").replace(/\/$/, ""));
  if (!rendered) return { ok: false, error: `Plantilla desconocida: ${row.template}`, permanent: true };

  const { subject, html, text } = rendered;
  try {
    return CREDENTIALS_TEMPLATES.has(row.template)
      ? await sendWithCredentials(admin, row, subject, html, text)
      : await sendPlain(row, subject, html, text);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), permanent: false };
  }
}

async function drain(admin: SupabaseClient) {
  const started = Date.now();
  const totals = { sent: 0, retry: 0, failed: 0 };

  while (Date.now() - started < BUDGET_MS) {
    const { data, error } = await admin.rpc("claim_outbox_emails", { p_limit: BATCH, p_max_attempts: MAX_ATTEMPTS });
    if (error) throw error;
    const rows = (data ?? []) as OutboxRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const outcome = await deliver(admin, row);
      const { error: completeError } = await admin.rpc("complete_outbox_email", {
        p_id: row.id,
        p_error: outcome.ok ? null : outcome.error,
        p_permanent: outcome.ok ? false : outcome.permanent,
        p_max_attempts: MAX_ATTEMPTS,
      });
      // Si no se pudo cerrar, la reserva (scheduled_at) lo devuelve a la cola más tarde
      if (completeError) console.error("complete_outbox_email", row.id, completeError);

      if (outcome.ok) totals.sent++;
      else if (outcome.permanent || row.attempts >= MAX_ATTEMPTS) totals.failed++;
      else totals.retry++;
      if (!outcome.ok) console.error(`correo ${row.id} (${row.template}) intento ${row.attempts}: ${outcome.error}`);
    }
  }
  console.log("cola de correos", totals);
  return totals;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(req, { code: "method_not_allowed" }, 405);
  if (!safeEqual(req.headers.get("x-webhook-secret") ?? "", env("EMAIL_WEBHOOK_SECRET"))) {
    return json(req, { code: "unauthorized" }, 401);
  }

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const work = drain(admin).catch((err) => console.error("drain", err));

  // El webhook (pg_net) espera pocos segundos: se responde ya y el trabajo sigue en segundo plano
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(work);
    return json(req, { accepted: true }, 202);
  }
  return json(req, { accepted: true, ...(await work) });
});

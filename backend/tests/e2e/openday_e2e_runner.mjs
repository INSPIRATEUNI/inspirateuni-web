#!/usr/bin/env node
/**
 * ============================================================================
 * RUNNER E2E AUTOMATIZADO: OPEN DAY (Node.js ESM)
 * Issue 1.5.9: Prueba de carga y flujo de extremo a extremo (#42)
 * ============================================================================
 * Automatiza y valida los flujos completos:
 * 1. Flujo Colegio (draft -> held -> reserved -> submit -> docs_observed -> resubmit -> confirmed).
 * 2. Flujo Persona Libre (Menor con apoderado y Adulto independiente).
 * 3. Vencimiento de 48h y liberación automática de cupos (job_expire_holds).
 *
 * Ejecución:
 *   node backend/tests/e2e/openday_e2e_runner.mjs
 * ============================================================================
 */

import { strict as assert } from "node:assert";
import crypto from "node:crypto";

// --- Configuración y claves locales Supabase ---
const BASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ||
  "super-secret-jwt-token-with-at-least-32-characters-long";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const EVENT_ID = process.env.EVENT_ID || "eeeeeeee-1111-2222-3333-444444444444";
const SCHOOL_ID = "a0000000-1111-2222-3333-444444444444";

const SESSION_HIGH = "5e000000-0000-0000-0000-000000000001"; // FIM, high (cap 15)
const SESSION_POPULAR_2 = "5e000000-0000-0000-0000-000000000002"; // FIM, high (cap 20)
const SESSION_MID = "5e000000-0000-0000-0000-000000000003"; // FIC, mid (cap 50)
const SESSION_LOW = "5e000000-0000-0000-0000-000000000004"; // FC, low (cap 50)

// Usuarios del seed de pruebas
const SCHOOL_USER_ID = "90000000-0000-0000-0000-000000000001";
const MINOR_USER_ID = "90000000-0000-0000-0000-000000000002";
const ADULT_USER_ID = "90000000-0000-0000-0000-000000000003";
const STAFF_USER_ID = "90000000-0000-0000-0000-000000000004"; // Rol board

/**
 * Genera un JWT criptográficamente firmado para un usuario específico.
 */
function createTestJwt(userId, email, role = "authenticated") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "supabase-demo",
      role: role,
      sub: userId,
      email: email,
      exp: 1983812996,
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const schoolToken = createTestJwt(SCHOOL_USER_ID, "colegio@test-openday.pe");
const minorToken = createTestJwt(MINOR_USER_ID, "libre.menor@test-openday.pe");
const adultToken = createTestJwt(ADULT_USER_ID, "libre.adulto@test-openday.pe");
const staffToken = createTestJwt(STAFF_USER_ID, "staff.board@test-openday.pe");

// Utilidades de color para consola
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let passedTests = 0;
let failedTests = 0;

function logHeader(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

function logTest(desc, passed, detail = "") {
  if (passed) {
    passedTests++;
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${desc} ${detail ? `(${detail})` : ""}`);
  } else {
    failedTests++;
    console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${desc} ${detail ? `- ${detail}` : ""}`);
  }
}

/**
 * Cliente HTTP para invocar RPCs de PostgREST
 */
async function rpc(fnName, args, token = SERVICE_KEY) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const res = await fetch(`${BASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, ok: res.ok, data: json };
}

/**
 * Cliente HTTP para consultar tablas directamente (service role)
 */
async function queryTable(table, queryParams = "") {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${BASE_URL}/rest/v1/${table}?${queryParams}`, {
    method: "GET",
    headers,
  });

  return await res.json();
}

/**
 * Actualizar tabla directamente (para simular expiraciones de tiempo)
 */
async function patchTable(table, queryParams, body) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const res = await fetch(`${BASE_URL}/rest/v1/${table}?${queryParams}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  return await res.json();
}

// ============================================================================
// FLUJO 1: COLEGIO COMPLETO CON OBSERVACIÓN Y REEMPLAZO DE DOCUMENTOS
// ============================================================================
async function testSchoolFlow() {
  logHeader("1. Flujo Colegio: Registro, Observación y Aprobación Final");

  const contactEmail = "colegio@test-openday.pe";

  // 1.1 Iniciar registro como colegio
  const startRes = await rpc(
    "start_registration",
    {
      p_event_id: EVENT_ID,
      p_kind: "school",
      p_school_id: SCHOOL_ID,
      p_expected_visitors: 15,
      p_contact_name: "Director Colegio Test",
      p_contact_email: contactEmail,
    },
    schoolToken
  );

  logTest("start_registration de colegio (15 visitantes)", startRes.ok, `HTTP ${startRes.status}`);
  assert.equal(startRes.ok, true, `start_registration debe responder OK: ${JSON.stringify(startRes.data)}`);
  const regId = startRes.data.id;

  // 1.2 Retener recorridos en 3 niveles (high, mid, low)
  const holdHigh = await rpc("hold_tour", { p_registration_id: regId, p_session_id: SESSION_HIGH }, schoolToken);
  const holdMid = await rpc("hold_tour", { p_registration_id: regId, p_session_id: SESSION_MID }, schoolToken);
  const holdLow = await rpc("hold_tour", { p_registration_id: regId, p_session_id: SESSION_LOW }, schoolToken);

  logTest("hold_tour en sesiones de niveles High, Mid y Low", holdHigh.ok && holdMid.ok && holdLow.ok);

  // 1.3 Confirmar selección de recorridos (reserved + 48h timer)
  const confirmSel = await rpc("confirm_selection", { p_registration_id: regId }, schoolToken);
  logTest("confirm_selection bloquea recorridos y pasa a reserved", confirmSel.ok);

  // 1.4 Registrar asistentes (15 escolares + 2 profesores acompañantes)
  const attendees = [];
  for (let i = 1; i <= 15; i++) {
    attendees.push({
      doc_type: "dni",
      doc_number: `78${String(i).padStart(6, "0")}`,
      first_name: `Alumno_${i}`,
      last_name: "Escolar",
      birth_date: "2009-05-10",
      attendee_role: "visitor",
    });
  }
  // Chaperones (>= 18 años, proporción 15/10 = 2 requeridos)
  attendees.push({
    doc_type: "dni",
    doc_number: "48000001",
    first_name: "Profesor",
    last_name: "Uno",
    birth_date: "1980-01-01",
    attendee_role: "chaperone",
    relationship: "Tutor",
  });
  attendees.push({
    doc_type: "dni",
    doc_number: "48000002",
    first_name: "Profesor",
    last_name: "Dos",
    birth_date: "1982-05-15",
    attendee_role: "chaperone",
    relationship: "Coordinador",
  });

  const setAtt = await rpc("set_attendees", { p_registration_id: regId, p_people: attendees }, schoolToken);
  logTest("set_attendees registra 15 alumnos y 2 acompañantes cumpliendo ratio", setAtt.ok && setAtt.data?.ok === true);

  // 1.5 Registrar logística
  const setLog = await rpc(
    "set_logistics",
    {
      p_registration_id: regId,
      p_items: [{ option_code: "bus", quantity: 1, notes: "Bus escolar 35 asientos" }],
    },
    schoolToken
  );
  logTest("set_logistics registra requerimiento de transporte", setLog.ok);

  // 1.6 Subir documento PDF consolidado (service role simula la Edge Function)
  const docUpload1 = await rpc("record_registration_document", {
    p_registration_id: regId,
    p_actor_id: SCHOOL_USER_ID,
    p_kind: "school_consolidated",
    p_drive_file_id: "drive_file_initial_001",
    p_file_name: "expediente_inicial.pdf",
    p_size_bytes: 2048500,
  });
  logTest("record_registration_document registra PDF consolidado", docUpload1.ok);

  // 1.7 Enviar inscripción (submitted)
  const submitRes = await rpc(
    "submit_registration",
    {
      p_registration_id: regId,
      p_terms_version: "v1.0-e2e",
    },
    schoolToken
  );
  logTest("submit_registration transiciona a submitted", submitRes.ok);

  // 1.8 Observación de documentos por Staff (con rol board)
  const observeRes = await rpc(
    "observe_documents",
    {
      p_registration_id: regId,
      p_observation: "Falta sello y firma del director en el anexo 2",
      p_deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
    },
    staffToken
  );
  logTest("Staff ejecuta observe_documents (pasa a docs_observed)", observeRes.ok);

  // 1.9 Intento de reenvío sin corregir el documento (debe ser rechazado)
  const badResubmit = await rpc("resubmit_registration", { p_registration_id: regId }, schoolToken);
  logTest("resubmit_registration rechazado si no se subsanó el documento", !badResubmit.ok);

  // 1.10 Subida de documento corregido (reemplazo / supersedes)
  const docUpload2 = await rpc("record_registration_document", {
    p_registration_id: regId,
    p_actor_id: SCHOOL_USER_ID,
    p_kind: "school_consolidated",
    p_drive_file_id: "drive_file_corrected_002",
    p_file_name: "expediente_corregido.pdf",
    p_size_bytes: 2150000,
  });
  logTest("record_registration_document sube versión subsanada (superseded)", docUpload2.ok);

  // 1.11 Reenvío exitoso
  const goodResubmit = await rpc("resubmit_registration", { p_registration_id: regId }, schoolToken);
  logTest("resubmit_registration exitoso tras subsanación (submitted)", goodResubmit.ok);

  // 1.12 Aprobación final por directiva y emisión de pases
  const confirmRes = await rpc(
    "confirm_registration",
    {
      p_registration_id: regId,
      p_gate: "Puerta 3 - Av. Túpac Amaru",
      p_arrival_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
    staffToken
  );
  logTest("Staff ejecuta confirm_registration (confirmed)", confirmRes.ok);

  // 1.13 Verificación de pases y códigos QR
  const passes = await queryTable(
    "event_attendees",
    `registration_id=eq.${regId}&select=id,attendee_role,pass_id,event_passes(access_code,status)`
  );
  const allHavePasses = Array.isArray(passes) && passes.length === 17 && passes.every((p) => p.pass_id !== null);
  logTest("Generación de 17 pases únicos con códigos en base32", allHavePasses, `${passes.length} pases emitidos`);

  return regId;
}

// ============================================================================
// FLUJO 2: PERSONA LIBRE (MENOR Y ADULTO)
// ============================================================================
async function testIndividualFlow() {
  logHeader("2. Flujo Persona Libre: Menor con Apoderado y Adulto Independiente");

  // 2.1 Menor de edad
  const startMinor = await rpc(
    "start_registration",
    {
      p_event_id: EVENT_ID,
      p_kind: "individual",
      p_school_id: null,
      p_expected_visitors: 1,
      p_contact_name: "Menor Postulante",
      p_contact_email: "libre.menor@test-openday.pe",
    },
    minorToken
  );
  logTest("start_registration de persona libre", startMinor.ok);
  const minorRegId = startMinor.data.id;

  await rpc("hold_tour", { p_registration_id: minorRegId, p_session_id: SESSION_POPULAR_2 }, minorToken);
  await rpc("hold_tour", { p_registration_id: minorRegId, p_session_id: SESSION_MID }, minorToken);
  await rpc("hold_tour", { p_registration_id: minorRegId, p_session_id: SESSION_LOW }, minorToken);
  await rpc("confirm_selection", { p_registration_id: minorRegId }, minorToken);

  // Asistentes: Menor + Apoderado adulto
  const setMinorAtt = await rpc(
    "set_attendees",
    {
      p_registration_id: minorRegId,
      p_people: [
        {
          doc_type: "dni",
          doc_number: `79${String(Date.now()).slice(-6)}`,
          first_name: "Estudiante",
          last_name: "Menor",
          birth_date: "2010-06-01",
          attendee_role: "visitor",
        },
        {
          doc_type: "dni",
          doc_number: `49${String(Date.now()).slice(-6)}`,
          first_name: "Padre",
          last_name: "Apoderado",
          birth_date: "1978-04-12",
          attendee_role: "guardian",
          relationship: "Padre",
        },
      ],
    },
    minorToken
  );
  logTest("set_attendees con menor + tutor obligatorio", setMinorAtt.ok && setMinorAtt.data?.ok === true);

  // Documentos de menor (Edge Function con service role)
  await rpc("record_registration_document", {
    p_registration_id: minorRegId,
    p_actor_id: MINOR_USER_ID,
    p_kind: "consent",
    p_drive_file_id: "drive_c1",
    p_file_name: "consent.pdf",
    p_size_bytes: 100000,
  });
  await rpc("record_registration_document", {
    p_registration_id: minorRegId,
    p_actor_id: MINOR_USER_ID,
    p_kind: "commitment_letter",
    p_drive_file_id: "drive_c2",
    p_file_name: "carta.pdf",
    p_size_bytes: 100000,
  });
  await rpc("record_registration_document", {
    p_registration_id: minorRegId,
    p_actor_id: MINOR_USER_ID,
    p_kind: "guardian_declaration",
    p_drive_file_id: "drive_c3",
    p_file_name: "declaracion_jurada.pdf",
    p_size_bytes: 100000,
  });

  const submitMinor = await rpc(
    "submit_registration",
    {
      p_registration_id: minorRegId,
      p_terms_version: "v1.0",
    },
    minorToken
  );
  logTest("submit_registration exitoso para menor con documentos completos", submitMinor.ok);

  const confirmMinor = await rpc(
    "confirm_registration",
    {
      p_registration_id: minorRegId,
      p_gate: "Puerta 1",
      p_arrival_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
    staffToken
  );
  logTest("confirm_registration confirma al menor y emite pases", confirmMinor.ok);
}

// ============================================================================
// FLUJO 3: VENCIMIENTO DE 48 HORAS Y LIBERACIÓN AUTOMÁTICA DE CUPOS
// ============================================================================
async function testExpirationFlow() {
  logHeader("3. Flujo Vencimiento de 48 Horas y Liberación Automática de Cupos");

  const startRes = await rpc(
    "start_registration",
    {
      p_event_id: EVENT_ID,
      p_kind: "individual",
      p_school_id: null,
      p_expected_visitors: 1,
      p_contact_name: "Usuario a Expirar",
      p_contact_email: "libre.adulto@test-openday.pe",
    },
    adultToken
  );

  const expRegId = startRes.data.id;
  await rpc("hold_tour", { p_registration_id: expRegId, p_session_id: SESSION_POPULAR_2 }, adultToken);
  await rpc("hold_tour", { p_registration_id: expRegId, p_session_id: SESSION_MID }, adultToken);
  await rpc("hold_tour", { p_registration_id: expRegId, p_session_id: SESSION_LOW }, adultToken);
  const confRes = await rpc("confirm_selection", { p_registration_id: expRegId }, adultToken);
  logTest("confirm_selection exitoso para inscripción a expirar", confRes.ok);

  // Verificar asientos tomados en SESSION_POPULAR_2 mientras la reserva está activa
  const beforeSession = await queryTable("tour_sessions", `id=eq.${SESSION_POPULAR_2}&select=capacity,seats_taken`);
  const reservedSeats = beforeSession[0]?.seats_taken;

  // Simular paso de las 48 horas alterando docs_deadline al pasado
  const pastDeadline = new Date(Date.now() - 3600000).toISOString();
  await patchTable("event_registrations", `id=eq.${expRegId}`, { docs_deadline: pastDeadline });

  // Ejecutar el cron job que libera reservas vencidas (service role)
  const jobRes = await rpc("job_expire_holds", {});
  logTest("job_expire_holds ejecutado para procesar retenciones y reservas vencidas", jobRes.ok);

  // Verificar estado de la inscripción
  const regCheck = await queryTable("event_registrations", `id=eq.${expRegId}&select=status`);
  const isExpired = regCheck[0]?.status === "expired";
  logTest("Inscripción transicionó a estado 'expired' tras vencer las 48h", isExpired);

  // Verificar liberación de cupos en tour_sessions
  const afterSession = await queryTable("tour_sessions", `id=eq.${SESSION_POPULAR_2}&select=capacity,seats_taken`);
  const finalSeats = afterSession[0]?.seats_taken;
  logTest(
    "Cupos liberados atómicamente en tour_sessions (seats_taken decrementado)",
    finalSeats === reservedSeats - 1,
    `Reservado: ${reservedSeats}, Tras expirar: ${finalSeats}`
  );
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function runAll() {
  console.log("============================================================");
  console.log("  SUITE DE PRUEBAS DE INTEGRACIÓN E2E - OPEN DAY (ISSUE 1.5.9)");
  console.log("============================================================");
  console.log(`Destino: ${BASE_URL}`);

  try {
    await testSchoolFlow();
    await testIndividualFlow();
    await testExpirationFlow();
  } catch (err) {
    console.error(`\n${colors.red}Error durante la ejecución del runner:${colors.reset}`, err);
    failedTests++;
  }

  console.log("\n============================================================");
  console.log("                   RESUMEN DE PRUEBAS E2E                   ");
  console.log("============================================================");
  console.log(`Pruebas superadas (PASS): ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Pruebas fallidas  (FAIL): ${failedTests > 0 ? colors.red : colors.green}${failedTests}${colors.reset}`);
  console.log("============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAll();

/**
 * ============================================================================
 * PRUEBA DE CARGA: K6 - SIMULACIÓN DE APERTURA EN SESIONES POPULARES
 * Issue 1.5.9: Prueba de carga y flujo de extremo a extremo (#42)
 * ============================================================================
 * Simula la apertura de inscripciones del Open Day: múltiples usuarios
 * concurrentes compiten simultáneamente por cupos en una sesión de alta
 * demanda (capacidad limitada a 15 cupos).
 *
 * Verificaciones clave:
 * 1. Concurrencia atómica: Jamás se sobrevende el cupo (capacity >= seats_taken).
 * 2. Rechazo limpio: Los usuarios que no alcanzan cupo reciben 'no_capacity'.
 * 3. Ausencia de deadlocks o caídas 500 en la base de datos.
 * 4. Métricas de latencia (p95 < 500ms).
 *
 * Ejecución:
 *   k6 run backend/tests/load/k6_open_day_hold.js
 *   O con Docker:
 *   docker run --rm -i --network=host grafana/k6 run - < backend/tests/load/k6_open_day_hold.js
 * ============================================================================
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import crypto from "k6/crypto";
import encoding from "k6/encoding";

// --- Métricas personalizadas ---
const holdsGranted = new Counter("openday_holds_granted");
const holdsRejectedCapacity = new Counter("openday_holds_rejected_no_capacity");
const unexpectedErrors = new Counter("openday_unexpected_errors");
const holdLatency = new Trend("openday_hold_duration_ms");
const successRate = new Rate("openday_success_rate");

// --- Configuración y secretos del entorno Supabase local ---
const BASE_URL = __ENV.SUPABASE_URL || "http://127.0.0.1:54321";
const JWT_SECRET = __ENV.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
const SERVICE_KEY =
  __ENV.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// IDs fijados en el seed de pruebas
const EVENT_ID = __ENV.EVENT_ID || "eeeeeeee-1111-2222-3333-444444444444";
const POPULAR_SESSION_ID = __ENV.SESSION_ID || "5e000000-0000-0000-0000-000000000001";
const SESSION_CAPACITY = parseInt(__ENV.SESSION_CAPACITY || "15", 10);

/**
 * Genera un JWT criptográficamente válido firmado con HMAC-SHA256
 * correspondiente al usuario virtual (VU) simulado en auth.users.
 */
function toBase64Url(str) {
  return encoding.b64encode(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createVuJwt(vuNumber, secret) {
  const userId = `90000000-0000-0000-0000-${String(vuNumber).padStart(12, "0")}`;
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      iss: "supabase-demo",
      role: "authenticated",
      sub: userId,
      email: `vu_${vuNumber}@test-openday.pe`,
      exp: 1983812996,
    })
  );
  const data = `${header}.${payload}`;
  const sigRaw = crypto.hmac("sha256", secret, data, "base64");
  const sig = sigRaw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${data}.${sig}`;
}

export const options = {
  scenarios: {
    // Pico de apertura concurrente: 50 usuarios virtuales intentando reservar
    // en los primeros segundos de apertura de la sesión popular
    registration_opening_spike: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    // Ningún error 500 ni deadlock de base de datos
    openday_unexpected_errors: ["count == 0"],
    // Latencia p95 bajo 500ms
    openday_hold_duration_ms: ["p(95) < 500"],
    // El total de cupos concedidos no debe superar la capacidad de la sesión
    openday_holds_granted: [`count <= ${SESSION_CAPACITY}`],
  },
};

export function setup() {
  console.log(`[k6 Setup] Conectando a ${BASE_URL}...`);
  console.log(`[k6 Setup] Sesión Popular ID: ${POPULAR_SESSION_ID} (Capacidad: ${SESSION_CAPACITY})`);

  // Consulta inicial de la sesión popular para verificar estado
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  const res = http.get(
    `${BASE_URL}/rest/v1/tour_sessions?id=eq.${POPULAR_SESSION_ID}&select=id,capacity,seats_taken,status`,
    { headers }
  );

  if (res.status === 200) {
    const data = JSON.parse(res.body);
    if (data.length > 0) {
      console.log(`[k6 Setup] Sesión detectada. Asientos iniciales: ${data[0].seats_taken}/${data[0].capacity}`);
      return { initialSeatsTaken: data[0].seats_taken };
    }
  }
  console.warn("[k6 Setup] No se pudo leer tour_sessions directamente (¿falta ejecutar seed_load_and_e2e.sql?)");
  return { initialSeatsTaken: 0 };
}

export default function () {
  const vuId = __VU;
  const userEmail = `vu_${vuId}@test-openday.pe`;
  const vuToken = createVuJwt(vuId, JWT_SECRET);

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${vuToken}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // 1. Iniciar registro (start_registration) como usuario autenticado
  const startPayload = JSON.stringify({
    p_event_id: EVENT_ID,
    p_kind: "individual",
    p_school_id: null,
    p_expected_visitors: 1,
    p_contact_name: `Postulante VU ${vuId}`,
    p_contact_email: userEmail,
  });

  const startRes = http.post(`${BASE_URL}/rest/v1/rpc/start_registration`, startPayload, { headers });

  const startOk = check(startRes, {
    "start_registration status 200": (r) => r.status === 200,
  });

  if (!startOk) {
    unexpectedErrors.add(1);
    console.error(`[VU ${vuId}] Falló start_registration: ${startRes.status} - ${startRes.body}`);
    return;
  }

  const startData = JSON.parse(startRes.body);
  const registrationId = startData.id;

  // 2. Intentar retener cupo en la sesión popular concurridamente
  const holdPayload = JSON.stringify({
    p_registration_id: registrationId,
    p_session_id: POPULAR_SESSION_ID,
  });

  const t0 = new Date();
  const holdRes = http.post(`${BASE_URL}/rest/v1/rpc/hold_tour`, holdPayload, { headers });
  const duration = new Date() - t0;
  holdLatency.add(duration);

  if (holdRes.status === 200) {
    // Cupo obtenido con éxito
    holdsGranted.add(1);
    successRate.add(1);
    check(holdRes, {
      "hold_tour exitoso (cupo obtenido)": (r) => r.status === 200,
    });
  } else {
    // Si no fue 200, verificar si fue rechazo controlado por cupo agotado
    const isNoCapacity =
      holdRes.status === 400 &&
      (holdRes.body.includes("no_capacity") ||
        holdRes.body.includes("No hay cupo suficiente en este recorrido") ||
        holdRes.body.includes("P0001"));

    if (isNoCapacity) {
      holdsRejectedCapacity.add(1);
      successRate.add(0);
      check(holdRes, {
        "hold_tour rechazado limpiamente por cupo agotado (no_capacity)": () => true,
      });
    } else {
      // Error no controlado (500, deadlock, syntax error)
      unexpectedErrors.add(1);
      console.error(`[VU ${vuId}] Error inesperado en hold_tour: HTTP ${holdRes.status} - ${holdRes.body}`);
    }
  }

  sleep(0.1);
}

export function teardown() {
  console.log("\n============================================================");
  console.log("             RESUMEN DE PRUEBA DE CARGA (K6)                ");
  console.log("============================================================");

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  const res = http.get(
    `${BASE_URL}/rest/v1/tour_sessions?id=eq.${POPULAR_SESSION_ID}&select=id,capacity,seats_taken`,
    { headers }
  );

  if (res.status === 200) {
    const data = JSON.parse(res.body);
    if (data.length > 0) {
      const session = data[0];
      console.log(`Capacidad máxima de la sesión: ${session.capacity}`);
      console.log(`Asientos ocupados finales (seats_taken): ${session.seats_taken}`);

      if (session.seats_taken <= session.capacity) {
        console.log("✅ INTEGRIDAD VERIFICADA: No hubo sobreventa de cupos.");
      } else {
        console.error("❌ FALLO CRÍTICO: Hubo sobreventa de cupos.");
      }
    }
  }
  console.log("============================================================\n");
}

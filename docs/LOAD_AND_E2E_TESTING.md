# Guía de Pruebas de Carga y Flujo de Extremo a Extremo (Issue 1.5.9)

Este documento detalla la implementación, arquitectura y ejecución de las pruebas requeridas en la **Issue 1.5.9: Prueba de carga y flujo de extremo a extremo (#42)**.

---

## 1. Alcance de las Pruebas

1. **Prueba de Carga (k6 y pgbench)**:
   - Simula la **apertura de inscripciones del Open Day** sobre sesiones populares (`tier = 'high'`) con cupo reducido (ej. 15 plazas).
   - Valida la **concurrencia atómica** (`SELECT ... FOR UPDATE` y `CHECK (seats_taken <= capacity)`), garantizando que **jamás se sobrevenda un cupo**.
   - Verifica el **rechazo limpio con código de negocio `no_capacity`** sin bloqueos (_deadlocks_ de Postgres `40P01`) ni caídas con error 500.
   - Mide tiempos de respuesta ($p_{95} < 500\text{ ms}$).

2. **Automatización del Flujo de Extremo a Extremo (E2E)**:
   - **Flujo Colegio**: `draft` $\to$ `held` $\to$ `reserved` $\to$ carga masiva de asistentes (ratio mínimo de acompañantes $\ge 1:10$) $\to$ logística $\to$ subida de PDF consolidado $\to$ `submitted` $\to$ **observación de documentos por el staff** (`docs_observed`) $\to$ rechazo de reenvío sin corrección $\to$ **reemplazo del documento** (`superseded_at`) $\to$ reenvío exitoso $\to$ **confirmación por el staff con asignación de puerta/hora** $\to$ `confirmed` y generación de pases con códigos únicos en Crockford Base32.
   - **Flujo Persona Libre**: Registro individual para menor de edad (exige apoderado $\ge 18$ años y 3 documentos firmados) y para adulto independiente (sin apoderado y 2 documentos).
   - **Vencimiento de 48 Horas**: Verificación del job programado de `pg_cron` (`job_expire_holds`), confirmando que si una reserva pasa de su `docs_deadline`, transiciona a `expired`, libera automáticamente los asientos en `tour_sessions`, y encola el correo `reservation_expired`.

---

## 2. Componentes y Archivos Creados

| Archivo                                                                                                                                                     | Propósito                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`backend/supabase/tests/database/14_openday_e2e.test.sql`](file:///home/albecamp/inspirateuni-web/backend/supabase/tests/database/14_openday_e2e.test.sql) | Suite completa en **pgTAP** con 54 aserciones unitarias e integrales que validan colegio, persona libre, observación y expiración de 48h. |
| [`backend/tests/fixtures/seed_load_and_e2e.sql`](file:///home/albecamp/inspirateuni-web/backend/tests/fixtures/seed_load_and_e2e.sql)                       | Fixture determinista con eventos, sesiones populares de prueba, tiers y usuarios para pruebas locales o CI.                               |
| [`backend/tests/load/k6_open_day_hold.js`](file:///home/albecamp/inspirateuni-web/backend/tests/load/k6_open_day_hold.js)                                   | Script de prueba de carga en **k6** que simula un pico de apertura con 50 usuarios virtuales compitiendo por cupos.                       |
| [`backend/tests/load/pgbench_openday_hold.sql`](file:///home/albecamp/inspirateuni-web/backend/tests/load/pgbench_openday_hold.sql)                         | Script transaccional para **pgbench** que somete a estrés de concurrencia atómica la función `hold_tour`.                                 |
| [`backend/tests/load/run_pgbench.sh`](file:///home/albecamp/inspirateuni-web/backend/tests/load/run_pgbench.sh)                                             | Runner para ejecutar pgbench y verificar automáticamente la integridad de cupos post-ejecución.                                           |
| [`backend/tests/e2e/openday_e2e_runner.mjs`](file:///home/albecamp/inspirateuni-web/backend/tests/e2e/openday_e2e_runner.mjs)                               | Runner automatizado en **Node.js** que ejecuta llamadas HTTP/PostgREST reales contra cualquier entorno Supabase.                          |

---

## 3. Guía Paso a Paso para Ejecutar las Pruebas

### Paso 1: Inicialización del Entorno

Desde la raíz del repositorio, ejecuta:

```bash
make init
```

_Esto instalará todas las dependencias del proyecto raíz y del frontend, y configurará los Git Hooks de Husky._

---

### Paso 2: Iniciar y Restablecer Supabase Local

En una terminal con Docker activo:

```bash
cd backend
npx supabase start
npx supabase db reset
cd ..
```

> **Importante (`npx supabase db reset`):**
> Al iniciar Supabase por primera vez o tras actualizar esquemas, es necesario inicializar la base de datos con las migraciones acumuladas (`activity_types`, `events`, `openday_rpc`, etc.).
>
> 💡 **Tip para entornos WSL2 o con poca RAM:**
> Si `db reset` se congela debido al consumo de memoria de Docker, puedes:
> 1. Iniciar Supabase excluyendo contenedores no esenciales:
>    ```bash
>    cd backend && npx supabase start -x realtime,vector,storage-api --ignore-health-check && cd ..
>    ```
> 2. Cargar los esquemas y catálogos en segundos con el comando:
>    ```bash
>    make db-setup
>    ```
>    ```

---

### Paso 3: Ejecutar la Suite E2E de Base de Datos (pgTAP)

Para correr todas las pruebas de base de datos (incluyendo la nueva `14_openday_e2e.test.sql`):

```bash
# Con Make:
make test-db

# O con npm:
npm run test:e2e:db
```

**Resultado esperado:**
Todas las pruebas de `14_openday_e2e.test.sql` deben reportar `ok` (54/54 aserciones superadas).

---

### Paso 4: Ejecutar el Runner de Integración E2E (Node.js)

Para simular el flujo completo mediante llamadas HTTP/PostgREST reales:

```bash
# Con Make:
make test-e2e

# O con npm:
npm run test:e2e:openday
```

**Flujos validados:**

1. Colegio completo: registro $\to$ selección $\to$ carga masiva $\to$ observación por staff $\to$ subsanación $\to$ confirmación y emisión de pases.
2. Persona libre (menor con apoderado y adulto).
3. Expiración de 48h con liberación atómica de cupos en `tour_sessions`.

---

### Paso 5: Ejecutar la Prueba de Carga con k6

Para simular la apertura simultánea de inscripciones compitiendo por la sesión popular:

```bash
# Con Make (detecta k6 nativo o usa Docker automáticamente):
make test-load-k6

# O con npm:
npm run test:load:k6
```

**Métricas y Umbrales evaluados por k6:**

- `openday_unexpected_errors == 0` (cero errores 500 y cero deadlocks).
- `openday_holds_granted <= 15` (jamás se sobrevendió la capacidad de la sesión).
- `openday_hold_duration_ms: p(95) < 500` (latencia p95 menor a 500 ms).

---

### Paso 6: Ejecutar el Benchmark de Concurrencia con pgbench

Para evaluar la velocidad transaccional de PostgreSQL en contención de bloqueos:

```bash
# Con Make:
make test-load-pgbench

# O con npm:
npm run test:load:pgbench
```

Al terminar, el script imprimirá el estado de integridad confirmando que `seats_taken <= capacity`.

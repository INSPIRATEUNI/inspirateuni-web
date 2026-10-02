<style>
  /* 1. Fondo oscuro para las páginas del PDF */
  @page {
    background-color: #1e1e1e !important;
    margin: 20mm;
  }
  
  /* 2. Fondo oscuro y texto claro para todo el documento */
  html, body {
    background-color: #1e1e1e !important;
    color: #e0e0e0 !important;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14pt;
    line-height: 1.6;
  }

  /* Respetar saltos de línea */
  p, li, div {
    white-space: pre-wrap;
  }

  /* 3. Títulos con contraste */
  h1, h2, h3, h4 {
    color: #4da6ff !important;
    margin-top: 20px;
    border-bottom: 1px solid #333333;
    padding-bottom: 5px;
  }

  /* 4. Listas y textos claros */
  li, p, strong, em {
    color: #e0e0e0 !important;
  }

  /* 5. Bloques de código */
  code {
    background-color: #2d2d2d !important;
    color: #ff79c6 !important;
    padding: 3px 6px;
    border-radius: 4px;
  }

  /* 6. Centrar imágenes y forzar fondo blanco SOLO en ellas */
  img {
    display: block !important;
    margin: 20px auto !important; /* Centra la imagen horizontalmente */
    max-width: 100% !important;
    background-color: #ffffff !important; /* Fondo blanco exclusivo de la imagen */
    padding: 15px !important; /* Margen interno para que las letras no toquen el borde */
    border-radius: 8px !important; /* Suaviza las esquinas del recuadro blanco */
  }

  /* Remover cualquier filtro de inversión previo */
  img[src$=".svg"] {
    filter: none !important;
  }
</style>

# Modelo de Datos - Web Inspírate UNI 2.0

Diseño lógico de la base de datos (borrador). Aún no está implementado en `backend/supabase/schemas/`. Complementa la sección 3 de [ARQUITECTURE.md](./ARQUITECTURE.md).

## 1. Diagrama entidad-relación

![Diagrama entidad-relación](./visuals/latex/modelo_datos/bd.svg)

Fuente editable: `visuals/latex/modelo_datos/bd.tex`. Para regenerar el SVG (desde esa carpeta): `pdflatex bd.tex` y luego `dvisvgm --pdf bd.pdf -o bd.svg`.

## 2. Módulos

| Módulo | Tablas | Propósito |
|---|---|---|
| Núcleo | `profiles`, `programs`, `areas`, `management_periods`, `organizational_roles`, `position_assignments` | Personas, cargos por período y área |
| Tareas y horas | `activity_types`, `tasks`, `task_assignments`, `task_submissions`, `submission_evidences` | Asignar tareas, reportar horas con evidencia y revisión de directores |
| OVPGES | `availability_slots`, `ovpg_bookings` | Disponibilidad de voluntarios e inscripción grupal de escolares |
| Open Day | `events`, `event_registrations`, `event_attendees` | Inscripción individual y por colegio |
| Participantes | `participants`, `schools`, `guardian_consents` | Escolares y externos (sin cuenta), con autorización de apoderado |
| Convocatorias | `volunteer_calls`, `applications` | Reclutamiento de voluntarios |

## 3. Decisiones tomadas

### 3.1 Sesiones OVPGES grupales
- Un `availability_slot` es un bloque con `capacity` (por defecto 10). Muchos escolares reservan el mismo bloque, cada uno con su fila en `ovpg_bookings`.
- El bloque pasa a `full` al llegar al cupo y se vuelve a `open` si alguien cancela. El portal público solo lista bloques `open`, a través de una vista segura que no expone al voluntario.
- La reserva pasa por una función RPC atómica (`book_ovpg()`), que bloquea el slot y valida el cupo.

### 3.2 Identidad con OTP y límite semanal
- El escolar se verifica con un OTP al correo **al momento de inscribirse** (no necesita cuenta permanente).
- `participants` tiene `dni` y `email` únicos, para que una persona no se duplique.
- Límite: `ovpg_bookings.week_start` (lunes de la semana del bloque, en `America/Lima`) con `UNIQUE (participant_id, week_start) WHERE status <> 'cancelled'`. Una persona no puede inscribirse a más de un bloque por semana, y no puede reservar todos los horarios.
- `book_ovpg()` también valida el límite y devuelve un error claro antes de intentar el insert.
- Interpretación: "una por semana" es por semana calendario (lunes a domingo). Si se quiere una ventana móvil de 7 días desde la última inscripción, la regla pasa de índice único a validación en la función.

### 3.3 Horas con peso
- `tasks.activity_type_id` apunta a `activity_types.weight` (casi siempre 1).
- Al aprobar, `task_submissions` guarda `weight_applied` (copia del peso en ese momento, para que cambiar el peso después no altere horas ya aprobadas).
- `counted_hours = approved_hours × weight_applied` (columna generada). Este valor es el que entra al reporte.
- La vista `extracurricular_hours` suma `counted_hours` de las entregas aprobadas por voluntario y período. Es una vista, no una tabla.

### 3.4 Quién crea tareas
- `organizational_roles` tiene `access_level` (`board` / `volunteer`) y `is_global` (true para presidente y vice).
- Directores: solo crean y revisan tareas de su propia área.
- Presidente y vice (`is_global`): crean y revisan tareas de **todas** las áreas.
- Se aplica en las políticas RLS de `tasks`, `task_assignments` y `task_submissions`.

### 3.5 Menores de edad
- `participants.birth_date` es obligatorio.
- `guardian_consents(id, participant_id, guardian_name, guardian_dni, guardian_contact, document_path, accepted_at, valid_until)`: la autorización firmada se sube a Supabase Storage.
- `book_ovpg()` y el registro al Open Day rechazan a un menor de 18 años sin una autorización vigente.

### 3.6 Open Day con información completa
- `event_registrations`: el trámite. `kind` es `individual` o `school`. En colegios guarda `school_id`, contacto responsable y `authorization_path` (autorización del colegio o de los apoderados).
- `event_attendees`: una fila por alumno. Cada uno se vincula a un `participants` con datos completos: nombres, DNI, fecha de nacimiento, grado y, si se tiene, correo.
- Los colegios suben la lista (formulario o CSV). Se valida en el servidor y se insertan los asistentes en una sola transacción.
- `UNIQUE (event_id, participant_id)` evita duplicados. Para poder imponerlo, `event_attendees` guarda también `event_id` (copia de `event_registrations.event_id`, validada con un trigger). El check-in es individual (`checked_in_at`).
- Los alumnos de un colegio no pasan por OTP individual (el responsable del colegio se verifica con OTP). Por eso `participants.email` admite NULL, único cuando existe.

## 4. Reglas generales a imponer en la BD

- **Autenticación:** `profiles.id` referencia `auth.users.id`; no se guarda contraseña.
- **Autorización:** RLS según la asignación activa (`access_level`, `is_global`, `area_id`).
- **Un período activo:** índice único parcial sobre `management_periods` con `state = 'active'`.
- **Estados** como enums de Postgres, no texto libre.
- **Flujo de entrega:** `assigned → submitted → approved | rejected` (con `reviewed_by` y `reviewed_at`).
- **Sin solapes:** `EXCLUDE USING gist` sobre el rango de cada voluntario en `availability_slots`.

## 5. Pendiente de definir

1. ¿Hay tareas abiertas que los voluntarios puedan tomar, o las asigna siempre un director?
2. ¿Se permite reportar horas sin tarea previa?
3. Vigencia de la autorización de un menor: ¿por evento, por año o indefinida?
4. Semana calendario o ventana móvil de 7 días para el límite de OVPGES (ver 3.2).
5. Alumnos de colegio sin DNI (extranjeros o muy pequeños): ¿se admite otro documento?

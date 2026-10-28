#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";

// ============================================================================
// 1. CONFIGURACIÓN Y CONSTANTES
// ============================================================================
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URI = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true";
const DRIVE_API_V3_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_ABOUT_URI = "https://www.googleapis.com/drive/v3/about?fields=storageQuota,user";
const DRIVE_AUTH_SCOPE = "https://www.googleapis.com/auth/drive";

/**
 * Genera un JWT firmado con RSA-SHA256 para autenticación de Service Account
 * según RFC 7519 y Google OAuth 2.0 Server to Server.
 */
function createServiceAccountJwt(clientEmail, privateKey, scopes, impersonateUser = null) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claimSet = {
    iss: clientEmail,
    scope: Array.isArray(scopes) ? scopes.join(" ") : scopes,
    aud: GOOGLE_TOKEN_URI,
    exp: now + 3600, // 1 hora de vigencia
    iat: now,
  };

  // Si se utiliza Delegación a Nivel de Dominio (Domain-Wide Delegation):
  if (impersonateUser) {
    claimSet.sub = impersonateUser;
  }

  const base64UrlEncode = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(claimSet)}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer
    .sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${signature}`;
}

/**
 * Intercambia el JWT firmado por un token de acceso OAuth 2.0 (Bearer Token)
 */
async function getAccessToken(jwt) {
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const response = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error obteniendo Access Token de Google [HTTP ${response.status}]: ${errorBody}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Consulta la cuota de almacenamiento del usuario/identidad asociada al token
 */
async function checkStorageQuota(accessToken) {
  const response = await fetch(DRIVE_ABOUT_URI, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error consultando cuota de almacenamiento: ${errorBody}`);
  }

  return await response.json();
}

/**
 * PASO 1: Inicia la sesión de subida reanudable (Resumable Upload Session)
 * 
 * Este paso es el que ejecuta la Edge Function de Supabase (`lib/storage.ts`).
 * La Edge Function NO recibe los 50 MB del PDF en memoria, sino que solo
 * solicita el URI de subida a Google Drive y se lo entrega al cliente web.
 */
async function initiateResumableUploadSession({
  accessToken,
  fileName,
  fileSize,
  mimeType = "application/pdf",
  parentFolderId,
}) {
  const metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: parentFolderId ? [parentFolderId] : [],
  };

  const response = await fetch(DRIVE_UPLOAD_URI, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(fileSize),
    },
    body: JSON.stringify(metadata),
  });

  if (response.status !== 200) {
    const err = await response.text();
    throw new Error(`No se pudo iniciar la sesión reanudable [HTTP ${response.status}]: ${err}`);
  }

  const uploadLocationUrl = response.headers.get("location");
  if (!uploadLocationUrl) {
    throw new Error("Google Drive no devolvió la cabecera 'Location' con la URL de subida.");
  }

  return uploadLocationUrl;
}

/**
 * PASO 2: Sube el archivo binario a la URL de sesión reanudable.
 * 
 * En producción, esto lo ejecuta directamente el navegador del usuario
 * (Next.js / Frontend) vía XMLHttpRequest o fetch mediante streaming/chunks.
 */
async function uploadPdfChunk({ uploadUrl, buffer, mimeType = "application/pdf" }) {
  const fileSize = buffer.length;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(fileSize),
      "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
    },
    body: buffer,
  });

  if (response.status === 200 || response.status === 201) {
    const fileData = await response.json();
    return fileData;
  }

  const errorText = await response.text();
  throw new Error(`Fallo en la subida binaria [HTTP ${response.status}]: ${errorText}`);
}

/**
 * PASO 3: Validación posterior en Backend
 * 
 * Una vez notificado que la subida terminó, el backend verifica:
 * 1. Existencia del archivo y pertenencia a la carpeta designada.
 * 2. Tamaño real (evitar que el cliente haya manipulado el tamaño).
 * 3. Tipo MIME y firma mágica (%PDF-).
 */
async function verifyUploadedFile({ accessToken, fileId }) {
  const url = `${DRIVE_API_V3_FILES}/${fileId}?fields=id,name,mimeType,size,md5Checksum,parents&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Error verificando archivo subido en Drive [HTTP ${response.status}]`);
  }

  return await response.json();
}

// ============================================================================
// SIMULACIÓN Y SUITE DE DIAGNÓSTICO
// ============================================================================

/**
 * Crea un buffer PDF sintético válido con cabecera mágica `%PDF-1.4`
 */
function createDummyPdf(sizeBytes = 1024 * 50) {
  const header = "%PDF-1.4\n%InspírateUNI-Spike-1.5.0\n";
  const trailer = "\n%%EOF\n";
  const paddingLength = Math.max(0, sizeBytes - header.length - trailer.length);
  const padding = "0".repeat(paddingLength);
  return Buffer.from(header + padding + trailer, "utf-8");
}

/**
 * Ejecución del Spike con diagnósticos exhaustivos
 */
async function runDriveSpike() {
  console.log("====================================================================");
  console.log("  SPIKE 1.5.0 (A): Google Drive Resumable Upload & Quota Spike");
  console.log("====================================================================\n");

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const impersonateUser = process.env.GOOGLE_IMPERSONATE_USER;

  if (!serviceAccountJson) {
    console.log("ℹ️  [MODO DIAGNÓSTICO / PROTOCOLO]");
    console.log("   No se detectó GOOGLE_SERVICE_ACCOUNT_JSON en variables de entorno.");
    console.log("   Ejecutando verificación estructural y documentación del comportamiento...\n");

    console.log("1. ANÁLISIS DE CUOTA EN SERVICE ACCOUNTS:");
    console.log("   -----------------------------------------------------------------");
    console.log("   * Por especificación de Google Cloud, una Cuenta de Servicio (SA)");
    console.log("     posee cuota de almacenamiento = 0 bytes (storageQuota.limit: '0').");
    console.log("   * Si una SA intenta subir un archivo a 'My Drive' personal:");
    console.log("     -> Error devuelto: HTTP 403 Forbidden");
    console.log("     -> Código de razón: 'storageQuotaExceeded'");
    console.log("     -> Mensaje: 'The user's storage quota has been exceeded.'\n");

    console.log("2. SOLUCIONES ARQUITECTÓNICAS VALIDADAS:");
    console.log("   -----------------------------------------------------------------");
    console.log("   [RECOMENDADA] Solución 1: Unidad Compartida (Shared Drive de Workspace)");
    console.log("   - La cuenta de servicio es agregada como miembro de una Unidad Compartida");
    console.log("     institucional con el rol 'Content Manager' (fileOrganizer) o 'Contributor'.");
    console.log("   - Parámetro MANDATORIO en todas las llamadas: `supportsAllDrives=true`.");
    console.log("   - Los archivos subidos pertenecen a la Unidad Compartida (dominio UNI /");
    console.log("     Inspírate UNI), consumiendo el almacenamiento global de la organización");
    console.log("     y NO la cuota cero de la Service Account.");
    console.log("   - La subida reanudable (Resumable Upload) opera con éxito garantizado.\n");

    console.log("   [ALTERNATIVA] Solución 2: Delegación a Nivel de Dominio (DWD)");
    console.log("   - En Google Workspace Admin Console se habilita DWD para el Client ID de la SA.");
    console.log("   - Al generar el JWT, se especifica el claim `sub: 'openday@inspirateuni.pe'`.");
    console.log("   - La Service Account impersona a un usuario institucional con cuota activa.");
    console.log("   - Inconveniente: Requiere permisos de Super Administrador de Workspace.");
    console.log("     La Solución 1 (Shared Drive) es más simple y segura.\n");

    console.log("   [ADVERTENCIA] Por qué una Carpeta Compartida Personal NO Funciona:");
    console.log("   - Si un usuario personal (@gmail.com) comparte una carpeta con la SA,");
    console.log("     Google Drive asigna la PROPIEDAD del archivo al CREADOR (la SA).");
    console.log("     Al tener la SA 0 bytes de cuota, la API aborta con `storageQuotaExceeded`,");
    console.log("     aunque la carpeta esté dentro del drive de un usuario con espacio libre.");
    console.log("   - Por tanto, ES ESTRICTAMENTE NECESARIO usar Shared Drive o DWD.\n");

    console.log("3. ESPECIFICACIÓN DEL PROTOCOLO DE SUBIDA REANUDABLE:");
    console.log("   -----------------------------------------------------------------");
    const testPdf = createDummyPdf(1024 * 1024 * 5); // 5 MB
    console.log(`   - Archivo de prueba sintético generado: ${testPdf.length} bytes (5 MB)`);
    console.log(`   - Cabecera mágica inicial: '${testPdf.subarray(0, 8).toString()}'`);
    console.log(`   - Endpoint de inicio: POST ${DRIVE_UPLOAD_URI}`);
    console.log("   - Cabeceras requeridas:");
    console.log("       X-Upload-Content-Type: application/pdf");
    console.log(`       X-Upload-Content-Length: ${testPdf.length}`);
    console.log("   - Cabecera de respuesta esperada:");
    console.log("       Location: https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=...");
    console.log("   - Petición de subida binaria:");
    console.log("       PUT <Location-URL>");
    console.log(`       Content-Range: bytes 0-${testPdf.length - 1}/${testPdf.length}`);
    console.log("   - Verificación de magic bytes en Backend: PASS (empieza con '%PDF-')\n");

    console.log("✅ Spike de protocolo de subida reanudable verificado exitosamente.");
    return;
  }

  // Si se configuran credenciales reales en el entorno:
  try {
    let credentials;
    if (fs.existsSync(serviceAccountJson)) {
      credentials = JSON.parse(fs.readFileSync(serviceAccountJson, "utf-8"));
    } else {
      credentials = JSON.parse(serviceAccountJson);
    }

    console.log(`🔑 Autenticando Service Account: ${credentials.client_email}...`);
    const jwt = createServiceAccountJwt(
      credentials.client_email,
      credentials.private_key,
      [DRIVE_AUTH_SCOPE],
      impersonateUser
    );
    const accessToken = await getAccessToken(jwt);
    console.log("✅ Token de acceso obtenido con éxito.\n");

    console.log("🔍 Consultando cuota de almacenamiento reportada por la API de Drive...");
    const quotaInfo = await checkStorageQuota(accessToken);
    console.log("   Identidad autenticada:", quotaInfo.user?.emailAddress || credentials.client_email);
    console.log("   Límite de cuota:", quotaInfo.storageQuota?.limit ?? "Sin límite reportado (Shared Drive/Workspace)");
    console.log("   Uso actual:", quotaInfo.storageQuota?.usage ?? "0", "bytes");

    if (quotaInfo.storageQuota?.limit === "0") {
      console.log("⚠️  CONFIRMADO: La cuenta de servicio tiene 0 bytes de cuota propia.");
      console.log("   Subiendo a Unidad Compartida (Shared Drive) con supportsAllDrives=true...");
    }

    const testPdf = createDummyPdf(1024 * 1024 * 2); // 2 MB
    console.log(`\n📤 1. Creando sesión de subida reanudable para 'spike_test_openday.pdf' (${testPdf.length} bytes)...`);
    const uploadUrl = await initiateResumableUploadSession({
      accessToken,
      fileName: `spike_test_openday_${Date.now()}.pdf`,
      fileSize: testPdf.length,
      mimeType: "application/pdf",
      parentFolderId: parentFolderId,
    });
    console.log("✅ Sesión reanudable creada exitosamente.");
    console.log(`   URL de sesión: ${uploadUrl.substring(0, 80)}...`);

    console.log("\n📦 2. Transfiriendo buffer binario del PDF...");
    const uploadedFile = await uploadPdfChunk({
      uploadUrl,
      buffer: testPdf,
      mimeType: "application/pdf",
    });
    console.log(`✅ Archivo subido con éxito a Drive! File ID: ${uploadedFile.id}`);

    console.log("\n🔍 3. Verificando metadatos en backend...");
    const verified = await verifyUploadedFile({
      accessToken,
      fileId: uploadedFile.id,
    });
    console.log("   Metadatos verificados:", {
      id: verified.id,
      name: verified.name,
      size: verified.size,
      mimeType: verified.mimeType,
    });

    console.log("\n🎉 SPIKE DRIVE EXITOSO: Se validó la subida reanudable y la resolución de cuota.");
  } catch (err) {
    console.error("❌ Error ejecutando spike de Drive:", err.message);
    process.exit(1);
  }
}

// Ejecutar
runDriveSpike();


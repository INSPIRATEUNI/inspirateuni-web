/**
 * CSV para Excel en español: separador `;`, saltos `\r\n` y BOM para que respete las tildes.
 */

export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]) {
  return `﻿${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/** Descarga un CSV desde el navegador. */
export function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

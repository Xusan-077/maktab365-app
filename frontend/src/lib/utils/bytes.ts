const UNITS = ["B", "KB", "MB", "GB"] as const;

/** Fayl hajmi odam o'qiydigan ko'rinishda: `1536` → `1.5 KB`, `104857600` → `100 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const text = exponent === 0 || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${text} ${UNITS[exponent]}`;
}

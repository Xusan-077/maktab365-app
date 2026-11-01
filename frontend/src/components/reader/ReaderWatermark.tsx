"use client";

import { useAuth } from "@/hooks/useAuth";
import { readerWatermarkEnabled, watermarkLabel } from "@/lib/reader/protection";

const ROWS = 6;
const COLS = 3;

/**
 * Ixtiyoriy diagonal suv belgisi (env bayrog'i, default o'chiq): kirgan foydalanuvchi ismi/emaili.
 * Skrinshot tarqalsa, manbani aniqlashga yordam beradi; bosishlarni to'smaydi.
 */
export function ReaderWatermark() {
  // Bayroq o'chiq bo'lsa sessiya hook'i umuman chaqirilmaydi.
  return readerWatermarkEnabled() ? <WatermarkLayer /> : null;
}

function WatermarkLayer() {
  const { sessionUser } = useAuth();
  const label = watermarkLabel(sessionUser);
  if (!label) return null;
  return (
    <div
      aria-hidden
      data-testid="reader-watermark"
      className="pointer-events-none fixed inset-0 z-30 grid -rotate-30 grid-cols-3 content-around justify-items-center overflow-hidden opacity-[0.07] select-none"
    >
      {Array.from({ length: ROWS * COLS }, (_, index) => (
        <span key={index} className="text-lg font-semibold whitespace-nowrap">
          {label}
        </span>
      ))}
    </div>
  );
}

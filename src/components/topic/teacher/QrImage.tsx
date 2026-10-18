"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * QR kod. Skaner uchun har doim oq fonda qora (dark theme'da ham) va atrofida bo'sh maydon bilan;
 * o'lcham konteynerga moslashadi (`size` faqat ichki o'lchov).
 */
export default function QrImage({ value, label }: { value: string; label: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={512}
      level="M"
      marginSize={4}
      bgColor="white"
      fgColor="black"
      role="img"
      aria-label={label}
      style={{ width: "100%", height: "auto" }}
    />
  );
}

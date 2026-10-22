/**
 * Kichik, to'g'ri tuzilgan PDF (xref jadvali bilan): har sahifada "Sahifa N" yozuvi. E2E fayl
 * yuklash uchun — diskda fixture saqlanmaydi.
 */
export function makePdf(pages: number): Buffer {
  const firstPage = 3;
  const firstContent = firstPage + pages;
  const font = firstContent + pages;
  const bodies: string[] = [];
  bodies[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  bodies[2] = `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${firstPage + i} 0 R`).join(" ")}] /Count ${pages} >>`;
  for (let i = 0; i < pages; i += 1) {
    bodies[firstPage + i] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${firstContent + i} 0 R >>`;
    const stream = `BT /F1 48 Tf 100 700 Td (Sahifa ${i + 1}) Tj ET`;
    bodies[firstContent + i] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }
  bodies[font] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n < bodies.length; n += 1) {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${bodies[n]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${bodies.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < bodies.length; n += 1) {
    out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${bodies.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

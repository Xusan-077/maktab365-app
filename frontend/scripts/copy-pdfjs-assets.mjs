// pdf.js resurslari (CMap, standart shriftlar, wasm, ICC) `public/pdfjs/` ga nusxalanadi:
// ularsiz shrifti embed qilinmagan / CID-shriftli PDF'larda matn va JPEG2000 rasmlar chizilmaydi.
// Nusxa o'rnatilgan pdfjs-dist versiyasidan olinadi (versiya doim mos), git'ga kirmaydi.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist");
const target = join(root, "public", "pdfjs");

if (!existsSync(source)) {
  console.warn("copy-pdfjs-assets: pdfjs-dist o'rnatilmagan, o'tkazib yuborildi");
  process.exit(0);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(join(source, dir), join(target, dir), { recursive: true });
}

/**
 * `src/lib/i18n/messages/uz.json` → `uz-Cyrl.json` (lotin → kirill) transliteratsiyasi.
 * Bir marta ishlatiladi; keyin fayl qo'lda tahrirlanadi.
 *
 *   npx tsx scripts/translit-uz-cyrl.ts                 # faylni to'liq qayta yaratadi
 *   npx tsx scripts/translit-uz-cyrl.ts --missing-only  # faqat uz-Cyrl.json da yo'q kalitlar (qo'lda tuzatishlar saqlanadi)
 *   npx tsx scripts/translit-uz-cyrl.ts --dry-run       # yozmaydi, faqat namunalarni chiqaradi
 *
 * Qoidalar `src/lib/i18n/translit.ts` da (ў ғ қ ҳ, sh ch ts, yo yu ya ye, so'z boshidagi e → э,
 * harflar orasidagi ' / ʼ → ъ, ICU `{…}` va `<tag>` o'zgarmaydi). Bu yerda qo'shimcha: lotinda qoladigan
 * tokenlar (brend `darslik365`, raqamli, BOSH HARFLI qisqartmalar, URL/email, Telegram/Google…).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isVerbatimPath, transliterateMessage, type MessageTree } from "../src/lib/i18n/translit";

const DIR = join(import.meta.dirname, "..", "src", "lib", "i18n", "messages");
const SOURCE = join(DIR, "uz.json");
const TARGET = join(DIR, "uz-Cyrl.json");
const SAMPLE_SIZE = 20;

/** Lotinda qoladigan tokenlar (o'girilmaydi). */
const KEEP_LATIN = new RegExp(
  [
    String.raw`https?:\/\/\S+`,
    String.raw`[\w.+-]+@[\w-]+\.[\w.-]+`,
    String.raw`[A-Za-z]*\d[A-Za-z0-9]*`, // darslik365, 2FA, 1x
    // Qisqartmalar (suffiks bo'lsa ham: PDFni → PDFни); BOSH HARFLI oddiy so'zlar (SINF) o'giriladi
    String.raw`\b(?:PDF|JPE?G|PNG|GIF|JSON|API|ID|UI|MB|KB|GB|OTP|SMS|QR|URL|UZ|RU|EN|HTML|CSS|FAQ)(?![A-Z])`,
    String.raw`\b(?:WebP|Telegram|Google|Chrome|Safari|Firefox|Android|iOS|React|Yup|Railway|Ctrl|Esc|Enter|Shift|Alt)\b`,
  ].join("|"),
  "g",
);

const OPEN = "";
const CLOSE = "";

function transliterate(message: string): string {
  const kept: string[] = [];
  const masked = message.replace(KEEP_LATIN, (token) => {
    kept.push(token);
    return `${OPEN}${kept.length - 1}${CLOSE}`;
  });
  const converted = transliterateMessage(masked);
  return converted.replace(
    new RegExp(`${OPEN}(\\d+)${CLOSE}`, "g"),
    (_, index) => kept[Number(index)],
  );
}

type Entry = { path: string; uz: string; cyrl: string };

function convertTree(
  source: MessageTree,
  existing: MessageTree | undefined,
  missingOnly: boolean,
  entries: Entry[],
  prefix = "",
): MessageTree {
  const result: MessageTree = {};
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const current = existing?.[key];
    if (typeof value !== "string" && isVerbatimPath(path)) {
      result[key] = value; // masalan, language.names: butun daraxt o'z holicha
    } else if (typeof value === "string") {
      if (missingOnly && typeof current === "string") {
        result[key] = current;
      } else {
        const cyrl = isVerbatimPath(path) ? value : transliterate(value);
        result[key] = cyrl;
        entries.push({ path, uz: value, cyrl });
      }
    } else {
      result[key] = convertTree(
        value,
        typeof current === "object" ? current : undefined,
        missingOnly,
        entries,
        path,
      );
    }
  }
  return result;
}

/** Qiziq (tutuq, digraf, ts, e-) holatlari bor satrlardan tekis taqsimlangan namuna. */
function pickSamples(entries: Entry[]): Entry[] {
  const interesting = entries.filter(
    ({ uz, cyrl }) => uz !== cyrl && /[oOgG]['ʻʼ’]|sh|ch|ts|y[oua]|\b[eE]|['ʻʼ’]/i.test(uz),
  );
  const step = Math.max(1, Math.floor(interesting.length / SAMPLE_SIZE));
  return interesting.filter((_, index) => index % step === 0).slice(0, SAMPLE_SIZE);
}

const args = new Set(process.argv.slice(2));
const missingOnly = args.has("--missing-only");
const dryRun = args.has("--dry-run");

const source = JSON.parse(readFileSync(SOURCE, "utf8")) as MessageTree;
const existing =
  missingOnly && existsSync(TARGET)
    ? (JSON.parse(readFileSync(TARGET, "utf8")) as MessageTree)
    : undefined;

const entries: Entry[] = [];
const result = convertTree(source, existing, missingOnly, entries);

if (!dryRun) writeFileSync(TARGET, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const out = (text: string) => process.stdout.write(`${text}\n`);
out(
  `${dryRun ? "[dry-run] " : ""}${entries.length} ta satr o'girildi → ${dryRun ? "(yozilmadi)" : TARGET}`,
);
for (const { path, uz, cyrl } of pickSamples(entries)) {
  out(`\n${path}\n  uz:   ${uz}\n  cyrl: ${cyrl}`);
}

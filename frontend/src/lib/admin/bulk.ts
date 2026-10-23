/** Ommaviy yuklash: fayl nomidan sinf, fan va sarlavhani taxmin qilish (sof mantiq). */
import { pdfFileProblem, type PdfFileProblem } from "./pdf-file";

export interface BulkSubject {
  slug: string;
  title: { uz: string; ru?: string; en?: string };
  grades?: number[];
}

const GRADE_WORDS = "sinf|sinfi|klass|класс|кл|grade";

/**
 * Fayl nomidagi sinf (1..11): `9-sinf-algebra.pdf`, `Algebra 9 sinf`, `9 класс`, `grade_9`, `9_algebra`.
 * Aniq so'z bilan kelgan raqam ustun; aks holda nomning boshidagi raqam. Topilmasa `null`.
 */
export function guessGrade(filename: string): number | null {
  const name = filename.replace(/\.pdf$/i, "").toLocaleLowerCase();
  const patterns = [
    new RegExp(`(?<!\\d)(\\d{1,2})\\s*[-_ ]?\\s*(?:${GRADE_WORDS})(?![\\p{L}])`, "iu"),
    new RegExp(`(?:${GRADE_WORDS})[-_ ]?(\\d{1,2})(?!\\d)`, "iu"),
    /^(\d{1,2})(?=[-_ .])/u,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(name);
    const grade = match ? Number(match[1]) : NaN;
    if (grade >= 1 && grade <= 11) return grade;
  }
  return null;
}

const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase()
    .replace(/['`‘’ʻʼ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Fan: slug yoki istalgan tildagi nom fayl nomida uchrasa; eng uzun moslik yutadi. */
export function guessSubject(
  filename: string,
  subjects: readonly BulkSubject[],
  grade: number | null = null,
): string | null {
  const haystack = ` ${normalize(filename.replace(/\.pdf$/i, ""))} `;
  let best: { slug: string; length: number } | null = null;
  for (const subject of subjects) {
    // Fan taxmin qilingan sinfda o'tilmasa, u nomzod emas.
    if (grade !== null && subject.grades && !subject.grades.includes(grade)) continue;
    const candidates = [subject.slug.replaceAll("-", " "), ...Object.values(subject.title)];
    for (const candidate of candidates) {
      const needle = normalize(candidate ?? "");
      if (needle.length < 3 || !haystack.includes(` ${needle} `)) continue;
      if (!best || needle.length > best.length)
        best = { slug: subject.slug, length: needle.length };
    }
  }
  return best?.slug ?? null;
}

/** Sarlavha: kengaytma, tagchiziq/tirelar va sinf belgisi olib tashlanadi, bosh harf katta. */
export function titleFromFilename(filename: string): string {
  const cleaned = filename
    .replace(/\.pdf$/i, "")
    .replace(new RegExp(`(?<!\\d)\\d{1,2}\\s*[-_ ]?\\s*(?:${GRADE_WORDS})(?![\\p{L}])`, "giu"), " ")
    .replace(/[_]+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned[0].toLocaleUpperCase() + cleaned.slice(1) : "";
}

export interface BulkRow {
  key: string;
  file: File;
  title: string;
  grade: number | null;
  subject: string | null;
}

let counter = 0;

export function makeRow(file: File, subjects: readonly BulkSubject[]): BulkRow {
  counter += 1;
  const grade = guessGrade(file.name);
  return {
    key: `${file.name}-${file.size}-${file.lastModified}-${counter}`,
    file,
    title: titleFromFilename(file.name),
    grade,
    subject: guessSubject(file.name, subjects, grade),
  };
}

export type RowProblem = PdfFileProblem | "title" | "grade" | "subject";

/** Tekshiruv jadvali uchun: birinchi muammo (bo'lmasa `null` — yaratishga tayyor). */
export function rowProblem(row: BulkRow): RowProblem | null {
  const fileProblem = pdfFileProblem(row.file);
  if (fileProblem) return fileProblem;
  if (!row.title.trim()) return "title";
  if (row.grade === null) return "grade";
  if (row.subject === null) return "subject";
  return null;
}

/** Ro'yxatda bir xil fayl (nom + hajm + vaqt) ikki marta bo'lmasin. */
export function dedupeFiles(existing: readonly BulkRow[], files: readonly File[]): File[] {
  const seen = new Set(existing.map((row) => `${row.file.name}|${row.file.size}`));
  return files.filter((file) => {
    const id = `${file.name}|${file.size}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

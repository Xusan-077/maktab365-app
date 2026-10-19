/**
 * `npm run content:validate` — src/content dagi barcha JSON fayllarni tekshiradi (yup sxema + kontent
 * qoidalari). Xatoda fayl nomi va maydon yo'lini ko'rsatib, exit code 1 bilan tugaydi.
 * `prebuild` orqali `npm run build` oldidan ham ishlaydi.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CONTENT_REGISTRY } from "../src/content/registry";
import {
  CHAPTER_FILE_NAME,
  validateChapterFile,
  validateContentTree,
  validateTopicFile,
  type ContentFileEntry,
  type ContentIssue,
} from "../src/lib/content/validate";
import { BOOKS } from "../src/mocks/data/books";
import { SUBJECTS } from "../src/mocks/data/subjects";

// CONTENT_ROOT — faqat testlar uchun (boshqa papkadagi namunani tekshirish).
const ROOT = process.env.CONTENT_ROOT ?? join(process.cwd(), "src", "content");

function listJson(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listJson(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

const problems: { file: string; issue: ContentIssue }[] = [];
const report = (file: string, path: string, message: string) =>
  problems.push({ file, issue: { path, message } });

const entries: ContentFileEntry[] = [];
const todos: { file: string; note: string }[] = [];
const keyOf = (full: string) =>
  relative(ROOT, full)
    .split(sep)
    .join("/")
    .replace(/\.json$/, "");
const displayOf = (key: string) => `src/content/${key}.json`;

for (const full of listJson(ROOT)) {
  const key = keyOf(full);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(full, "utf8"));
  } catch (error) {
    report(displayOf(key), "(JSON)", error instanceof Error ? error.message : String(error));
    continue;
  }
  entries.push({ key, data });
  const isChapter = key.split("/").pop() === CHAPTER_FILE_NAME;
  for (const issue of isChapter ? validateChapterFile(data) : validateTopicFile(data)) {
    report(displayOf(key), issue.path, issue.message);
  }
  const notes = (data as { notes?: unknown }).notes;
  if (Array.isArray(notes)) {
    for (const note of notes) todos.push({ file: displayOf(key), note: String(note) });
  }
}

const subjectSlugById = new Map(SUBJECTS.map((subject) => [subject.id, subject.slug]));
const books = new Map(
  BOOKS.flatMap((book) => {
    const slug = subjectSlugById.get(book.subjectId);
    return slug ? [[book.id, slug] as const] : [];
  }),
);
for (const issue of validateContentTree(entries, { books })) {
  report(displayOf(issue.key), issue.path, issue.message);
}

// Diskdagi fayllar va `src/content/registry.ts` mos bo'lishi kerak (aks holda fayl sahifaga chiqmaydi).
const onDisk = new Set(entries.map((entry) => entry.key));
const registered = new Set(Object.keys(CONTENT_REGISTRY));
for (const key of onDisk) {
  if (!registered.has(key))
    report(displayOf(key), "(registry)", "src/content/registry.ts ga qo'shilmagan");
}
for (const key of registered) {
  if (!onDisk.has(key))
    report(displayOf(key), "(registry)", "registry'da bor, lekin fayl topilmadi");
}

if (problems.length > 0) {
  console.error(`\nKontent xatolari: ${problems.length} ta\n`);
  for (const { file, issue } of problems)
    console.error(`  ${file}\n    ${issue.path}: ${issue.message}`);
  console.error("");
  process.exit(1);
}

const topicCount = entries.filter((entry) => !entry.key.endsWith(`/${CHAPTER_FILE_NAME}`)).length;
const say = (line: string) => process.stdout.write(`${line}\n`);
say(`Kontent to'g'ri: ${topicCount} ta mavzu, ${entries.length - topicCount} ta bob.`);
if (todos.length > 0) say(`Ochiq izohlar (TODO): ${todos.length} ta — qarang: notes maydonlari.`);

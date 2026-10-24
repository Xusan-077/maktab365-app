import type { PdfBook } from "@/lib/pdf-books/api";

const base = {
  unverified: false,
  published_at: "2026-09-01T00:00:00Z",
  size_bytes: 24_000_000,
  cover: null,
  cover_small: null,
  language: "uz",
} satisfies Partial<PdfBook>;

/** `/dev/site` namunasi uchun: har yo'nalishdan bittadan kitob (muqovasiz → guruh rangidagi zaxira). */
export const SHOWCASE_BOOKS: PdfBook[] = [
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000001",
    slug: "9-sinf-algebra",
    title: { uz: "Algebra" },
    grade: 9,
    subject: "algebra",
    subject_title: { uz: "Algebra" },
    subject_group: "exact",
    page_count: 160,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000002",
    slug: "8-sinf-fizika",
    title: { uz: "Fizika" },
    grade: 8,
    subject: "fizika",
    subject_title: { uz: "Fizika" },
    subject_group: "natural",
    page_count: 184,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000003",
    slug: "5-sinf-ona-tili",
    title: { uz: "Ona tili" },
    grade: 5,
    subject: "ona-tili",
    subject_title: { uz: "Ona tili" },
    subject_group: "language",
    page_count: 150,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000004",
    slug: "7-sinf-ozbekiston-tarixi",
    title: { uz: "O'zbekiston tarixi" },
    grade: 7,
    subject: "tarix",
    subject_title: { uz: "O'zbekiston tarixi" },
    subject_group: "social",
    page_count: 132,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000005",
    slug: "3-sinf-tasviriy-sanat",
    title: { uz: "Tasviriy san'at" },
    grade: 3,
    subject: "tasviriy-san-at",
    subject_title: { uz: "Tasviriy san'at" },
    subject_group: "arts",
    page_count: 96,
  },
];

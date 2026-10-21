import { boolean, number, object, string } from "yup";

/** Kitob/bob/mavzu slug'i: kichik lotin harflari, raqamlar va tire. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 50;
export const YEAR_MIN = 1990;
export const YEAR_MAX = 2100;

const localized = () =>
  object({
    uz: string().trim().required("required"),
    ru: string().trim().default(""),
    en: string().trim().default(""),
  });

const slug = () =>
  string()
    .trim()
    .required("required")
    .max(SLUG_MAX, "slugInvalid")
    .matches(SLUG_PATTERN, "slugInvalid");

/** Xabar kalitlari `admin.validation.*` ga mos; matnni forma tilga o'giradi. */
export function createBookSchema() {
  return object({
    slug: slug(),
    subject: string().required("required"),
    grade: string().required("required"),
    title: localized(),
    author: string().trim().required("required"),
    edition: string().trim().required("required"),
    publisher: string().trim().default(""),
    year: number()
      .typeError("yearInvalid")
      .integer("yearInvalid")
      .min(YEAR_MIN, "yearInvalid")
      .max(YEAR_MAX, "yearInvalid")
      .required("required"),
    is_published: boolean().default(false),
    cover: string().default(""),
    pdf: string().default(""),
  });
}

export function createChapterSchema() {
  return object({ slug: slug(), title: localized() });
}

export function createTopicSchema() {
  return object({
    slug: slug(),
    title: localized(),
    summary: string().trim().default(""),
    notes: string().default(""),
    blocks: string()
      .default("[]")
      .test("json-array", "blocksInvalid", (value) => {
        try {
          return Array.isArray(JSON.parse(value || "[]"));
        } catch {
          return false;
        }
      }),
  });
}

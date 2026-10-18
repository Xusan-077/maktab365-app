/**
 * Mini-dars tuzilmasi. Matnlar `home.demo.subjects.<id>.*` da; bu yerda faqat tuzilma:
 * to'g'ri variant indeksi va o'zgarmas (tarjima qilinmaydigan) ingliz matnlari bor-yo'qligi.
 */
export const DEMO_LESSONS = [
  { id: "math", correctIndex: 0, verbatimExample: false, verbatimQuestion: false },
  { id: "english", correctIndex: 1, verbatimExample: true, verbatimQuestion: true },
] as const;

export type DemoLessonId = (typeof DEMO_LESSONS)[number]["id"];

export const DEMO_OPTION_INDEXES = [0, 1, 2] as const;

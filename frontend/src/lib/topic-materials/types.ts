/**
 * Mavzu materiallari (Xulosa, Taqdimot) API shartnomasi — `docs/api-mavzu-materiallari.md`.
 *
 * Vaqtinchalik qo'lda yozilgan: backend bu endpoint'larni hali `backend/openapi.yaml` ga qo'shmagan.
 * Qo'shilgach (`make schema && make types`) bu tiplar `components["schemas"][…]` aliaslariga
 * almashtiriladi — maydon nomlari hujjatdagi bilan bir xil.
 */

export type SummaryStatus = "draft" | "published";

export interface IdeaBlock {
  type: "idea";
  title: string;
  text: string;
}

export interface BulletsBlock {
  type: "bullets";
  items: { lead: string; text: string }[];
}

export interface ChipsBlock {
  type: "chips";
  label: string;
  items: string[];
}

export interface TeacherNoteBlock {
  type: "teacher_note";
  text: string;
}

export interface ExampleBlock {
  type: "example";
  text: string;
}

export type SummaryBlock = IdeaBlock | BulletsBlock | ChipsBlock | TeacherNoteBlock | ExampleBlock;
export type SummaryBlockType = SummaryBlock["type"];

export interface TopicSummary {
  status: SummaryStatus;
  blocks: SummaryBlock[];
  /** UTC ISO. */
  updated_at: string;
}

export interface SummaryInput {
  status: SummaryStatus;
  blocks: SummaryBlock[];
}

export interface Slide {
  id: string;
  /** 1 dan. */
  order: number;
  /** 1920×1080 webp. */
  image_url: string;
  /** 480px eni. */
  thumb_url: string;
  alt: string;
  /** Ustoz eslatmasi: faqat staff/ustoz javobida; o'quvchiga `null`. */
  note: string | null;
  hidden: boolean;
}

export interface Presentation {
  id: string;
  slide_count: number;
  pdf_url: string | null;
  slides: Slide[];
}

export type ConversionStatus = "processing" | "ready" | "failed";

export interface PresentationUpload {
  id: string;
  status: "processing";
}

export interface ConversionState {
  status: ConversionStatus;
  /** 0..100. */
  progress: number;
}

export interface SlidePatch {
  id: string;
  order: number;
  hidden: boolean;
  note: string;
  alt: string;
}

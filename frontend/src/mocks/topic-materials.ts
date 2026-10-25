import { ApiError } from "@/lib/api/types";
import type { TopicMaterialsApi, UploadOptions } from "@/lib/topic-materials/api";
import type {
  ConversionState,
  Presentation,
  Slide,
  SlidePatch,
  SummaryBlock,
  SummaryInput,
  TopicSummary,
} from "@/lib/topic-materials/types";

/**
 * Mavzu materiallari mock'i (backend tayyor bo'lguncha, `NEXT_PUBLIC_TOPIC_MATERIALS_API` ≠ `http`):
 * xotirada, sahifa yangilanguncha. Har qanday mavzu id'si uchun namunaviy xulosa va 8 slaydli
 * taqdimot bor; yuklash va konvertatsiya vaqt bo'yicha simulyatsiya qilinadi.
 */

const SAMPLE_BLOCKS: SummaryBlock[] = [
  {
    type: "idea",
    title: "Asosiy g‘oya",
    text: "Kvadrat tenglama ax² + bx + c = 0 ko‘rinishida bo‘ladi, bunda a ≠ 0. Uning ildizlari diskriminant orqali topiladi.",
  },
  {
    type: "bullets",
    items: [
      { lead: "Diskriminant", text: "D = b² − 4ac; ildizlar soni D ning ishorasiga bog‘liq." },
      { lead: "D > 0", text: "ikkita har xil haqiqiy ildiz." },
      { lead: "D = 0", text: "bitta (ikki karrali) ildiz." },
      { lead: "D < 0", text: "haqiqiy ildiz yo‘q." },
    ],
  },
  {
    type: "chips",
    label: "Kalit so‘zlar",
    items: ["koeffitsiyent", "diskriminant", "ildiz", "Viyet teoremasi"],
  },
  {
    type: "example",
    text: "x² − 5x + 6 = 0: D = 25 − 24 = 1, x₁ = 3, x₂ = 2.",
  },
  {
    type: "teacher_note",
    text: "O‘quvchilar ko‘pincha b² ni −b² deb yozib xato qilishadi — ishoralarni alohida tekshirtiring.",
  },
];

const AI_BLOCKS: SummaryBlock[] = [
  {
    type: "idea",
    title: "Mavzuning qisqacha mazmuni",
    text: "AI qoralamasi: mavzudagi asosiy tushunchalar va ularning bog‘liqligi. Ustoz tekshirib, tahrir qilishi kerak.",
  },
  {
    type: "bullets",
    items: [
      { lead: "Ta’rif", text: "mavzudagi asosiy tushuncha." },
      { lead: "Qoida", text: "masalalarni yechishda qo‘llanadigan formula." },
    ],
  },
  { type: "example", text: "Namunaviy masala va uning yechimi." },
];

const SLIDE_COLORS = ["#2B5FE8", "#0B6B3A", "#8A5A00", "#7C3AED", "#BE185D", "#0F766E"];

/** Namunaviy slayd rasmi (SVG data URL): rangli fon va slayd raqami. */
function slideImage(index: number, width: number, height: number) {
  const color = SLIDE_COLORS[index % SLIDE_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#ffffff"/><rect width="1920" height="180" fill="${color}"/><text x="96" y="118" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">Slayd ${index + 1}</text><rect x="96" y="300" width="1100" height="40" rx="20" fill="#E3E6EE"/><rect x="96" y="380" width="900" height="40" rx="20" fill="#E3E6EE"/><rect x="96" y="460" width="1000" height="40" rx="20" fill="#E3E6EE"/><circle cx="1500" cy="620" r="240" fill="${color}" opacity="0.15"/><text x="1500" y="660" text-anchor="middle" font-family="Arial, sans-serif" font-size="140" font-weight="700" fill="${color}">${index + 1}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function sampleSlides(topicId: string, count: number): Slide[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${topicId}-slide-${index + 1}`,
    order: index + 1,
    image_url: slideImage(index, 1920, 1080),
    thumb_url: slideImage(index, 480, 270),
    alt: `${index + 1}-slayd`,
    note: index % 3 === 0 ? `Ustoz eslatmasi: ${index + 1}-slaydda savol bering.` : null,
    hidden: index === 6,
  }));
}

function toPresentation(id: string, slides: Slide[]): Presentation {
  return { id, slide_count: slides.length, pdf_url: null, slides };
}

interface Conversion {
  startedAt: number;
  fileName: string;
}

/** Konvertatsiya simulyatsiyasi davomiyligi. */
const CONVERSION_MS = 6000;

export class MockTopicMaterialsApi implements TopicMaterialsApi {
  private readonly summaries = new Map<string, TopicSummary>();
  private readonly presentations = new Map<string, Presentation>();
  private readonly conversions = new Map<string, Conversion>();
  private readonly latencyMs: number;

  constructor({ latencyMs = 0 }: { latencyMs?: number } = {}) {
    this.latencyMs = latencyMs;
  }

  private delay<T>(value: T): Promise<T> {
    const copy = structuredClone(value);
    if (this.latencyMs <= 0) return Promise.resolve(copy);
    return new Promise((resolve) => setTimeout(() => resolve(copy), this.latencyMs));
  }

  private summaryOf(topicId: string): TopicSummary {
    let summary = this.summaries.get(topicId);
    if (!summary) {
      summary = {
        status: "published",
        blocks: structuredClone(SAMPLE_BLOCKS),
        updated_at: "2026-10-20T09:30:00Z",
      };
      this.summaries.set(topicId, summary);
    }
    return summary;
  }

  private presentationOf(topicId: string): Presentation {
    let presentation = this.presentations.get(topicId);
    if (!presentation) {
      presentation = toPresentation(`${topicId}-presentation`, sampleSlides(topicId, 8));
      this.presentations.set(topicId, presentation);
    }
    return presentation;
  }

  async summary(topicId: string) {
    return this.delay(this.summaryOf(topicId));
  }

  async saveSummary(topicId: string, input: SummaryInput) {
    const saved: TopicSummary = {
      status: input.status,
      blocks: structuredClone(input.blocks),
      updated_at: new Date().toISOString(),
    };
    this.summaries.set(topicId, saved);
    return this.delay(saved);
  }

  async aiDraft() {
    return this.delay(AI_BLOCKS);
  }

  async presentation(topicId: string) {
    this.finishConversion(topicId);
    if (this.conversions.has(topicId)) return this.delay(null);
    return this.delay(this.presentationOf(topicId));
  }

  async uploadPresentation(topicId: string, file: File, options: UploadOptions = {}) {
    // Yuklash progressi: 10 qadamda.
    for (let step = 1; step <= 10; step += 1) {
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs > 0 ? 120 : 0));
      options.onProgress?.(step / 10);
    }
    this.conversions.set(topicId, { startedAt: Date.now(), fileName: file.name });
    return this.delay({ id: `${topicId}-presentation`, status: "processing" as const });
  }

  async conversionStatus(topicId: string): Promise<ConversionState> {
    const conversion = this.conversions.get(topicId);
    if (!conversion) return this.delay({ status: "ready", progress: 100 });
    if (conversion.fileName.toLowerCase().includes("xato")) {
      this.conversions.delete(topicId);
      return this.delay({ status: "failed", progress: 0 });
    }
    const progress = Math.min(
      100,
      Math.round(((Date.now() - conversion.startedAt) / CONVERSION_MS) * 100),
    );
    if (progress < 100) return this.delay({ status: "processing", progress });
    this.finishConversion(topicId, true);
    return this.delay({ status: "ready", progress: 100 });
  }

  /** Konvertatsiya vaqti o'tgan bo'lsa yangi (12 slaydli) taqdimot paydo bo'ladi. */
  private finishConversion(topicId: string, force = false) {
    const conversion = this.conversions.get(topicId);
    if (!conversion) return;
    if (!force && Date.now() - conversion.startedAt < CONVERSION_MS) return;
    this.conversions.delete(topicId);
    const slides = sampleSlides(topicId, 12).map((slide) => ({ ...slide, hidden: false }));
    this.presentations.set(topicId, toPresentation(`${topicId}-presentation`, slides));
  }

  async patchSlides(presentationId: string, patches: SlidePatch[]) {
    const entry = [...this.presentations.entries()].find(
      ([, value]) => value.id === presentationId,
    );
    if (!entry) throw new ApiError("Taqdimot topilmadi", 404, { code: "not_found" });
    const [topicId, presentation] = entry;
    const byId = new Map(presentation.slides.map((slide) => [slide.id, slide]));
    const slides = patches.flatMap((patch) => {
      const slide = byId.get(patch.id);
      return slide
        ? [
            {
              ...slide,
              order: patch.order,
              hidden: patch.hidden,
              alt: patch.alt,
              note: patch.note || null,
            },
          ]
        : [];
    });
    const next = toPresentation(presentation.id, slides);
    this.presentations.set(topicId, next);
    return this.delay(next);
  }
}

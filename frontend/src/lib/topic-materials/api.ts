import { createFetch, resolveBaseUrl, toApiError } from "@/lib/api/http-client";
import { BFF_PREFIX } from "@/lib/auth/config";
import { xhrSender, type Sender } from "@/lib/admin/pdf-upload";
import { MockTopicMaterialsApi } from "@/mocks/topic-materials";
import { parseBlocks } from "./blocks";
import type {
  ConversionState,
  Presentation,
  PresentationUpload,
  SlidePatch,
  SummaryBlock,
  SummaryInput,
  TopicSummary,
} from "./types";

export interface UploadOptions {
  /** 0..1 */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Mavzu materiallari: Xulosa va Taqdimot (o'quvchi va admin). Shartnoma — `docs/api-mavzu-materiallari.md`. */
export interface TopicMaterialsApi {
  /** Xulosa yo'q bo'lsa `null` (404). */
  summary(topicId: string): Promise<TopicSummary | null>;
  saveSummary(topicId: string, input: SummaryInput): Promise<TopicSummary>;
  /** AI qoralamasi: faqat bloklar (saqlanmaydi — muharrir qoralama sifatida to'ldiradi). */
  aiDraft(topicId: string): Promise<SummaryBlock[]>;
  /** Taqdimot yo'q bo'lsa `null` (404). */
  presentation(topicId: string): Promise<Presentation | null>;
  uploadPresentation(
    topicId: string,
    file: File,
    options?: UploadOptions,
  ): Promise<PresentationUpload>;
  conversionStatus(topicId: string): Promise<ConversionState>;
  patchSlides(presentationId: string, slides: SlidePatch[]): Promise<Presentation>;
  /** Bitta slayd: qolganlari qayta raqamlanadi; oxirgisi o'chirilsa taqdimot ham yo'qoladi (`null`). */
  deleteSlide(presentationId: string, slideId: string): Promise<Presentation | null>;
  /** Mavzu taqdimoti butunlay (slaydlar, eslatmalar, PDF). */
  deletePresentation(topicId: string): Promise<void>;
}

const path = {
  summary: (id: string) => `/api/v1/topics/${id}/summary/`,
  adminSummary: (id: string) => `/api/v1/admin/topics/${id}/summary/`,
  aiDraft: (id: string) => `/api/v1/admin/topics/${id}/summary/ai-draft/`,
  presentation: (id: string) => `/api/v1/topics/${id}/presentation/`,
  adminPresentation: (id: string) => `/api/v1/admin/topics/${id}/presentation/`,
  status: (id: string) => `/api/v1/admin/topics/${id}/presentation/status/`,
  slides: (id: string) => `/api/v1/admin/presentations/${id}/slides/`,
  slide: (id: string, slideId: string) => `/api/v1/admin/presentations/${id}/slides/${slideId}/`,
};

/** Yuklash (multipart) brauzerdan BFF orqali: oxirgi `/` siz (Next 308 qilmasin). */
export const presentationUploadUrl = (topicId: string) =>
  `${BFF_PREFIX}/api/v1/admin/topics/${topicId}/presentation`;

function normalizeSummary(raw: TopicSummary): TopicSummary {
  return {
    status: raw.status === "published" ? "published" : "draft",
    blocks: parseBlocks(raw.blocks),
    updated_at: raw.updated_at,
  };
}

/** Haqiqiy backend: `openapi-fetch` klienti bilan bir xil `fetch` (timeout, `X-Request-ID`, BFF). */
export class HttpTopicMaterialsApi implements TopicMaterialsApi {
  constructor(
    private readonly fetcher: typeof fetch = createFetch(),
    private readonly send: Sender = xhrSender,
  ) {}

  private async request<T>(
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    const response = await this.fetcher(`${resolveBaseUrl()}${url}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok && response.status !== 404) throw toApiError(response, data);
    if (response.status === 404 && method !== "GET") throw toApiError(response, data);
    return { status: response.status, data: data as T };
  }

  async summary(topicId: string) {
    const { status, data } = await this.request<TopicSummary>("GET", path.summary(topicId));
    return status === 404 ? null : normalizeSummary(data);
  }

  async saveSummary(topicId: string, input: SummaryInput) {
    const { data } = await this.request<TopicSummary>("PUT", path.adminSummary(topicId), input);
    return normalizeSummary(data);
  }

  async aiDraft(topicId: string) {
    const { data } = await this.request<{ blocks: unknown }>("POST", path.aiDraft(topicId), {});
    return parseBlocks(data?.blocks);
  }

  async presentation(topicId: string) {
    const { status, data } = await this.request<Presentation>("GET", path.presentation(topicId));
    return status === 404 ? null : data;
  }

  async uploadPresentation(topicId: string, file: File, options: UploadOptions = {}) {
    const body = new FormData();
    body.append("file", file);
    const result = await this.send({
      method: "POST",
      url: presentationUploadUrl(topicId),
      body,
      signal: options.signal,
      onProgress: (loaded) => options.onProgress?.(file.size > 0 ? loaded / file.size : 1),
    });
    if (result.status < 200 || result.status >= 300) {
      throw toApiError(new Response(null, { status: result.status }), result.json);
    }
    return result.json as PresentationUpload;
  }

  async conversionStatus(topicId: string) {
    const { status, data } = await this.request<ConversionState>("GET", path.status(topicId));
    if (status === 404) throw toApiError(new Response(null, { status }), data);
    return data;
  }

  async patchSlides(presentationId: string, slides: SlidePatch[]) {
    return (await this.request<Presentation>("PATCH", path.slides(presentationId), slides)).data;
  }

  async deleteSlide(presentationId: string, slideId: string) {
    const { status, data } = await this.request<Presentation>(
      "DELETE",
      path.slide(presentationId, slideId),
    );
    return status === 204 ? null : data;
  }

  async deletePresentation(topicId: string) {
    await this.request<null>("DELETE", path.adminPresentation(topicId));
  }
}

/**
 * `NEXT_PUBLIC_TOPIC_MATERIALS_API=http` — backend; aks holda (standart, backend tayyor bo'lguncha)
 * `src/mocks` dagi xotiradagi mock.
 */
export const TOPIC_MATERIALS_MODE: "mock" | "http" =
  process.env.NEXT_PUBLIC_TOPIC_MATERIALS_API === "http" ? "http" : "mock";

let instance: TopicMaterialsApi | undefined;

export function getTopicMaterialsApi(): TopicMaterialsApi {
  instance ??=
    TOPIC_MATERIALS_MODE === "http"
      ? new HttpTopicMaterialsApi()
      : new MockTopicMaterialsApi({ latencyMs: process.env.NODE_ENV === "development" ? 250 : 0 });
  return instance;
}

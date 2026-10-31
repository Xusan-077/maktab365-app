import { createHttpClient, toApiError, unwrap, type HttpClient } from "@/lib/api/http-client";
import type {
  AttemptInput,
  CheckResult,
  PublicQuiz,
  Quiz,
  QuizAttempt,
  QuizCategory,
  QuizInput,
  QuizSummary,
} from "./types";

export interface QuizListParams {
  category?: string;
  q?: string;
}

/** Ustozning shaxsiy testlari API'i (brauzerda BFF orqali); `public*` metodlari login talab qilmaydi. */
export class QuizzesApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async list(params: QuizListParams = {}): Promise<QuizSummary[]> {
    const result = await this.client.GET("/api/v1/quizzes/", {
      params: { query: { category: params.category || undefined, q: params.q || undefined } },
    });
    return unwrap(result);
  }

  async get(id: string): Promise<Quiz> {
    return unwrap(await this.client.GET("/api/v1/quizzes/{id}/", { params: { path: { id } } }));
  }

  async create(input: QuizInput): Promise<Quiz> {
    return unwrap(await this.client.POST("/api/v1/quizzes/", { body: input }));
  }

  async update(id: string, input: QuizInput): Promise<Quiz> {
    const result = await this.client.PUT("/api/v1/quizzes/{id}/", {
      params: { path: { id } },
      body: input,
    });
    return unwrap(result);
  }

  async remove(id: string): Promise<void> {
    const result = await this.client.DELETE("/api/v1/quizzes/{id}/", {
      params: { path: { id } },
    });
    if (!result.response.ok) {
      throw toApiError(result.response, (result as { error?: unknown }).error);
    }
  }

  async duplicate(id: string): Promise<Quiz> {
    const result = await this.client.POST("/api/v1/quizzes/{id}/duplicate/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async categories(): Promise<QuizCategory[]> {
    return unwrap(await this.client.GET("/api/v1/quizzes/categories/"));
  }

  async createCategory(name: string): Promise<QuizCategory> {
    return unwrap(await this.client.POST("/api/v1/quizzes/categories/", { body: { name } }));
  }

  /** Muqova yoki savol rasmi: natijadagi `path` test saqlanganda yuboriladi. */
  async uploadImage(file: File): Promise<{ path: string; url: string }> {
    const result = await this.client.POST("/api/v1/quizzes/uploads/", {
      body: { file: "" },
      // multipart: Content-Type'ni brauzer chegara (boundary) bilan o'zi qo'yadi.
      bodySerializer: () => {
        const form = new FormData();
        form.set("file", file);
        return form;
      },
    });
    return unwrap(result);
  }

  async attempts(quizId: string): Promise<QuizAttempt[]> {
    const result = await this.client.GET("/api/v1/quizzes/{id}/attempts/", {
      params: { path: { id: quizId } },
    });
    return unwrap(result);
  }

  async createAttempt(quizId: string, input: AttemptInput): Promise<QuizAttempt> {
    const result = await this.client.POST("/api/v1/quizzes/{id}/attempts/", {
      params: { path: { id: quizId } },
      body: input,
    });
    return unwrap(result);
  }

  async publicQuiz(id: string): Promise<PublicQuiz> {
    const result = await this.client.GET("/api/v1/quizzes/public/{id}/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async publicCheck(id: string, questionId: string, optionId: string): Promise<CheckResult> {
    const result = await this.client.POST("/api/v1/quizzes/public/{id}/check/", {
      params: { path: { id } },
      body: { question_id: questionId, option_id: optionId },
    });
    return unwrap(result);
  }
}

let instance: QuizzesApi | undefined;

export function getQuizzesApi(): QuizzesApi {
  instance ??= new QuizzesApi();
  return instance;
}

import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";
import type { GameId } from "./config";
import type { GameFilters } from "./filters";
import type { TeamResult } from "./scoring";

type Schemas = components["schemas"];

export type GameTopic = Schemas["GameTopic"];
export type GameTopicPage = Schemas["PaginatedGameTopicList"];
export type GameQuestion = Schemas["GameQuestion"];
export type GameQuestions = Schemas["GameQuestions"];
export type GameAllowance = Schemas["Allowance"];
export type GameSessionStart = Schemas["SessionStart"];
export type GameSession = Schemas["GameSession"];
export type CheckAnswer = Schemas["CheckAnswer"];

/** Server 403 bilan qaytaradi: oylik bepul o'yinlar tugagan va tanga yetmaydi. */
export const GAME_LIMIT_REACHED = "game_limit_reached";

export const GAME_TOPICS_PAGE_SIZE = 24;

/** O'yinlar API'si (brauzerda BFF orqali; mehmon uchun ham ochiq qismlari). */
export class GamesApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async topics(filters: GameFilters, page = 1): Promise<GameTopicPage> {
    const result = await this.client.GET("/api/v1/games/topics/", {
      params: {
        query: {
          q: filters.q || undefined,
          grade: filters.grade,
          subject: filters.subject || undefined,
          page,
          page_size: GAME_TOPICS_PAGE_SIZE,
        },
      },
    });
    return unwrap(result);
  }

  /** O'ynab bo'lmaydigan (savoli kam yoki yo'q) mavzuda `ApiError` 404. */
  async topic(slug: string): Promise<GameTopic> {
    const result = await this.client.GET("/api/v1/games/topics/{slug}/", {
      params: { path: { slug } },
    });
    return unwrap(result);
  }

  async questions(slug: string, count: number): Promise<GameQuestions> {
    const result = await this.client.GET("/api/v1/games/topics/{slug}/questions/", {
      params: { path: { slug }, query: { count } },
    });
    return unwrap(result);
  }

  async check(answerToken: string, optionId: string): Promise<CheckAnswer> {
    const result = await this.client.POST("/api/v1/games/check/", {
      body: { answer_token: answerToken, option_id: optionId },
    });
    return unwrap(result);
  }

  /** Faqat kirgan foydalanuvchi uchun. */
  async allowance(): Promise<GameAllowance> {
    return unwrap(await this.client.GET("/api/v1/games/allowance/"));
  }

  /** Bitta urinish sarflanadi (bepul yoki tanga); limitda `ApiError` `game_limit_reached` (403). */
  async startSession(game: GameId, topicSlug: string): Promise<GameSessionStart> {
    const result = await this.client.POST("/api/v1/games/sessions/", {
      body: { game_type: game, topic: topicSlug },
    });
    return unwrap(result);
  }

  async finishSession(
    sessionId: string,
    teams: TeamResult[],
    durationSeconds: number,
  ): Promise<GameSession> {
    const result = await this.client.POST("/api/v1/games/sessions/{id}/finish/", {
      params: { path: { id: sessionId } },
      body: { teams, duration_seconds: durationSeconds },
    });
    return unwrap(result);
  }
}

let instance: GamesApi | undefined;

export function getGamesApi(): GamesApi {
  instance ??= new GamesApi();
  return instance;
}

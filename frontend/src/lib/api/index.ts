import { MockApi } from "@/mocks/mock-api";
import { HttpApi } from "./http-api";
import type { ApiMode, MaktabApi } from "./types";

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

let instance: MaktabApi | undefined;

/** `NEXT_PUBLIC_API_MODE=mock|http` bo'yicha tanlangan klient (default: mock). */
export function getApi(): MaktabApi {
  instance ??=
    API_MODE === "http"
      ? new HttpApi()
      : new MockApi({ latencyMs: process.env.NODE_ENV === "development" ? 200 : 0 });
  return instance;
}

export { ApiError, type MaktabApi } from "./types";

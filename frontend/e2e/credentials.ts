import { randomBytes } from "node:crypto";

/** E2E hisoblari uchun har ishga tushirishda tasodifiy parol: kodda parol yo'q. */
export const randomPassword = () => randomBytes(18).toString("base64url");

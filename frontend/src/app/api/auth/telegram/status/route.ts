import { handleTelegramStatus } from "@/lib/auth/telegram-bot";

export const GET = (request: Request) => handleTelegramStatus(request);

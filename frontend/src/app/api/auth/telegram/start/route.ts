import { handleTelegramStart } from "@/lib/auth/telegram-bot";

export const POST = (request: Request) => handleTelegramStart(request);

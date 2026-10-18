import type { LocalizedText } from "./i18n";
import type { ContentStatus, TopicBlock } from "./topic";

/** `src/content/{fan}/{kitob}/{bob}/chapter.json`. Bob id'si: `{kitob}-ch{order}`. */
export type ChapterFile = {
  order: number;
  title: LocalizedText;
};

/** `src/content/{fan}/{kitob}/{bob}/{mavzu}.json`. Mavzu id'si: `{kitob}-{fayl nomi}`. */
export type TopicFile = {
  status: ContentStatus;
  order: number;
  title: LocalizedText;
  /** Muharrir uchun izohlar (masalan, "TODO: darslikdan tekshirish — …"); foydalanuvchiga ko'rsatilmaydi. */
  notes?: string[];
  blocks: TopicBlock[];
};

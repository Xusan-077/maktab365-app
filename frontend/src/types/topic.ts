import type { LocalizedText } from "./i18n";
import type { TopicSummary } from "./catalog";

type BlockBase = { id: string };

export type GoalBlock = BlockBase & { type: "goal"; text: LocalizedText };

export type ExplanationBlock = BlockBase & {
  type: "explanation";
  /** Qisqa bo'lim sarlavhasi. */
  title?: LocalizedText;
  text: LocalizedText;
};

export type RuleBlock = BlockBase & {
  type: "rule";
  title?: LocalizedText;
  text: LocalizedText;
  /** Formula, LaTeX yozuvida (KaTeX serverda chizadi). Matn kerak bo'lsa `	ext{…}`. */
  formula?: string;
};

export type ExampleStep = { text: LocalizedText; /** LaTeX. */ formula?: string };

export type ExampleBlock = BlockBase & {
  type: "example";
  title?: LocalizedText;
  steps: ExampleStep[];
};

type ExerciseBase = BlockBase & {
  type: "exercise";
  question: LocalizedText;
  hint?: LocalizedText;
  explanation?: LocalizedText;
};

export type ChoiceExercise = ExerciseBase & {
  answerType: "choice";
  options: LocalizedText[];
  /** To'g'ri variant indeksi. */
  answer: number;
};

export type InputExercise = ExerciseBase & {
  answerType: "input";
  /** Qabul qilinadigan javoblar (normallashtirilgan holda solishtiriladi). */
  answer: string[];
};

export type TrueFalseExercise = ExerciseBase & {
  answerType: "truefalse";
  answer: boolean;
};

/** Tartiblash mashqi: `items` ko'rsatilish tartibida (aralash), `answer` — to'g'ri tartibdagi indekslar. */
export type OrderExercise = ExerciseBase & {
  answerType: "order";
  items: LocalizedText[];
  answer: number[];
};

export type ExerciseBlock = ChoiceExercise | InputExercise | TrueFalseExercise | OrderExercise;
export type ExerciseAnswerType = ExerciseBlock["answerType"];

export type SummaryBlock = BlockBase & { type: "summary"; points: LocalizedText[] };

export const WIDGET_KINDS = [
  "quadratic-graph",
  "choice-explain",
  "geometry-points",
  "timeline",
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

/** Kvadrat funksiya grafigi: boshlang'ich koeffitsiyentlar (y = ax² + bx + c). */
export type QuadraticGraphProps = { a: number; b: number; c: number };

/** Til mashqi: variant tanlanadi, har bir variantning sababi ko'rsatiladi. Inglizcha matn tarjima qilinmaydi. */
export type ChoiceExplainProps = {
  prompt: string;
  options: { text: string; correct: boolean; reason: LocalizedText }[];
};

/** Uchburchak uchlari (butun koordinatali katak to'ri, 0…GRID). Uchlar surib ko'riladi. */
export type GeometryPointsProps = {
  points: { label: string; x: number; y: number }[];
};

/** Vaqt chizig'i voqeasi: `sortKey` — tartiblash uchun YYYYMMDD butun soni (kun noma'lum bo'lsa 00), `date` — ko'rsatiladigan matn. */
export type TimelineEvent = {
  id: string;
  sortKey: number;
  date: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
};
export type TimelineProps = { events: TimelineEvent[] };

export type WidgetPropsByKind = {
  "quadratic-graph": QuadraticGraphProps;
  "choice-explain": ChoiceExplainProps;
  "geometry-points": GeometryPointsProps;
  timeline: TimelineProps;
};

export type WidgetBlock = {
  [K in WidgetKind]: BlockBase & { type: "widget"; kind: K; props: WidgetPropsByKind[K] };
}[WidgetKind];

export type TopicBlock =
  | GoalBlock
  | ExplanationBlock
  | RuleBlock
  | ExampleBlock
  | ExerciseBlock
  | SummaryBlock
  | WidgetBlock;
export type TopicBlockType = TopicBlock["type"];

/** Kontent tekshiruv holati: `draft` — haqiqiy darslikdan hali tekshirilmagan. */
export const CONTENT_STATUSES = ["draft", "reviewed"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type Topic = TopicSummary & {
  status: ContentStatus;
  blocks: TopicBlock[];
};

export type TopicSearchFilters = {
  bookId?: string;
};

export type TopicSearchResult = {
  topic: TopicSummary;
  bookTitle: LocalizedText;
  chapterTitle: LocalizedText;
  /** Mos so'zlar `⟦…⟧` bilan belgilangan matn parchasi (faqat backend qidiruvida); `splitSnippet` bilan ajratiladi. */
  snippet?: string;
};

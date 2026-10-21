import type { components } from "./schema";
import type { StudyGoal, UpdateGoalInput } from "@/types/goal";
import type {
  BookBookmark,
  Bookmark,
  Dashboard,
  ExerciseStatus,
  GuestData,
  MergeResult,
  Progress,
  ReadStatus,
  RecentTopic,
  Results,
  SaveProgressInput,
  TeacherDashboard,
} from "@/types/progress";

type Schemas = components["schemas"];

/** Backend holat nomlari (`not_started|in_progress|read|passed`) ↔ frontend (`none|started|completed`). */
const READ_FROM_API: Record<Schemas["ReadStatusEnum"], ReadStatus> = {
  not_started: "none",
  in_progress: "started",
  read: "completed",
};
export const READ_TO_API: Record<ReadStatus, Schemas["ReadStatusEnum"]> = {
  none: "not_started",
  started: "in_progress",
  completed: "read",
};
const EXERCISE_FROM_API: Record<Schemas["ExerciseStatusEnum"], ExerciseStatus> = {
  not_started: "none",
  in_progress: "in_progress",
  passed: "completed",
};
export const EXERCISE_TO_API: Record<ExerciseStatus, Schemas["ExerciseStatusEnum"]> = {
  none: "not_started",
  in_progress: "in_progress",
  completed: "passed",
};

export function toProgress(dto: Schemas["TopicProgress"], userId = ""): Progress {
  const stats = dto.exercise_stats;
  return {
    userId,
    topicId: dto.topic_id,
    readStatus: READ_FROM_API[dto.read_status ?? "not_started"],
    exerciseStatus: EXERCISE_FROM_API[dto.exercise_status ?? "not_started"],
    ...(dto.last_block_id && { lastBlockId: dto.last_block_id }),
    updatedAt: dto.updated_at ?? "",
    mistakes: dto.mistakes.map((item) => item.exercise_id),
    ...(stats.solved && stats.solved.length > 0 && { solved: stats.solved }),
    ...(stats.attempts && Object.keys(stats.attempts).length > 0 && { attempts: stats.attempts }),
  };
}

type ProgressRequest = Schemas["ProgressWriteRequest"];

/**
 * Frontend yozuvi → PUT tanasi. Maydonlar faqat berilgan bo'lsa yuboriladi (PUT yuborilmaganga
 * tegmaydi). `mistakes` — xato mashqlar id'lari; urinishlar `attempts` dan olinadi.
 */
export function toProgressRequest(input: SaveProgressInput): ProgressRequest {
  return {
    ...(input.readStatus && { read_status: READ_TO_API[input.readStatus] }),
    ...(input.exerciseStatus && { exercise_status: EXERCISE_TO_API[input.exerciseStatus] }),
    ...(input.lastBlockId !== undefined && { last_block_id: input.lastBlockId }),
    ...(input.mistakes && {
      mistakes: input.mistakes.map((exerciseId) => ({
        exercise_id: exerciseId,
        attempts: Math.max(1, input.attempts?.[exerciseId] ?? 1),
        ...(input.updatedAt && { last_wrong_at: input.updatedAt }),
      })),
    }),
    ...((input.solved || input.attempts) && {
      exercise_stats: {
        ...(input.solved && { solved: input.solved }),
        ...(input.attempts && { attempts: input.attempts }),
      },
    }),
    ...(input.updatedAt && { updated_at: input.updatedAt }),
  };
}

export function toMergeRequest(data: GuestData): Schemas["MergeRequestRequest"] {
  return {
    progress: Object.entries(data.progress).map(([topicId, item]) => ({
      topic_id: topicId,
      ...toProgressRequest({
        topicId,
        readStatus: item.readStatus,
        exerciseStatus: item.exerciseStatus,
        lastBlockId: item.lastBlockId,
        mistakes: item.mistakes,
        solved: item.solved,
        attempts: item.attempts,
        updatedAt: item.updatedAt,
      }),
    })),
    bookmarks: data.bookmarks.map((topicId) => ({ kind: "topic" as const, topic_id: topicId })),
  };
}

export const toMergeResult = (dto: Schemas["MergeResult"]): MergeResult => ({
  progress: dto.progress,
  bookmarks: dto.bookmarks,
  failed: dto.failed,
});

export const toBookmark = (dto: Schemas["Bookmark"], userId = ""): Bookmark => ({
  id: dto.id,
  userId,
  topicId: dto.topic_id ?? "",
  createdAt: dto.created_at,
});

export const toBookBookmark = (dto: Schemas["Bookmark"], userId = ""): BookBookmark => ({
  id: dto.id,
  userId,
  bookId: dto.book_id ?? "",
  createdAt: dto.created_at,
});

export const toGoal = (dto: Schemas["StudyGoal"], userId = ""): StudyGoal => ({
  id: dto.id,
  userId,
  title: dto.title,
  done: dto.done,
  createdAt: dto.created_at,
});

export const toGoalPatch = (input: UpdateGoalInput): Schemas["PatchedStudyGoalPatchRequest"] => ({
  ...(input.title !== undefined && { title: input.title.trim() }),
  ...(input.done !== undefined && { done: input.done }),
});

export const toRecentTopic = (dto: Schemas["RecentView"]): RecentTopic => ({
  topicId: dto.topic_id,
  bookId: dto.book_id,
  viewedAt: dto.viewed_at,
});

export function toDashboard(dto: Schemas["Dashboard"], userId = ""): Dashboard {
  return {
    continue: dto.continue ? toProgress(dto.continue, userId) : null,
    hasProgress: dto.has_progress,
    subjects: dto.subjects.map((item) => ({
      bookId: item.book_id,
      subjectId: item.subject_id,
      grade: item.grade,
      topicsTotal: item.topics_total,
      topicsRead: item.topics_read,
      topicsPassed: item.topics_passed,
    })),
    review: {
      count: dto.review.count,
      items: dto.review.items.map((item) => toProgress(item, userId)),
    },
    weekly: {
      since: dto.weekly.since,
      finished: dto.weekly.finished,
      read: dto.weekly.read,
      exercisesPassed: dto.weekly.exercises_passed,
      mistakes: dto.weekly.mistakes,
      active: dto.weekly.active,
    },
    savedCount: dto.saved_count,
  };
}

export function toResults(dto: Schemas["Results"], userId = ""): Results {
  const list = (items: Schemas["TopicProgress"][]) => items.map((item) => toProgress(item, userId));
  return {
    mastered: list(dto.mastered),
    review: list(dto.review),
    inProgress: list(dto.in_progress),
    counts: {
      mastered: dto.counts.mastered,
      review: dto.counts.review,
      inProgress: dto.counts.in_progress,
    },
  };
}

export const toTeacherDashboard = (
  dto: Schemas["TeacherDashboard"],
  userId = "",
): TeacherDashboard => ({
  recent: dto.recent.map(toRecentTopic),
  savedTopics: dto.saved_topics.map((item) => toBookmark(item, userId)),
  savedBooks: dto.saved_books.map((item) => toBookBookmark(item, userId)),
  savedTopicsCount: dto.saved_topics_count,
  savedBooksCount: dto.saved_books_count,
});

import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type AdminBook = Schemas["BookAdmin"];
export type AdminBookInput = Schemas["BookAdminRequest"];
export type AdminBookPatch = Schemas["PatchedBookAdminRequest"];
export type AdminChapter = Schemas["ChapterAdmin"];
export type AdminChapterInput = Schemas["ChapterAdminRequest"];
export type AdminChapterPatch = Schemas["PatchedChapterAdminRequest"];
export type AdminTopic = Schemas["TopicAdmin"];
export type AdminTopicItem = Schemas["TopicList"];
export type AdminTopicInput = Schemas["TopicAdminRequest"];
export type AdminTopicPatch = Schemas["PatchedTopicAdminRequest"];
export type AdminSubject = Schemas["SubjectAdmin"];
export type AdminUser = Schemas["UserAdmin"];
export type AdminDashboard = Schemas["AdminDashboard"];
export type AuditEntry = Schemas["AuditEntry"];
export type UploadResult = Schemas["UploadResult"];
export type UploadKind = Schemas["UploadRequestKindEnum"];
export type ReorderInput = Schemas["ReorderRequest"];
export type TopicStatus = Schemas["TopicStatusEnum"];
export type BookStatus = "published" | "draft";

export interface Page<T> {
  count: number;
  results: T[];
}

/** Ro'yxat so'rovi: URL search params bilan bir xil shakl (`list-params.ts`). */
export interface BookListParams {
  page?: number;
  search?: string;
  grade?: number;
  subject?: string;
  status?: BookStatus;
  ordering?: string;
}

export const PAGE_SIZE = 20;

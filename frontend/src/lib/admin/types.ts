import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type AdminSubject = Schemas["SubjectAdmin"];
export type AdminSubjectInput = Schemas["SubjectAdminRequest"];
export type AdminSubjectPatch = Schemas["PatchedSubjectAdminRequest"];
export type AdminUser = Schemas["UserAdmin"];
export type AdminDashboard = Schemas["AdminDashboard"];
export type AuditEntry = Schemas["AuditEntry"];
export type UploadResult = Schemas["UploadResult"];
export type UploadKind = Schemas["UploadRequestKindEnum"];
export type AdminPdfBook = Schemas["PdfBookAdmin"];
export type AdminPdfBookInput = Schemas["PdfBookAdminRequest"];
export type AdminPdfBookPatch = Schemas["PatchedPdfBookAdminRequest"];
export type PdfUploadPlan = Schemas["PdfUploadPlan"];
export type PdfUploadPart = Schemas["PdfUploadPartRequest"];
export type PdfBookStatus = Schemas["PdfBookAdminStatusEnum"];
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

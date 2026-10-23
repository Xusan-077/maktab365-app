/** S3/R2: bir multipart yuklashda eng ko'pi bilan shuncha bo'lak. */
export const MAX_PARTS = 10_000;
const MIB = 1024 * 1024;
/** Bo'lakning eng kichik hajmi (backend `PDF_UPLOAD_PART_BYTES` default'i). */
export const MIN_PART_BYTES = 8 * MIB;

/**
 * Bo'lak hajmi: kamida `minPart`; bo'laklar `MAX_PARTS` dan oshmasligi uchun butun MiB gacha
 * kattalashadi. Backend `pdf_storage.part_size_for` bilan bir xil (server hajmni `part_size` da beradi).
 */
export function partSizeFor(size: number, minPart = MIN_PART_BYTES): number {
  const needed = Math.ceil(size / MAX_PARTS);
  return needed <= minPart ? minPart : Math.ceil(needed / MIB) * MIB;
}

export function partCountFor(size: number, partSize = partSizeFor(size)): number {
  return Math.max(1, Math.ceil(size / partSize));
}

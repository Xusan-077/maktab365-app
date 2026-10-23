import { GeneratedCover } from "./GeneratedCover";

export interface BookCoverProps {
  grade: number;
  subject: string;
  subjectTitle: string;
  className?: string;
}

/**
 * Darslik muqovasi: hamma joyda (katalog, bosh sahifa, panel, admin, o'qish oynasi) bir xil
 * generativ muqova, nisbat 2:3. PDFning birinchi bet rasmi kartalarda ko'rsatilmaydi.
 */
export function BookCover({ grade, subject, subjectTitle, className }: BookCoverProps) {
  return (
    <GeneratedCover
      grade={grade}
      subject={subject}
      subjectTitle={subjectTitle}
      className={className}
    />
  );
}

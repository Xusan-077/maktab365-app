import { Brain } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Muqova rasmi; rasm yo'q bo'lsa — rangli joy egasi (layout siljimasin). */
export function QuizCover({ src, className }: { src: string | null; className?: string }) {
  return (
    <div
      className={cn("bg-primary-soft text-link relative aspect-[16/9] overflow-hidden", className)}
    >
      <Brain
        className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 opacity-40"
        aria-hidden
      />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- ommaviy saqlash manzili; o'lcham aspect-ratio bilan belgilangan
        <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}

import katex from "katex";
import { cn } from "@/lib/utils/cn";

export interface FormulaProps {
  /** LaTeX. */
  tex: string;
  /** `false` — matn ichida (inline) ko'rinish. */
  display?: boolean;
  className?: string;
}

/** KaTeX serverda HTML + MathML ga chiziladi: client'ga KaTeX JS yuborilmaydi, ekran o'qigichlar MathML'ni o'qiydi. */
export function Formula({ tex, display = true, className }: FormulaProps) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    output: "htmlAndMathml",
    strict: "ignore",
  });
  const Tag = display ? "div" : "span";
  return (
    <Tag
      className={cn(display && "max-w-full overflow-x-auto overflow-y-hidden py-1", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

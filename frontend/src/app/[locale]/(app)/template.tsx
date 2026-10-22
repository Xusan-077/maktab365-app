import type { ReactNode } from "react";

/** Har navigatsiyada qayta chiziladi: kontent yengil paydo bo'ladi (CSS, gidratsiyani kutmaydi). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="enter flex flex-1 flex-col gap-8">{children}</div>;
}

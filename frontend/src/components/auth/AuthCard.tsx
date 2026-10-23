import type { ReactNode } from "react";

/** `(auth)` sahifalari uchun umumiy ramka: sarlavha, izoh va forma. */
export function AuthCard({
  title,
  text,
  children,
}: {
  title: ReactNode;
  text?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="border-border bg-surface enter flex flex-col gap-6 rounded-2xl border p-6 shadow-md sm:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
          {text && <p className="text-muted">{text}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}

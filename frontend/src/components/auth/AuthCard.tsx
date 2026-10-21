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
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-6 px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
        {text && <p className="text-muted">{text}</p>}
      </header>
      {children}
    </div>
  );
}

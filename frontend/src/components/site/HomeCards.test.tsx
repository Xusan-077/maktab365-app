// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { GradeTile } from "./GradeTile";
import { GroupCard } from "./GroupCard";

const wrap = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      {node}
    </NextIntlClientProvider>,
  );

const subject = (slug: string, title: string) => ({ slug, title: { uz: title } });

afterEach(cleanup);

describe("GradeTile", () => {
  it("kitoblar soni ko'rsatiladi va karta havola", () => {
    wrap(<GradeTile grade={9} bookCount={12} />);
    expect(screen.getByText("12 ta kitob")).toBeTruthy();
    expect(screen.getByRole("link")).toBeTruthy();
  });

  it("kitobi yo'q sinf — «Tez orada», kulrang va havolasiz", () => {
    wrap(<GradeTile grade={11} bookCount={0} />);
    expect(screen.getByTestId("grade-tile-soon").textContent).toContain(uz.site.comingSoon);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("son noma'lum (API javob bermadi) — son yo'q, havola bor", () => {
    wrap(<GradeTile grade={5} />);
    expect(screen.getByRole("link").textContent).not.toMatch(/kitob/);
  });
});

describe("GroupCard", () => {
  it("son va tavsif bir xil manbadan: 1 ta fan — 1 ta nom", () => {
    wrap(<GroupCard group="exact" subjects={[subject("algebra", "Algebra")]} href="/x" />);
    expect(screen.getByTestId("group-subjects").textContent).toBe("Algebra");
    expect(screen.getByText("1 ta fan")).toBeTruthy();
  });

  it("3 tadan ko'p fan: «… va yana N ta»", () => {
    const subjects = ["Algebra", "Geometriya", "Matematika", "Informatika", "Chizmachilik"].map(
      (title) => subject(title.toLowerCase(), title),
    );
    wrap(<GroupCard group="exact" subjects={subjects} href="/x" />);
    expect(screen.getByTestId("group-subjects").textContent).toBe(
      "Algebra, Geometriya, Matematika va yana 2 ta",
    );
    expect(screen.getByText("5 ta fan")).toBeTruthy();
  });

  it("kitobli fan yo'q — «Tez orada»; API javob bermasa — matn ham son ham yo'q", () => {
    wrap(<GroupCard group="arts" subjects={[]} href="/x" />);
    expect(screen.getByTestId("group-subjects").textContent).toBe(uz.site.comingSoon);
    cleanup();
    wrap(<GroupCard group="arts" subjects={null} href="/x" />);
    expect(screen.queryByTestId("group-subjects")).toBeNull();
    expect(screen.queryByText(/ta fan/)).toBeNull();
  });
});

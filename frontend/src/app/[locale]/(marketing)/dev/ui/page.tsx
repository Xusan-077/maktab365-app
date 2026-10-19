import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { UiShowcase } from "@/components/dev/UiShowcase";

export default async function DevUiPage({ params }: PageProps<"/[locale]/dev/ui">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  return <UiShowcase />;
}

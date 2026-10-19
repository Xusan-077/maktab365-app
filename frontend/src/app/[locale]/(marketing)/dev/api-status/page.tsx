import { notFound } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { ApiStatus } from "@/components/dev/ApiStatus";

export default async function DevApiStatusPage({ params }: PageProps<"/[locale]/dev/api-status">) {
  if (process.env.NODE_ENV === "production") notFound();
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  return <ApiStatus />;
}

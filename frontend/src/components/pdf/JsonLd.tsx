import { serializeJsonLd } from "@/lib/seo/jsonld";

/** Tuzilmali ma'lumot (JSON-LD); `data` serverda tayyorlangan, `<` qochirilgan holda yoziladi. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}

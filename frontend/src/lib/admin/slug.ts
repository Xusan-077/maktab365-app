const SLUG_MAX_LENGTH = 50;

/**
 * Sarlavhadan slug: lotin harflari, raqamlar va tire. Diakritik va o'zbek apostroflari
 * (`o'`, `g‘`, `ʼ`) tushib qoladi; boshqa belgilar tire bo'ladi.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['`‘’ʻʼ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

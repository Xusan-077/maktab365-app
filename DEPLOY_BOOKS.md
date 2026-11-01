# Kitoblar bo'limini deploy qilish (Railway + Vercel + R2)

Umumiy deploy qoidalari: [`DEPLOY.md`](DEPLOY.md). Bu fayl faqat **Kitoblar** (`apps/books`, `/kitoblar`,
`/admin/kutubxona`) uchun: nimani qayerga qo'yish kerak va nima uchun.

## Arxitektura: PDF + PDF.js (fonda ishlov yo'q)

Kitob o'qish oynasi sahifa rasmlarini emas, **PDF'ning o'zini** PDF.js bilan brauzerda chizadi:

- Admin PDF yuklaydi (brauzerdan to'g'ridan-to'g'ri R2'ga yoki, lokalda, backend orqali).
- Yuklash tugashi bilan backend **sinxron** (`pypdfium2`, `apps/books/pdfmeta.py`) PDF'ni tekshiradi:
  sahifalar soni, matn qatlami bor-yo'qligi va muqova (1-bet → WebP ~800×1200). Kitob **darhol** `ready`.
- Fonda ishlov yo'q: Celery vazifasi, "Tayyorlanmoqda"/"Xato" holatlari, "Qayta tayyorlash" va
  `reprocess_books` buyrug'i olib tashlangan. **Kitoblar uchun Celery worker kerak emas.**
- Brauzer `GET /api/v1/books/<id>/file-url/` dan **imzolangan URL** oladi va PDF.js HTTP **Range** bilan faqat
  kerakli bo'laklarni yuklaydi (butun fayl emas).

> Worker xizmati baribir kerak: `accounts` (email/OTP), `support` va `content` (watermark, matn qatlami, OCR)
> vazifalari uchun. Faqat **kitoblar** uchun u talab qilinmaydi.

### Nima uchun imzolangan URL (ommaviy R2 emas)

PDF **private** bucket'da qoladi, o'qish URL'i qisqa muddatli (`PDF_SIGNED_URL_SECONDS`, 900 s):

- darsliklar (`PdfBook`) uchun sinalgan mexanizm qayta ishlatiladi (CORS, Range, lokal `file/` token);
- qoralama (nashr qilinmagan) va almashtirilgan eski fayllar ochiq URL bilan oshkor bo'lmaydi
  (URL tokeni aynan shu faylga bog'langan);
- manba PDF'lar uchun yangi ommaviy bucket/domen kerak emas.

Kamchiligi: URL muddati tugagach keyingi Range so'rovlari rad etiladi. O'qish oynasi buni o'zi sezadi va
yangi URL bilan hujjatni qayta ochadi (yoki foydalanuvchi "Qayta urinish" tugmasini bosadi).

## Xizmatlar

| Xizmat (platforma)  | Nima ishlatadi                                              | Start command                                                             |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `backend` (Railway) | `backend/railway.json`                                      | Dockerfile `CMD` (gunicorn). Pre-deploy: `scripts/predeploy.sh` (migrate) |
| `frontend` (Vercel) | Root Directory = `frontend`                                 | `vercel-build` (backend tayyor bo'lguncha kutadi)                         |
| PostgreSQL          | backend                                                     | —                                                                         |
| R2: `PDF` bucket    | **private** — manba PDF'lar (`book-sources/`)               | —                                                                         |
| R2: `covers` bucket | **public** + domen — muqovalar (`covers/<kitob>-<id>.webp`) | —                                                                         |

## Env o'zgaruvchilari (backend)

| O'zgaruvchi                                        | Qiymat / izoh                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `AWS_STORAGE_BUCKET_NAME`                          | **PDF** bucket (private). Bo'sh bo'lsa lokal disk — productionda **bo'sh bo'lmasligi shart**. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`       | R2 API token (PDF bucket: o'qish + yozish).                                                   |
| `AWS_S3_ENDPOINT_URL`, `AWS_S3_REGION_NAME`        | R2: `https://<account_id>.r2.cloudflarestorage.com`, `auto`.                                  |
| `COVERS_BUCKET_NAME`, `COVERS_S3_CUSTOM_DOMAIN`    | **Ommaviy** bucket va domen (masalan `cdn.darslik365.uz`): muqova URL'lari shundan quriladi.  |
| `COVERS_ACCESS_KEY_ID`, `COVERS_SECRET_ACCESS_KEY` | Faqat `covers` bucket'iga ruxsatli token.                                                     |

`COVERS_*` bo'sh bo'lsa muqovalar **PDF (private) bucket**ga yoziladi va saytda ochilmaydi (403).

### Ixtiyoriy (kitoblar)

| O'zgaruvchi                  | Sukut   | Izoh                                                                  |
| ---------------------------- | ------- | --------------------------------------------------------------------- |
| `BOOK_PDF_MAX_BYTES`         | 200 MiB | Kitob PDF'ining eng katta hajmi (yuklashda `413 file_too_large`).     |
| `BOOK_OPTIMIZE_MAX_BYTES`    | 120 MiB | Shundan katta PDF yuklashda qayta yozilmaydi (so'rov vaqti uchun).    |
| `BOOK_OPTIMIZE_WARN_BYTES`   | 20 MiB  | Optimallashtirilmagan PDF shundan katta bo'lsa admin ogohlantiriladi. |
| `ADMIN_UPLOAD_MAX_PDF_BYTES` | 50 MB   | Faqat backend orqali (proxy, lokal) yuklashda chegara.                |
| `PDF_UPLOAD_PART_BYTES`      | 8 MiB   | Multipart bo'lak hajmi (R2 kamida 5 MiB).                             |
| `PDF_SIGNED_URL_SECONDS`     | 900     | Imzolangan URL muddati.                                               |

### PDF optimallashtirish (yuklashda)

Yuklash tugagach PDF `pikepdf` (qpdf) bilan **qayta yoziladi**: obyektlar tartiblanadi, sahifa lug'atlari
object stream'larga yig'iladi. Mazmun, rasm va matn qatlami o'zgarmaydi. Sabab — PDF.js Range bilan faqat kerakli
bo'laklarni olishi uchun: sahifa lug'atlari rasmlar orasiga sochilgan skaner PDF'da (ko'p skanerlar shunday) PDF.js
har bir sahifa uchun alohida bo'lak so'raydi va butun faylni yuklab oladi.

O'lchov (PDF.js 6.4, 120 bet, 30 MB skaner; Range so'rovlar soni, 1-bet + 60-bet):

| Fayl                                | So'rovlar        |
| ----------------------------------- | ---------------- |
| Asl (sahifa lug'atlari sochilgan)   | 116 (butun fayl) |
| **Linearize** ("Fast Web View")     | 116 (butun fayl) |
| **Qayta yozilgan (object streams)** | 5–6, ~1,5 MB     |

**Linearize qilinmaydi:** PDF.js linearize jadvallaridan (hint tables) foydalanmaydi va linearize qilingan faylni
ham to'liq yuklaydi; adminning "Fast Web View" bilan yuklagan fayli ham shu yerda oddiy shaklga qaytadi.

- Optimallashtirish bo'lmasa (fayl `BOOK_OPTIMIZE_MAX_BYTES` dan katta yoki qpdf tiklay olmagan tuzilma) kitob
  baribir `ready` bo'ladi; fayl `BOOK_OPTIMIZE_WARN_BYTES` dan katta bo'lsa admin kartasida ogohlantirish chiqadi.
- **Yangi tizim bog'liqligi yo'q:** `pikepdf` Python paketi (`uv.lock`'da), uning wheel'i qpdf'ni ichiga o'rab
  keladi (manylinux, `python:3.12-slim` va Railway'da `apt install` kerak emas). Litsenziya: pikepdf — MPL-2.0,
  qpdf — Apache-2.0 (ikkalasi ham tijoriy loyihada xavfsiz; pdfium BSD/Apache, o'zgarmagan).
- Eski kitoblar qayta yozilmagan (`is_optimized=false`): ularni adminda PDF'ni qayta yuklab optimallashtirish mumkin.

Katta PDF yuklash: fayl baytlari brauzerdan **to'g'ridan-to'g'ri R2'ga** (multipart) ketadi — gunicorn'dan
o'tmaydi, shuning uchun hajm uni to'xtatmaydi. Faqat yuklash tugagach `upload-complete` so'rovi ichida
(sinxron) tekshiruv bajariladi: R2'dan yuklab olish, pdfium bilan tahlil, pikepdf bilan qayta yozish va
qayta yuklash. Katta skaner PDF'da bu 60 soniyadan oshishi mumkin, shuning uchun:

- gunicorn timeout — `GUNICORN_TIMEOUT` (standart **180** s, `backend/Dockerfile`). Railway'da
  o'zgartirish shart emas; ko'proq kerak bo'lsa env orqali oshiring.
- Brauzer so'rovi `upload-complete` uchun 170 s kutadi (boshqa so'rovlarda 10 s); undan oshsa admin
  «Tekshiruv uzoq davom etdi, sahifani yangilab ko'ring» xabarini ko'radi (kitob holati yangilanishda ko'rinadi).
- Chegaralar: `BOOK_PDF_MAX_BYTES` (200 MiB) — undan kattasi rad etiladi; `BOOK_OPTIMIZE_MAX_BYTES` (120 MiB)
  dan kattasi qayta yozilmaydi (faqat tekshiriladi), shuning uchun eng og'ir ish ham chegaralangan.

Nega aynan shu: signed-upload allaqachon bor, shuning uchun alohida navbat/fon ishchi (worker) qo'shish
murakkablik beradi; timeout + hajm chegarasi eng oddiy va ishonchli yechim. 200 MiB dan katta fayllar kerak
bo'lsa, tekshiruvni Celery'ga ko'chirish keyingi qadam.

### R2 CORS (PDF bucket) — **majburiy**

PDF.js brauzerdan R2 URL'ga to'g'ridan-to'g'ri `Range` so'rovi yuboradi. Bucket CORS'ida (sayt origin'lari uchun):

```json
[
  {
    "AllowedOrigins": ["https://darslik365.uz", "https://www.darslik365.uz"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Range", "Content-Type", "Content-MD5", "x-amz-*"],
    "ExposeHeaders": [
      "Accept-Ranges",
      "Content-Range",
      "Content-Length",
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

- `Range` — `AllowedHeaders` da, `Accept-Ranges` va `Content-Range` — `ExposeHeaders` da bo'lmasa PDF.js faylni
  bo'laklab o'qiy olmaydi va **butun faylni** yuklaydi (yoki umuman ochilmaydi).
- `PUT` + `ETag` — brauzerdan multipart yuklash uchun (aks holda yuklash yakunlanmaydi).
- **covers bucket**: ommaviy domen ulangan (Cloudflare → R2 → Custom Domain). Muqovalar yozilgandan keyin
  o'zgarmaydi (kalitda tasodifiy qo'shimcha), uzoq kesh xavfsiz.

## Deploy tartibi

Migratsiya `books.0004_books_pdf_viewer` (faqat **qo'shadi** — eski kod bilan mos):

- `Book.cover_generated`, `Book.has_text_layer` maydonlari;
- ma'lumot: `processing`/`failed` holatida qolgan va fayli bor kitoblar → `ready` (`invalid_pdf` xatosi bundan mustasno).
- **`BookPage` jadvali va qatorlari o'chirilmaydi** (eski kitoblarning sahifa rasmlari, "Mening yozuvlarim" eskizlari
  va eksport ularga tayanadi); yangi kitoblar uchun sahifa qatorlari yaratilmaydi.

Ularni alohida ishga tushirish shart emas: backend'ning Railway pre-deploy'i (`scripts/predeploy.sh`) o'zi
`migrate --noinput` qiladi; xato bo'lsa deploy to'xtaydi va eski versiya ishlashda qoladi.

1. **R2 CORS** ni yuqoridagicha yangilang (frontend chiqishidan **oldin**, aks holda o'qish oynasi ochilmaydi).
2. **PR → `main`**: CI yashil bo'lsin (ruff, pytest, `makemigrations --check`, openapi, frontend).
3. **Backend** deploy (Railway avtomatik): pre-deploy migratsiyalar → health-check `/api/v1/health/`.
4. **Frontend** (Vercel): production build backend tayyor bo'lguncha kutadi.
5. **Tekshiruv** (pastda).

## Deploydan keyingi tekshiruv

1. `/uz/admin/kutubxona` → "Kitob qo'shish" → PDF yuklang. Yuklash tugashi bilan holat **Tayyor**, bet soni va
   muqova ko'rinadi (kutish yo'q).
2. "Nashr qilish" → `/uz/kitoblar` da kitob va muqovasi ko'rinadi; "O'qish" sahifasida PDF ochiladi.
3. Brauzer Network (DevTools): `book-sources/…` ga so'rovlar `206 Partial Content` va `Range:` bilan ketayotgan
   bo'lishi kerak; birinchi bet butun fayl yuklanmasdan chiziladi.
4. Eski kitoblar: tayyor sahifa qatorlari bor, lekin PDF ham bor — o'qish oynasi PDF'dan ochiladi. Migratsiyadan oldin
   yuklangan kitobda `has_text_layer` noma'lum (`null`) bo'lishi mumkin: qidiruv urinib ko'riladi, skaner bo'lsa
   "Bu kitobda qidiruv mavjud emas" chiqadi. Muqovasi yo'q kitobda admin "Avtomatik muqova"ni bosadi.

## Muammolar

| Belgi                                              | Ehtimoliy sabab                                 | Yechim                                                   |
| -------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| O'qish oynasi "Bet yuklanmadi"                     | R2 CORS'da `Range`/`Accept-Ranges` yo'q         | R2 CORS'ni yuqoridagicha sozlang                         |
| Birinchi bet juda sekin, Network'da 200 butun fayl | Range ishlamayapti (CORS yoki proksi)           | `Accept-Ranges`/`Content-Range` ExposeHeaders, CDN keshi |
| Kitob uzoq o'qilganda bet chizilmay qoladi         | Imzolangan URL muddati tugadi                   | Avtomatik qayta ochiladi; "Qayta urinish"                |
| Yuklashda `file_too_large`                         | PDF `BOOK_PDF_MAX_BYTES` dan katta              | PDF'ni kichraytiring yoki chegarani oshiring             |
| Yuklashda `invalid_pdf` / `pdf_encrypted`          | PDF buzilgan yoki parol bilan himoyalangan      | Boshqa fayl yuklang / parolni olib tashlang              |
| Muqova saytda 403                                  | `COVERS_*` env yo'q — rasmlar private bucket'da | `COVERS_BUCKET_NAME` va `COVERS_S3_CUSTOM_DOMAIN`        |
| Brauzerda PDF yuklash to'xtaydi (R2)               | Bucket CORS'ida `PUT` / `ETag` yo'q             | R2 CORS'ni yuqoridagicha sozlang                         |

## 5-bosqich: kitob turiga xos rejimlar (`math`, `test`)

- Migratsiya `books.0006_books_modes` (yangi jadvallar: `AnswerKeyItem`, `SheetAnswer`, `AnswerAttempt`;
  `PageAnnotation.type` ga `solution`). Mavjud ma'lumotga tegmaydi; `migrate` yetarli.
- Test kitobda javoblar kaliti adminda (kitob tahriri → «Javoblar kaliti») kiritiladi. Kalit foydalanuvchiga
  hech qachon yuborilmaydi: faqat savollar ro'yxati va tekshirishdan keyin har savol uchun to'g'ri/xato.
- Yangi env yo'q; `katex` — frontend bog'liqligi (allaqachon `package.json` da).

# Mavzu materiallari API: Xulosa va Taqdimot

Bu hujjat backend (Django + DRF) uchun shartnoma. Frontend unga moslab yozilgan va hozircha mock bilan ishlaydi.

- **Mavzu** (`topic`) — kitob mundarijasidagi bo'lim, ya'ni `chapters[].id` yoki `chapters[].children[].id` (UUID). Alohida model shart emas: `TopicSummary` va `Presentation` bo'limga `OneToOne` bog'lanadi.
- Prefiks loyiha konventsiyasiga ko'ra `/api/v1` (`/api/topics/...` emas). JSON kalitlari `snake_case`.
- Xato formati umumiy: `{ "code": "validation_error", "message": "...", "details": { "field": ["..."] } }`.
- Endpoint'lar `backend/openapi.yaml` ga qo'shilgach, `make schema && make types` ishga tushiriladi. Shundan keyin frontend'dagi vaqtinchalik tiplar (`frontend/src/lib/topic-materials/types.ts`) `components["schemas"][…]` aliaslariga almashtiriladi. Maydon nomlari pastdagidek qolsin.

## Rollar

| Kim                             | Ko'radi                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Mehmon / o'quvchi               | Faqat `status = published` xulosa. Taqdimotda faqat `hidden = false` slaydlar, `note` doim `null`. |
| O'qituvchi (`teacher`) va staff | Ochiq endpoint'larda ham `note` to'la. Staff qoralama xulosani va yashirin slaydlarni ham ko'radi. |
| Staff (admin, muharrir)         | `/api/v1/admin/...` endpoint'lari.                                                                 |

O'quvchi uchun `note` va yashirin slaydlarni yashirish **backend'da** qilinadi (serializer). Frontend ham yashirin slaydni ko'rsatmaydi, lekin bu faqat qo'shimcha himoya.

---

## Xulosa (Summary)

### Blok turlari

Xulosa — tipli bloklar ro'yxati. Erkin HTML yo'q: barcha matn oddiy matn sifatida chiqadi. Frontend `\n\n` ni xatboshi deb hisoblaydi.

```jsonc
{ "type": "idea", "title": "Asosiy g‘oya", "text": "..." }
{ "type": "bullets", "items": [{ "lead": "Diskriminant", "text": "D = b² − 4ac" }] }   // lead ixtiyoriy ("")
{ "type": "chips", "label": "Kalit so‘zlar", "items": ["ildiz", "koeffitsiyent"] }      // label ixtiyoriy ("")
{ "type": "teacher_note", "text": "..." }
{ "type": "example", "text": "..." }
```

Chegaralar (frontend `lib/validation/topic-materials.ts` bilan bir xil bo'lishi kerak):

| Maydon                         | Chegara                         |
| ------------------------------ | ------------------------------- |
| bloklar soni                   | ≤ 30                            |
| `idea.title`                   | ≤ 120 belgi                     |
| `*.text` (idea, note, example) | ≤ 1200 belgi                    |
| `bullets.items`                | ≤ 12; `lead` ≤ 80, `text` ≤ 400 |
| `chips.items`                  | ≤ 20; har biri ≤ 40, bo'sh emas |
| `chips.label`                  | ≤ 60                            |

Qoidalar:

- **Qoralama** (`draft`) chala bo'lishi mumkin, chunki avtosaqlash to'xtamasligi kerak. Bo'sh blok va bo'sh maydonlarga ruxsat bor, faqat uzunlik chegaralari tekshiriladi.
- **Nashr** (`published`) uchun kamida 1 blok kerak va majburiy maydonlar bo'sh bo'lmasligi kerak. Majburiy maydonlar: `idea.title`, `idea.text`, `bullets.items[].text` (kamida 1 band), `chips.items` (kamida 1 ta), `teacher_note.text`, `example.text`.
- Noma'lum `type` → `400 validation_error`. Klient o'zi bilmagan turdagi blokni (yangi versiyada qo'shilgan) jim o'tkazib yuboradi. Shuning uchun yangi tur qo'shish eski klientlarni buzmaydi.

### `GET /api/v1/topics/{topic_id}/summary/`

Ochiq.

```json
{
  "status": "published",
  "blocks": [{ "type": "idea", "title": "...", "text": "..." }],
  "updated_at": "2026-10-20T09:30:00Z"
}
```

- `404 not_found`: xulosa yo'q, yoki u qoralama va so'rovchi staff emas. Frontend ikkalasida ham «Xulosa hali tayyorlanmagan» deb ko'rsatadi.
- `status = published` bo'lsa, o'qish oynasida «Ustoz tekshirgan» belgisi chiqadi.
- Kesh: published javob uchun `Cache-Control: public, max-age=60` tavsiya etiladi.

### `PUT /api/v1/admin/topics/{topic_id}/summary/`

Staff. Tana: `{ "status": "draft" | "published", "blocks": [...] }`. To'liq almashtiradi va yo'q bo'lsa yaratadi.

- Javob: `200` + `GET` bilan bir xil obyekt (`updated_at` yangilangan).
- Xatolar: `400 validation_error`, bunda `details` kalitlari yo'l ko'rinishida bo'ladi, masalan `{"blocks.0.title": ["required"]}`. Yana `403`, `404` (bunday bo'lim yo'q).
- Frontend so'nggi tahrirdan **1 s** keyin avtosaqlaydi, shuning uchun bir daqiqada bir necha PUT kelishi normal. Throttle kamida 60/min/foydalanuvchi bo'lsin.

### `POST /api/v1/admin/topics/{topic_id}/summary/ai-draft/`

Staff. Tana bo'sh (`{}`). Javob: `200 { "blocks": [...] }`.

- **Hech narsa saqlamaydi.** Frontend natijani muharrirga qo'yadi, holatni `draft` qiladi, keyin u odatdagi PUT bilan saqlanadi. AI matni ustoz tekshirmaguncha o'quvchiga chiqmaydi.
- Manba sifatida bo'lim betlari matni olinadi (kitob matn qatlami, `page` dan keyingi bo'lim `page` igacha).
- Matn qatlami yo'q bo'lsa `409 { "code": "no_text_layer" }`. Limit oshsa `429`.
- Uzoq ishlasa ham (≤ 30 s) sinxron javob kifoya. Undan uzoq bo'lsa, taqdimotdagidek `status` polling bilan qilinadi (keyingi versiya).

---

## Taqdimot (Presentation)

### Obyektlar

```jsonc
// Presentation
{
  "id": "uuid",
  "slide_count": 12,            // o'quvchi javobida ko'rinadiganlar soni
  "pdf_url": "https://…/t.pdf",  // ixtiyoriy: yuklab olish uchun; null — tugma chiqmaydi
  "slides": [ /* Slide, order bo'yicha */ ]
}
// Slide
{
  "id": "uuid",
  "order": 1,                   // 1 dan
  "image_url": "https://…/1.webp",  // 1920×1080 webp
  "thumb_url": "https://…/1-480.webp", // 480px eni
  "alt": "Kvadrat tenglama formulasi",
  "note": "Bu yerda savol bering", // ustoz eslatmasi; o'quvchiga null
  "hidden": false
}
```

Rasm URL'lari ommaviy (CDN, `public` storage) yoki uzoq muddatli imzolangan bo'lsin. Frontend ularni `next/image unoptimized` bilan ko'rsatadi, ya'ni Vercel optimizatsiyasidan o'tmaydi.

### `GET /api/v1/topics/{topic_id}/presentation/`

Ochiq. Javobda `Presentation` qaytadi.

- O'quvchi/mehmonga `hidden = true` slaydlar umuman qaytmaydi, `note = null`, `slide_count` esa ko'rinadiganlar soni.
- Staff va o'qituvchi uchun `note` to'la keladi. Staff `hidden` slaydlarni ham oladi (admin muharriri shu endpoint'dan o'qiydi).
- `404 not_found`: taqdimot yo'q yoki hali konvertatsiya qilinmoqda.

### `POST /api/v1/admin/topics/{topic_id}/presentation/`

Staff, `multipart/form-data`, maydon `file`.

- Faqat `.pptx` va `.pdf` qabul qilinadi; MIME va magic bytes tekshirilsin. Hajm 25 MB gacha.
- Javob: `202 { "id": "uuid", "status": "processing" }`.
- Xatolar:
  - `400 { code: "invalid_file" }`
  - `413 { code: "file_too_large" }`
  - `409 { code: "conversion_in_progress" }` — shu mavzuda konvertatsiya ketayotgan bo'lsa.
- Yangi fayl tayyor bo'lgach eski slaydlar almashtiriladi. Eslatmalar va tartib yangidan boshlanadi. Konvertatsiya muvaffaqiyatsiz tugasa, eski taqdimot o'zgarmay qoladi.

> **Muhim (Vercel):** Vercel serverless funksiyasining so'rov tanasi chegarasi ~4.5 MB. BFF (`/api/backend/...`) 25 MB ga ruxsat beradi (`request-guards.ts` → `MAX_PRESENTATION_BODY_BYTES`), lekin production'da 4.5 MB dan katta fayl Vercel'da to'xtaydi. Shuning uchun production uchun **presigned upload** tavsiya etiladi. Bu PDF kitoblardagi `direct` rejim bilan bir xil:
>
> 1. `POST …/presentation/upload/` → `{ upload_url, key }`
> 2. Brauzer faylni to'g'ridan-to'g'ri R2/S3 ga yuklaydi.
> 3. `POST …/presentation/` `{ "key": "…" }` → `202`.
>
> Frontend'da faqat `HttpTopicMaterialsApi.uploadPresentation` o'zgaradi. Hozirgi multipart varianti dev va kichik fayllar uchun.

### `GET /api/v1/admin/topics/{topic_id}/presentation/status/`

Staff. Javob: `{ "status": "processing" | "ready" | "failed", "progress": 0..100, "error"?: "kod" }`.

- Frontend `processing` paytida har **2 s** so'raydi.
- `ready` → `GET …/presentation/` qayta o'qiladi. `failed` → «Faylni slaydlarga aylantirib bo'lmadi».
- Konvertatsiya hech qachon bo'lmagan bo'lsa `404`.

### `PATCH /api/v1/admin/presentations/{presentation_id}/slides/`

Staff. Tana — **barcha** slaydlar, yangi tartibda:

```json
[
  { "id": "uuid", "order": 1, "hidden": false, "note": "", "alt": "..." },
  {
    "id": "uuid",
    "order": 2,
    "hidden": true,
    "note": "Savol bering",
    "alt": "..."
  }
]
```

- `order` — 1..N, takrorlanmaydi. `note` bo'sh satr bo'lsa `null` ga aylanadi. `alt` ≤ 200, `note` ≤ 1000.
- Ro'yxatda taqdimotning hamma slaydlari aynan bir martadan bo'lishi kerak. Aks holda `400 validation_error`.
- Javob: `200` + yangilangan `Presentation` (staff ko'rinishi).

### Backend tavsiyasi: konvertatsiya

Celery vazifasi (`CELERY_TASK_ALWAYS_EAGER` testlarda) quyidagilarni bajaradi:

1. **PPTX → PDF:** `soffice --headless --convert-to pdf` (LibreOffice). Har vazifa uchun alohida `-env:UserInstallation=file:///tmp/lo-<uuid>` bering, aks holda parallel ishlar bir-biriga to'sqinlik qiladi. Timeout ~120 s. Yuklangan fayl PDF bo'lsa, bu qadam o'tkazib yuboriladi.
2. **PDF → rasmlar:** `pdftoppm` yoki PyMuPDF bilan har bet 1920×1080 ga sig'adigan qilib chiziladi.
   - Asosiy rasm: `webp`, sifat ~82.
   - Eskiz: 480px eni.
   - Joylash: public storage, masalan `presentations/<id>/<n>.webp` va `<n>-480.webp`.
3. **`pdf_url`:** ixtiyoriy, olingan PDF saqlanadi.
4. **Progress:** `progress` bosqichma-bosqich yangilanadi: konvertatsiya 0–30, rasmlar 30–100 (betlar bo'yicha). Saqlash joyi `Presentation.conversion_progress` yoki Redis.
5. **Sukut qiymatlari:** `alt` — PPTX slayd sarlavhasi (python-pptx orqali) yoki `"{n}-slayd"`. `hidden = false`, `note` — PPTX «speaker notes» dan (bo'lsa).
6. **Xavfsizlik:** makroslar o'chiq, tashqi havolalar yuklanmaydi. LibreOffice alohida konteynerda/foydalanuvchida, tarmoqsiz ishlasin.

---

## Mundarija: `anchors` (ixtiyoriy)

O'qish oynasidagi mundarija joriy bo'lim ichidagi mashq/masala boshlanishlarini ko'rsata oladi. Buning uchun ochiq kitob javobidagi `chapters[]` va `children[]` ga ixtiyoriy maydon qo'shiladi:

```json
"anchors": [
  { "kind": "exercise", "title": "Mashqlar", "page": 78 },
  { "kind": "problem", "title": "12-masala", "page": 79 }
]
```

`kind` qiymati `exercise` yoki `problem` bo'ladi. Maydon yo'q yoki `null` bo'lsa, hech narsa chiqmaydi. Frontend tayyor (`lib/pdf/toc.ts` → `TocAnchor`).

## Frontend tomoni (ma'lumot uchun)

- API qatlami: `frontend/src/lib/topic-materials/api.ts`. U `TopicMaterialsApi` interfeysi va `HttpTopicMaterialsApi` dan iborat. `HttpTopicMaterialsApi` `openapi-fetch` klienti bilan bir xil `fetch` ishlatadi (timeout, `X-Request-ID`, BFF).
- `NEXT_PUBLIC_TOPIC_MATERIALS_API=http` bo'lsa backend ishlatiladi. Aks holda (standart) `src/mocks/topic-materials.ts` dagi xotiradagi mock ishlaydi: namunaviy xulosa, 8 slayd, yuklash/konvertatsiya simulyatsiyasi (nomida «xato» bo'lgan fayl → `failed`).
- So'rovlar `topicQueries` (`lib/topic-materials/queries.ts`) orqali ketadi. Sof mantiq: `blocks.ts`, `slides.ts`. Validatsiya: `lib/validation/topic-materials.ts`.
- «Konspekt» (o'qish oynasida belgilangan matn) hozircha faqat brauzerda saqlanadi (`stores/topic-notes.store.ts`). Akkauntga sinxronlash uchun keyingi versiyada `/api/v1/me/notes/` kerak bo'ladi.

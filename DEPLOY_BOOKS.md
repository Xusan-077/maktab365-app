# Kitoblar bo'limini deploy qilish (Railway + Vercel + R2)

Umumiy deploy qoidalari: [`DEPLOY.md`](DEPLOY.md). Bu fayl faqat **Kitoblar** (`apps/books`, `/kitoblar`,
`/admin/kutubxona`) uchun: nimani qayerga qo'yish kerak va nima uchun.

## Asosiy qoida: backend va worker — ikki alohida xizmat

Railway'da `backend` (gunicorn) va `worker` (Celery) alohida konteyner: **disk umumiy emas**.
Admin PDF'ni backend orqali (yoki brauzerdan to'g'ridan-to'g'ri R2'ga) yuklaydi, sahifalarni esa
**worker** rasmga aylantiradi. Shuning uchun:

- ikkalasida **bir xil** R2/S3 env bo'lishi shart (bo'lmasa worker yuklangan PDF'ni topa olmaydi);
- ikkalasi **bir xil Redis** (broker) ga ulanishi shart (bo'lmasa vazifa hech kimga yetmaydi —
  kitob "Tayyorlanmoqda, 0 / N bet" da turib qoladi);
- ikkalasi **bir xil commit**dan deploy qilinadi (worker eski kodda bo'lsa `process_book` vazifasini bilmaydi).

Lokal (`DEBUG`) — `AWS_STORAGE_BUCKET_NAME` bo'sh: fayllar `backend/media/` da, Celery eager rejimida
(`CELERY_TASK_ALWAYS_EAGER=true`) yoki docker-compose worker'i bilan ishlaydi. Production kodida o'zgarish
shart emas: saqlash faqat env orqali tanlanadi (`config/settings/base.py`).

## Xizmatlar

| Xizmat (platforma)          | Nima ishlatadi                                | Start command                                                              |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `backend` (Railway)         | `backend/railway.json`                        | Dockerfile `CMD` (gunicorn). Pre-deploy: `scripts/predeploy.sh` (migrate)  |
| `worker` (Railway)          | `backend/railway.worker.json`                 | `celery -A config worker -l info --concurrency=2 --max-tasks-per-child=50` |
| `frontend` (Vercel)         | Root Directory = `frontend`                   | `vercel-build` (backend tayyor bo'lguncha kutadi)                          |
| PostgreSQL, Redis (Railway) | backend va worker **bir xil** reference       | —                                                                          |
| R2: `PDF` bucket            | **private** — manba PDF'lar (`book-sources/`) | —                                                                          |
| R2: `covers` bucket         | **public** + domen — sahifa rasmlari, muqova  | —                                                                          |

Ikkala Railway xizmatida Root Directory = `backend`. Worker xizmatining config fayli:
Settings → Config as code → `backend/railway.worker.json`.

`--concurrency=2`: sukut bo'yicha Celery CPU yadrolari sonicha jarayon ochadi (katta mashinada o'nlab), har biri
Django yuklaydi — xotira tugab worker o'ldiriladi va kitob qotib qoladi. Bitta kitob bitta jarayonda ishlanadi, shuning
uchun 2 yetarli. Katta (skaner) kitoblar uchun xotira: kamida ~1 GB (Railway'da worker xizmati xotirasini shunga qarab oshiring).

## Env o'zgaruvchilari

### Ikkala xizmatda (backend **va** worker) bir xil

| O'zgaruvchi                                        | Qiymat / izoh                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DJANGO_SETTINGS_MODULE`                           | `config.settings.prod`. **Worker'da ham qo'ying**: `config/celery.py` bo'lmasa `dev` sozlamani oladi. |
| `SECRET_KEY`                                       | Bir xil.                                                                                              |
| `DATABASE_URL`                                     | Bir xil PostgreSQL.                                                                                   |
| `REDIS_URL` (yoki `CELERY_BROKER_URL`)             | Bir xil Redis. Vazifalar shu orqali backend → worker ga o'tadi.                                       |
| `AWS_STORAGE_BUCKET_NAME`                          | **PDF** bucket (private). Bo'sh bo'lsa lokal disk — productionda **bo'sh bo'lmasligi shart**.         |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`       | R2 API token (PDF bucket: o'qish + yozish).                                                           |
| `AWS_S3_ENDPOINT_URL`                              | R2: `https://<account_id>.r2.cloudflarestorage.com`                                                   |
| `AWS_S3_REGION_NAME`                               | R2: `auto`                                                                                            |
| `AWS_S3_SIGNATURE_VERSION`                         | `s3v4` (sukut).                                                                                       |
| `COVERS_BUCKET_NAME`                               | **Ommaviy** bucket: muqova va **kitob sahifalarining rasmlari** shu yerga tushadi.                    |
| `COVERS_S3_CUSTOM_DOMAIN`                          | Ommaviy bucket domeni (masalan `cdn.darslik365.uz`). Rasm URL'lari shundan quriladi.                  |
| `COVERS_ACCESS_KEY_ID`, `COVERS_SECRET_ACCESS_KEY` | Faqat `covers` bucket'iga ruxsatli token.                                                             |
| `COVERS_S3_ENDPOINT_URL`                           | Ixtiyoriy; bo'sh bo'lsa `AWS_S3_ENDPOINT_URL`.                                                        |
| `SENTRY_DSN`                                       | Ixtiyoriy.                                                                                            |

`COVERS_*` bo'sh bo'lsa sahifa rasmlari **PDF (private) bucket**ga yoziladi va saytda ochilmaydi (403).

### Faqat backend (web) xizmatida

`ALLOWED_HOSTS`, `FRONTEND_ORIGINS`, `FRONTEND_URL`, `CSRF_TRUSTED_ORIGINS`, `FORWARDED_IP_SECRET`
(= frontend `BACKEND_FORWARD_SECRET`), `ADMIN_EMAIL` / `ADMIN_PASSWORD`, auth/Telegram o'zgaruvchilari —
qarang `backend/.env.example` va `DEPLOY.md`. Worker'ga kerak emas.

### Ixtiyoriy (kitoblar)

| O'zgaruvchi                  | Sukut   | Izoh                                      |
| ---------------------------- | ------- | ----------------------------------------- |
| `ADMIN_UPLOAD_MAX_PDF_BYTES` | 50 MB   | Backend orqali (proxy) yuklashda chegara. |
| `PDF_BOOK_MAX_BYTES`         | cheksiz | Ilova darajasidagi PDF hajmi chegarasi.   |
| `PDF_UPLOAD_PART_BYTES`      | 8 MiB   | Multipart bo'lak hajmi (R2 kamida 5 MiB). |
| `PDF_SIGNED_URL_SECONDS`     | 900     | Imzolangan URL muddati.                   |

### R2 bucket sozlamasi

- **PDF bucket**: brauzer katta PDF'ni R2'ga to'g'ridan-to'g'ri bo'laklab yuklaydi → bucket CORS'ida sayt
  origin'lari uchun `PUT`, `GET`, `HEAD` ruxsat, `ETag` header `ExposeHeaders` da bo'lsin (aks holda multipart
  yakunlanmaydi).
- **covers bucket**: ommaviy domen ulangan (Cloudflare → R2 → Custom Domain). Sahifa rasmlari
  `book-pages/<kitob>/…webp` kalitlari bilan, yozilgandan keyin o'zgarmaydi (uzoq kesh xavfsiz).

## Worker: vazifa ro'yxatga olinishini tekshirish

Worker ishga tushganda jurnalda `worker_setup` qatori chiqadi (`config/celery.py`):

```
worker_setup default_storage=S3Storage covers_storage=S3Storage broker=redis://… tasks=[…, "apps.books.tasks.process_book", …]
```

Tekshiring:

- `default_storage=S3Storage` va `covers_storage=S3Storage` — aks holda `worker_local_storage` xatosi chiqadi
  (R2 env worker'da yo'q).
- `tasks` ro'yxatida `apps.books.tasks.process_book` bor — yo'q bo'lsa `worker_task_missing` xatosi: worker eski kodda,
  qayta deploy qiling (Deployments → Redeploy, **cache'siz**: `pypdfium2` yangi bog'liqlik).
- Qo'lda: worker xizmati shell'ida `celery -A config inspect registered`.

## Deploy tartibi

Migratsiyalar (barchasi faqat **qo'shadi** — eski kod bilan mos, `DEPLOY.md` expand/contract qoidasi):

| Ilova      | Migratsiya                                            |
| ---------- | ----------------------------------------------------- |
| `accounts` | `0008_auth_phone`                                     |
| `quizzes`  | `0003_attempt_client_id`                              |
| `books`    | `0001_books_initial`, `0002_books_progress_bookmarks` |

Ularni alohida ishga tushirish shart emas: backend'ning Railway pre-deploy'i (`scripts/predeploy.sh`) o'zi
`migrate --noinput` qiladi; xato bo'lsa deploy to'xtaydi va eski versiya ishlashda qoladi.

1. **Env**: yuqoridagi jadval bo'yicha `backend` va `worker` xizmatlarida o'zgaruvchilarni tekshiring
   (ayniqsa worker'da `AWS_*`, `COVERS_*`, `REDIS_URL`, `DJANGO_SETTINGS_MODULE`).
2. **PR → `main`**: CI yashil bo'lsin (ruff, pytest, `makemigrations --check`, openapi, frontend).
3. **Backend** deploy (Railway avtomatik): pre-deploy migratsiyalar → health-check `/api/v1/health/`
   (`api_revision` = 3).
4. **Worker** deploy (bir vaqtda, shu commit): jurnalda `worker_setup` qatorini tekshiring.
5. **Frontend** (Vercel): production build backend `api_revision >= 3` bo'lguncha kutadi
   (`frontend/backend-revision.json`) — shuning uchun frontend backend'dan oldin chiqmaydi.
6. **Tekshiruv** (pastda).

## Deploydan keyingi tekshiruv

1. `/uz/admin/kutubxona` → "Kitob qo'shish" → kichik (5–10 betlik) PDF yuklang. Holat tez orada **Tayyor** bo'ladi
   (bet soni ko'rinib boradi: `3 / 10 bet`).
2. "Nashr qilish" → `/uz/kitoblar` da kitob va muqovasi ko'rinadi; "O'qish" sahifasida bet rasmlari ochiladi.
3. Katta kitob: taxminiy vaqt — matnli PDF ~0,3 s/bet, skaner ~1–2 s/bet (350 bet ≈ 2–12 daqiqa).
   Bitta vazifa uchun chegara 40 daqiqa (`apps/books/tasks.py`).

## Qotib qolgan kitoblarni tiklash

Belgilar: kitob "Tayyorlanmoqda" holatida `0 / N bet` da turibdi; worker jurnalida `process_book` yo'q.

1. Sababni tuzating (worker env / kod / Redis — yuqoriga qarang).
2. Admin sahifada kitobni oching → **Qayta tayyorlash** (progress 3 daqiqa o'zgarmagan bo'lsa ruxsat etiladi), yoki
   backend xizmati shell'ida:

```
python manage.py reprocess_books --dry-run     # qaysilari topiladi
python manage.py reprocess_books               # qotganlar (3 daqiqadan beri progress yo'q)
python manage.py reprocess_books --all-processing  # barcha "tayyorlanmoqda"
python manage.py reprocess_books --failed      # xatoga tushganlar ham
```

PDF qayta yuklash shart emas: manba fayl R2'da saqlanadi.

## Muammolar

| Belgi                                        | Ehtimoliy sabab                                  | Yechim                                                     |
| -------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `0 / N bet` da turibdi, jurnalda hech narsa  | Worker ishlamayapti yoki boshqa Redis'ga ulangan | Worker xizmati va `REDIS_URL` ni tekshiring                |
| `worker_task_missing`                        | Worker eski kod / `pypdfium2` o'rnatilmagan      | Worker'ni shu commit'dan, cache'siz qayta deploy qiling    |
| `worker_local_storage`, yoki kitob `Xato`    | Worker'da `AWS_*` env yo'q                       | R2 env'ni worker'ga ham qo'ying                            |
| Kitob `Tayyor`, lekin sahifa rasmi 403       | `COVERS_*` env yo'q — rasmlar private bucket'da  | `COVERS_BUCKET_NAME` va `COVERS_S3_CUSTOM_DOMAIN`          |
| Worker vaqti-vaqti bilan qayta ishga tushadi | Xotira tugayapti (OOM)                           | `--concurrency=2`, worker xotirasini oshiring              |
| `Xato: timeout`                              | Kitob 40 daqiqadan uzoq ishlandi                 | "Qayta tayyorlash"; juda katta bo'lsa PDF'ni kichraytiring |
| Brauzerda PDF yuklash to'xtaydi (R2)         | Bucket CORS'ida `PUT` / `ETag` yo'q              | R2 CORS'ni yuqoridagicha sozlang                           |

# Backend o'zgarishlari (auth, Telegram telefon bilan kirish)

Backend shu monorepoda, shuning uchun o'zgarishlar allaqachon kiritilgan; bu fayl deploy uchun xulosa.

## Telefon bilan kirish (SMS'siz, Telegram bot orqali)

- `POST /api/v1/auth/telegram/start/` — ixtiyoriy body `{ "with_phone": true }`. `true` bo'lsa bot `/start <token>` dan keyin
  `request_contact` tugmasini yuboradi va kirish raqam kelgunga qadar `pending` turadi.
- Bot kontakt xabarini qabul qiladi (`telegram_login.handle_update`):
  - `contact.user_id != message.from.id` → rad etiladi (boshqa odamning raqami);
  - raqam `+998XXXXXXXXX` ga normalizatsiya qilinadi (`normalize_phone`), boshqa davlat raqami rad etiladi;
  - kutilayotgan kirish yo'q/eskirgan bo'lsa → "Kutilayotgan kirish topilmadi".
- `complete/` — yangi telegram identity shu raqamli mavjud profilga bog'lanadi (`social_services.sign_in`), aks holda yangi user
  yaratiladi; raqam `Profile.phone` ga yoziladi (band bo'lsa jim o'tkazib yuboriladi).
- Status API'da `awaiting_phone` ko'rinmaydi (`pending`), shuning uchun frontend polling o'zgarmagan.
- Migratsiya: `accounts/0008_auth_phone` (`Profile.phone`, `auth_profile_phone_unique` — bo'sh bo'lmagan qiymatlar uchun unique).
- Telegram webhook yangi sozlama talab qilmaydi (kontakt `message` update'i sifatida keladi).

## Frontend bilan bog'liq

- Yoqish: frontend env `NEXT_PUBLIC_TELEGRAM_REQUIRE_PHONE=1` (default o'chiq).
- `backend/openapi.yaml` va `frontend/src/lib/api/schema.ts` qayta generatsiya qilingan.

## Ma'lum masala (bu ish bilan bog'liq emas)

- `apps/accounts/tests/test_env_admin.py::TestAdminCannotUseLearnerApi::test_admin_gets_403_on_learner_endpoints` ishlamaydi:
  `backend/CLAUDE.md` ga ko'ra o'qish API'lari admin uchun ochiq, test esa 403 kutadi (eskirgan test).

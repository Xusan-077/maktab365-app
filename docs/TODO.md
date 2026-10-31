# TODO

## Backend: ma'lum yiqilayotgan testlar (hozircha tegilmaydi)

Ikkalasi `feat(games)` dan oldin ham (toza HEAD'da) yiqilgan — yangi o'zgarishlar sababi emas.

- `apps/accounts/tests/test_env_admin.py::TestAdminCannotUseLearnerApi::test_admin_gets_403_on_learner_endpoints` —
  test admin'ga o'quvchi endpoint'larida 403 kutadi, joriy `IsLearner` siyosati esa boshqacha ishlaydi.
  Qaysi biri to'g'ri ekanini hal qilib, test yoki siyosatni moslash kerak.
- `apps/support/tests/test_support.py::test_meaningless_message_is_rejected[Dnxdnxdnxdnx]` —
  ma'nosiz xabar filtri bu namunani o'tkazib yuboradi. Evristikani kuchaytirish yoki namunani qayta ko'rib chiqish kerak.

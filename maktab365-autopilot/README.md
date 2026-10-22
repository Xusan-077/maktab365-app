# maktab365 autopilot

Monorepo promptlarini (M0–M15) Claude Code'ga ketma-ket o'zi bajartiradi.

## Tayyorlash
1. Repoda kamida 1 ta commit bo'lsin, `git status` toza, alohida branch: `git checkout -b autopilot`.
2. Bu papkani repodan TASHQARIDA saqlang (M0 repo ichidagi fayllarni ko'chiradi).
3. `claude` buyrug'i ishlaydi va login qilingan bo'lsin. Docker, Node, uv o'rnatilgan bo'lsin.

## Ishga tushirish
    REPO=~/maktab365 ./run.sh 0 1     # avval M0 va M1 ni sinab ko'ring
    REPO=~/maktab365 ./run.sh 2 6     # keyin davom
    REPO=~/maktab365 ./run.sh 7       # M7 dan oxirigacha

Har qadam: toza kontekstda Claude → `make test` (M0 da frontend build) → yiqilsa 2 marta o'zi tuzatadi → commit + `done-Mxx` tegi. Gate o'tmasa to'xtaydi (logs/ papkasida to'liq log).

## Xavfsizlik
- Skript `Bash Edit Write Read Glob Grep` ruxsatlari bilan ishlaydi: Claude buyruq bajaradi. Ishonchli bo'lmagan hech narsa yo'q, lekin baribir alohida branch va (iloji bo'lsa) konteyner/cloud sessiyada ishlating.
- Har M tugagach `git diff done-M(n-1)..done-Mn` bilan ko'rib chiqing. Ayniqsa M3, M4 (auth) va M8 (merge) ni diqqat bilan.
- Sirlar (Google/Telegram/Azure kalitlari) .env.local da bo'lsin, repoga tushmasin.
- Yuqori narx: har qadam uzoq sessiya. RETRIES=1 MAX_TURNS=150 bilan kamaytirish mumkin.

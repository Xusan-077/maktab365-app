"""Yordam xabari sifati: juda qisqa yoki ma'nosiz matn ("Dnxdnxdnxdnx") yuborilmaydi.

Qoidalar frontend (`lib/validation/support-quality.ts`) bilan bir xil; umumiy kontrakt
`contracts/fixtures/support-message-quality.json` ikki tomonda tekshiriladi. Spam (havolalar,
reklama) — alohida (`spam.py`): u saqlanadi, lekin xodimga yuborilmaydi; bu esa 400 bilan rad etadi.
"""

import re

MIN_MESSAGE_LENGTH = 15
# Kamida shuncha so'z (2+ harf): bitta uzun "so'z" — odatda klaviatura bosish.
MIN_WORDS = 2
# Harflar bo'shliqsiz belgilarning kamida shu qismi (raqam/tinish belgilari to'plami emas).
MIN_LETTER_SHARE = 0.5
# Unli harflar ulushi: o'zbek, rus va ingliz matnida doim yuqori ("qwrtpsdfgh" — yo'q).
MIN_VOWEL_SHARE = 0.2
# Bir xil qisqa bo'lak takrori ("dnx" × 4, "asd" × 6).
MAX_REPEAT_UNIT = 4
MIN_REPEATS = 3
# 20+ harfli "so'z" — odatda bo'shliqsiz yozilgan gap yoki tasodifiy belgilar.
MAX_WORD_LENGTH = 20

VOWELS = set("aeiouyаеёиоуыэюяўі")
LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)
WORD_RE = re.compile(r"[^\W\d_]{2,}", re.UNICODE)


def _repeats_unit(letters: str) -> bool:
    for size in range(1, MAX_REPEAT_UNIT + 1):
        unit = letters[:size]
        times = len(letters) // size
        if times >= MIN_REPEATS and (unit * (times + 1))[: len(letters)] == letters:
            return True
    return False


def is_meaningless(text: str) -> bool:
    """Ma'nosiz xabar: harf/so'z/unli ulushi juda kam, qisqa bo'lak takrori yoki bitta so'z."""
    lowered = text.strip().lower()
    compact = re.sub(r"\s+", "", lowered)
    letters = "".join(LETTER_RE.findall(lowered))
    if not compact or len(letters) / len(compact) < MIN_LETTER_SHARE:
        return True
    words = WORD_RE.findall(lowered)
    if len(words) < MIN_WORDS or len(set(words)) == 1:
        return True
    if any(len(word) >= MAX_WORD_LENGTH for word in words):
        return True
    vowels = sum(1 for ch in letters if ch in VOWELS)
    if vowels / len(letters) < MIN_VOWEL_SHARE:
        return True
    return _repeats_unit(letters)

"""
Kirill → lotin transliteratsiyasi (o'zbek, rus harflari) va qidiruv uchun matnni normallashtirish.

Frontend `src/lib/i18n/translit.ts` (`cyrillicToLatin`, `normalizeSearchText`) bilan bir xil natija
berishi shart: ikkala tomon `contracts/fixtures/translit.json` vektorlari bilan tekshiriladi.
"""

import re

_PLAIN = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "ж": "j",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "x",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ъ": "'",
    "ь": "",
    "ы": "i",
    "э": "e",
    "ю": "yu",
    "я": "ya",
    "ё": "yo",
    "ў": "o'",
    "ғ": "g'",
    "қ": "q",
    "ҳ": "h",
}

_CYRILLIC = re.compile(r"[а-яёўғқҳ]", re.IGNORECASE)
_APOSTROPHES = "'ʻʼ‘’`´"
_APOSTROPHE_RE = re.compile(f"[{_APOSTROPHES}]")
_WORD_CHAR = re.compile(r"[а-яёўғқҳa-z0-9]", re.IGNORECASE)


def _is_word_char(char: str | None) -> bool:
    return bool(char) and bool(_WORD_CHAR.match(char))


def cyrillic_to_latin(text: str) -> str:
    """Kirill harflarni lotinga o'giradi; boshqa belgilar o'zgarmaydi. Bosh harf registri saqlanadi.

    So'z boshidagi `е` → `ye` (Европа → Yevropa), boshqa joyda `e`.
    """
    out: list[str] = []
    for index, char in enumerate(text):
        lower = char.lower()
        if lower == "е":
            latin = "e" if _is_word_char(text[index - 1] if index else None) else "ye"
        elif _CYRILLIC.match(char):
            latin = _PLAIN[lower]
        else:
            out.append(char)
            continue
        out.append(latin.capitalize() if char != lower and latin else latin)
    return "".join(out)


def normalize_search_text(text: str) -> str:
    """Qidiruv uchun: kichik harf, kirill → lotin, tutuq belgilari olib tashlanadi."""
    return _APOSTROPHE_RE.sub("", cyrillic_to_latin(text.lower()))

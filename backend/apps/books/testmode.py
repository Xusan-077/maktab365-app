"""Test kitoblar rejimi: javoblar kaliti, ommaviy kiritish va tekshirish.

Kalit (`AnswerKeyItem.answer`) faqat shu modulda va admin API'sida o'qiladi. Foydalanuvchiga
faqat savollar ro'yxati (bet + raqam + tur) va tekshirishdan keyin har savol uchun
to'g'ri/xato yuboriladi; to'g'ri javobning o'zi hech qaysi javobda yo'q.
"""

import re
from dataclasses import dataclass

from django.db import transaction

from .models import AnswerAttempt, AnswerKeyItem, Book, SheetAnswer

ANSWER_MAX = 120
QUESTION_MAX = 999
MAX_KEY_ROWS = 5000
CHOICE_RE = re.compile(r"^[a-e]$")

# Kirill harflari lotin variantlari bilan bir xil ko'rinadi: javob varag'ida adashmaslik uchun.
_LOOKALIKES = str.maketrans({"а": "a", "в": "b", "с": "c", "е": "e"})
_LINE_RE = re.compile(r"^\s*(\d+)\s*[,;\t ]\s*(\d+)\s*[,;\t ]\s*(.+?)\s*$")


def normalize(answer: str) -> str:
    """Taqqoslash uchun shakl: bo'shliqsiz, kichik harf, kirill→lotin (A–E), o'nlik vergul→nuqta."""
    text = re.sub(r"\s+", "", answer or "").casefold()
    if len(text) == 1:
        text = text.translate(_LOOKALIKES)
    if re.fullmatch(r"[+-]?\d+,\d+", text):
        text = text.replace(",", ".")
    return text


def kind_of(answer: str) -> str:
    """`choice` (A–E variant) yoki `text` — kalitning o'zini oshkor qilmasdan tur."""
    return "choice" if CHOICE_RE.match(normalize(answer)) else "text"


def display_answer(answer: str) -> str:
    """Saqlash shakli: variant harfi katta (A–E), qolgani tozalangan matn."""
    text = re.sub(r"\s+", " ", (answer or "").strip())
    return normalize(text).upper() if kind_of(text) == "choice" else text


@dataclass(frozen=True)
class KeyRow:
    page: int
    question: int
    answer: str


@dataclass(frozen=True)
class LineError:
    line: int
    code: str


def validate_row(page: int, question: int, answer: str, page_count: int) -> str | None:
    if page < 1 or (page_count and page > page_count):
        return "page_out_of_range"
    if question < 1 or question > QUESTION_MAX:
        return "question_out_of_range"
    if not answer.strip():
        return "answer_empty"
    if len(answer.strip()) > ANSWER_MAX:
        return "answer_too_long"
    return None


def parse_key_text(text: str, page_count: int) -> tuple[list[KeyRow], list[LineError]]:
    """Ommaviy kiritish: har qator `bet, savol, javob` (vergul/nuqta-vergul/tab/bo'shliq).

    Boshidagi sarlavha qatori (raqam bilan boshlanmaydigan) va bo'sh/`#` qatorlari o'tkaziladi.
    """
    rows: list[KeyRow] = []
    errors: list[LineError] = []
    seen: set[tuple[int, int]] = set()
    for number, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = _LINE_RE.match(line)
        if match is None:
            if number == 1 and not line[0].isdigit():
                continue  # sarlavha: "bet,savol,javob"
            errors.append(LineError(number, "invalid_line"))
            continue
        page, question, answer = int(match[1]), int(match[2]), match[3]
        code = validate_row(page, question, answer, page_count)
        if code is None and (page, question) in seen:
            code = "duplicate"
        if code:
            errors.append(LineError(number, code))
            continue
        seen.add((page, question))
        rows.append(KeyRow(page, question, display_answer(answer)))
    if len(rows) > MAX_KEY_ROWS:
        errors.append(LineError(0, "too_many_rows"))
    return rows, errors


def save_key(book: Book, rows: list[KeyRow], *, replace: bool) -> int:
    """Kalitni yozadi: `replace` — avvalgisini almashtiradi, aks holda qo'shadi/yangilaydi."""
    with transaction.atomic():
        if replace:
            AnswerKeyItem.objects.filter(book=book).delete()
        existing = {
            (item.page, item.question): item for item in AnswerKeyItem.objects.filter(book=book)
        }
        create, change = [], []
        for row in rows:
            item = existing.get((row.page, row.question))
            if item is None:
                create.append(
                    AnswerKeyItem(
                        book=book, page=row.page, question=row.question, answer=row.answer
                    )
                )
            elif item.answer != row.answer:
                item.answer = row.answer
                change.append(item)
        AnswerKeyItem.objects.bulk_create(create)
        AnswerKeyItem.objects.bulk_update(change, ["answer"])
        # Kalit o'zgargach eski javoblar noma'lum savolga tegishli bo'lib qolmasin.
        valid = set(AnswerKeyItem.objects.filter(book=book).values_list("page", "question"))
        for sheet in SheetAnswer.objects.filter(book=book).only("id", "page", "question"):
            if (sheet.page, sheet.question) not in valid:
                sheet.delete()
    return len(rows)


def questions(book: Book) -> list[dict]:
    """Foydalanuvchiga ko'rinadigan savollar: bet, raqam, tur (kalitning o'zi YO'Q)."""
    return [
        {"page": item.page, "question": item.question, "kind": kind_of(item.answer)}
        for item in AnswerKeyItem.objects.filter(book=book)
    ]


def choice_count(book: Book) -> int:
    """Variantlar soni: kalitda E bor bo'lsa 5, aks holda 4."""
    answers = AnswerKeyItem.objects.filter(book=book).values_list("answer", flat=True)
    letters = {normalize(a) for a in answers}
    return 5 if "e" in letters else 4


def grade(book: Book, user) -> AnswerAttempt | None:
    """Kalit bo'yicha ball: javobsiz savol xato hisoblanadi. Kalit bo'lmasa `None`."""
    key = list(AnswerKeyItem.objects.filter(book=book))
    if not key:
        return None
    given = {
        (row.page, row.question): row.answer
        for row in SheetAnswer.objects.filter(user=user, book=book)
    }
    results = []
    score = 0
    for item in key:
        answer = given.get((item.page, item.question))
        correct = answer is not None and normalize(answer) == normalize(item.answer)
        score += correct
        results.append(
            {"page": item.page, "question": item.question, "correct": correct, "given": answer}
        )
    return AnswerAttempt.objects.create(
        user=user, book=book, score=score, total=len(key), results=results
    )

"""5-bosqich: test kitob (kalit, tekshirish, urinishlar) va matematika kitob (misol yechimi)."""

import json

import pytest

from apps.books import testmode
from apps.books.models import AnswerAttempt, AnswerKeyItem, BookStatus, ReadingMode, SheetAnswer
from apps.content.tests.test_admin_api import client_as
from apps.learning.tests.conftest import client_for, make_user

from .test_books import ADMIN, make_book, ready_book

pytestmark = pytest.mark.django_db

ME = "/api/v1/me/books"
KEY = "1, 1, A\n1, 2, b\n2, 1, C\n2, 2, 12,5\n"


@pytest.fixture
def test_book_():
    return ready_book(reading_mode=ReadingMode.TEST)


@pytest.fixture
def editor():
    return client_as("editor")


@pytest.fixture
def me():
    return client_for(make_user("mode-a@example.com"))


@pytest.fixture
def other():
    return client_for(make_user("mode-b@example.com"))


def import_key(editor, book, text=KEY, mode="replace"):
    return editor.post(
        f"{ADMIN}/{book.pk}/answer-key/import/", {"text": text, "mode": mode}, format="json"
    )


def answer(client, book, page, question, value):
    return client.put(
        f"{ME}/{book.pk}/test/answer/",
        {"page": page, "question": question, "answer": value},
        format="json",
    )


class TestParser:
    def test_parses_separators_header_and_normalizes(self):
        rows, errors = testmode.parse_key_text(
            "bet,savol,javob\n1;1;a\n1\t2\tB\n# izoh\n\n2 1 12,5\n", page_count=2
        )
        assert errors == []
        assert [(r.page, r.question, r.answer) for r in rows] == [
            (1, 1, "A"),
            (1, 2, "B"),
            (2, 1, "12,5"),
        ]

    def test_reports_each_bad_line(self):
        _, errors = testmode.parse_key_text("1,1,A\n9,1,A\nxx\n1,1,B\n1,0,A\n", page_count=2)
        assert {(e.line, e.code) for e in errors} == {
            (2, "page_out_of_range"),
            (3, "invalid_line"),
            (4, "duplicate"),
            (5, "question_out_of_range"),
        }

    def test_normalize_handles_cyrillic_lookalikes_and_decimal_comma(self):
        assert testmode.normalize(" в ") == "b"
        assert testmode.normalize("12,5") == testmode.normalize("12.5")
        assert testmode.normalize("x 2") == "x2"
        assert testmode.kind_of("а") == "choice"
        assert testmode.kind_of("12") == "text"


class TestAdminKey:
    def test_import_and_list(self, editor, test_book_):
        response = import_key(editor, test_book_)
        assert response.status_code == 200
        assert response.json() == {"saved": 4, "total": 4}
        listing = editor.get(f"{ADMIN}/{test_book_.pk}/answer-key/").json()
        assert [(r["page"], r["question"], r["answer"]) for r in listing] == [
            (1, 1, "A"),
            (1, 2, "B"),
            (2, 1, "C"),
            (2, 2, "12,5"),
        ]

    def test_invalid_lines_block_whole_import(self, editor, test_book_):
        response = import_key(editor, test_book_, "1,1,A\n7,1,B\n")
        assert response.status_code == 400
        assert response.json()["details"]["text"] == ["2: page_out_of_range"]
        assert AnswerKeyItem.objects.count() == 0

    def test_merge_keeps_others_and_replace_drops_them(self, editor, test_book_):
        import_key(editor, test_book_)
        merged = import_key(editor, test_book_, "1,1,D\n", mode="merge").json()
        assert merged == {"saved": 1, "total": 4}
        assert AnswerKeyItem.objects.get(book=test_book_, page=1, question=1).answer == "D"
        replaced = import_key(editor, test_book_, "1,1,A\n").json()
        assert replaced == {"saved": 1, "total": 1}

    def test_only_test_books_have_a_key(self, editor):
        book = ready_book(reading_mode=ReadingMode.STANDARD)
        assert import_key(editor, book).status_code == 400

    def test_learners_and_guests_cannot_touch_the_key(self, me, anon, test_book_):
        assert anon.get(f"{ADMIN}/{test_book_.pk}/answer-key/").status_code in (401, 403)
        assert me.get(f"{ADMIN}/{test_book_.pk}/answer-key/").status_code == 403
        assert (
            me.post(f"{ADMIN}/{test_book_.pk}/answer-key/import/", {"text": "1,1,A"}).status_code
            == 403
        )

    def test_replace_prunes_answers_to_removed_questions(self, editor, me, test_book_):
        import_key(editor, test_book_)
        answer(me, test_book_, 2, 2, "12.5")
        import_key(editor, test_book_, "1,1,A\n")
        assert SheetAnswer.objects.count() == 0

    def test_clear_key(self, editor, test_book_):
        import_key(editor, test_book_)
        assert editor.delete(f"{ADMIN}/{test_book_.pk}/answer-key/").status_code == 204
        assert AnswerKeyItem.objects.count() == 0


class TestSheet:
    def test_sheet_never_contains_the_key(self, editor, me, test_book_):
        import_key(editor, test_book_)
        answer(me, test_book_, 1, 1, "a")
        response = me.get(f"{ME}/{test_book_.pk}/test/")
        assert response.status_code == 200
        body = response.json()
        assert body["choices"] == 4
        assert {(q["page"], q["question"], q["kind"]) for q in body["questions"]} == {
            (1, 1, "choice"),
            (1, 2, "choice"),
            (2, 1, "choice"),
            (2, 2, "text"),
        }
        assert body["answers"] == [{"page": 1, "question": 1, "answer": "A"}]
        assert "12,5" not in json.dumps(body)
        assert all(set(q) == {"page", "question", "kind"} for q in body["questions"])

    def test_answer_is_idempotent_and_blank_clears(self, editor, me, test_book_):
        import_key(editor, test_book_)
        answer(me, test_book_, 1, 1, "a")
        answer(me, test_book_, 1, 1, "b")
        assert SheetAnswer.objects.get().answer == "B"
        assert answer(me, test_book_, 1, 1, "  ").status_code == 200
        assert SheetAnswer.objects.count() == 0

    def test_unknown_question_is_rejected(self, editor, me, test_book_):
        import_key(editor, test_book_)
        response = answer(me, test_book_, 1, 9, "A")
        assert response.status_code == 400
        assert response.json()["details"]["question"] == ["unknown_question"]

    def test_answers_are_private(self, editor, me, other, test_book_):
        import_key(editor, test_book_)
        answer(me, test_book_, 1, 1, "A")
        assert other.get(f"{ME}/{test_book_.pk}/test/").json()["answers"] == []

    def test_mode_exists_only_for_test_books_and_visible_ones(self, me):
        textbook = ready_book(reading_mode=ReadingMode.STANDARD)
        assert me.get(f"{ME}/{textbook.pk}/test/").status_code == 404
        hidden = make_book(
            reading_mode=ReadingMode.TEST, status=BookStatus.READY, is_published=False
        )
        assert me.get(f"{ME}/{hidden.pk}/test/").status_code == 404

    def test_requires_login(self, anon, test_book_):
        assert anon.get(f"{ME}/{test_book_.pk}/test/").status_code in (401, 403)


class TestCheck:
    def test_scores_by_key_and_never_reveals_it(self, editor, me, test_book_):
        import_key(editor, test_book_)
        answer(me, test_book_, 1, 1, "a")  # to'g'ri
        answer(me, test_book_, 1, 2, "d")  # xato
        answer(me, test_book_, 2, 2, "12.5")  # to'g'ri (vergul/nuqta)
        # 2/1 javobsiz: xato
        response = me.post(f"{ME}/{test_book_.pk}/test/check/")
        assert response.status_code == 201
        body = response.json()
        assert (body["score"], body["total"]) == (2, 4)
        by_q = {(i["page"], i["question"]): i for i in body["items"]}
        assert by_q[(1, 1)]["correct"] is True
        assert by_q[(1, 2)] == {"page": 1, "question": 2, "correct": False, "given": "D"}
        assert by_q[(2, 1)] == {"page": 2, "question": 1, "correct": False, "given": None}
        assert by_q[(2, 2)]["correct"] is True
        assert all(set(i) == {"page", "question", "correct", "given"} for i in body["items"])
        # Xato javob uchun to'g'ri javob (B) hech qayerda yo'q.
        assert '"B"' not in json.dumps(body)

    def test_needs_key_and_answers(self, editor, me, test_book_):
        assert me.post(f"{ME}/{test_book_.pk}/test/check/").json()["details"]["detail"] == [
            "no_answer_key"
        ]
        import_key(editor, test_book_)
        assert me.post(f"{ME}/{test_book_.pk}/test/check/").json()["details"]["detail"] == [
            "no_answers"
        ]

    def test_attempt_snapshot_survives_key_change(self, editor, me, test_book_):
        import_key(editor, test_book_)
        answer(me, test_book_, 1, 1, "A")
        first = me.post(f"{ME}/{test_book_.pk}/test/check/").json()
        import_key(editor, test_book_, "1,1,B\n")  # kalit o'zgardi
        detail = me.get(f"{ME}/{test_book_.pk}/test/attempts/{first['id']}/").json()
        assert detail["score"] == first["score"] == 1
        assert detail["items"][0]["correct"] is True


class TestAttempts:
    def test_history_is_newest_first_and_private(self, editor, me, other, test_book_):
        import_key(editor, test_book_)
        answer(me, test_book_, 1, 1, "A")
        first = me.post(f"{ME}/{test_book_.pk}/test/check/").json()
        answer(me, test_book_, 1, 2, "B")
        second = me.post(f"{ME}/{test_book_.pk}/test/check/").json()
        history = me.get(f"{ME}/{test_book_.pk}/test/attempts/").json()
        assert [h["id"] for h in history] == [second["id"], first["id"]]
        assert [h["score"] for h in history] == [2, 1]
        assert set(history[0]) == {"id", "created_at", "score", "total"}
        assert other.get(f"{ME}/{test_book_.pk}/test/attempts/").json() == []
        assert other.get(f"{ME}/{test_book_.pk}/test/attempts/{first['id']}/").status_code == 404
        assert AnswerAttempt.objects.count() == 2


class TestSolutions:
    BODY = {"rect": {"x": 0.1, "y": 0.2, "w": 0.5, "h": 0.2}, "title": "12-misol", "body": "$x^2$"}

    def put(self, client, book, items):
        return client.put(
            f"{ME}/{book.pk}/pages/1/annotations/", {"annotations": items}, format="json"
        )

    def test_solution_only_in_math_books(self, me):
        math = ready_book(reading_mode=ReadingMode.MATH)
        ok = self.put(me, math, [{"type": "solution", "data": self.BODY}])
        assert ok.status_code == 200
        textbook = ready_book(reading_mode=ReadingMode.STANDARD)
        bad = self.put(me, textbook, [{"type": "solution", "data": self.BODY}])
        assert bad.status_code == 400

    def test_validation(self, me):
        math = ready_book(reading_mode=ReadingMode.MATH)
        for data in (
            {**self.BODY, "rect": {"x": 0.9, "y": 0.2, "w": 0.5, "h": 0.2}},
            {**self.BODY, "body": "x" * 4001},
            {**self.BODY, "title": "x" * 81},
            {"title": "yo'q"},
        ):
            response = self.put(me, math, [{"type": "solution", "data": data}])
            assert response.status_code == 400, data

    def test_listed_in_entries_and_searchable(self, me):
        math = ready_book(reading_mode=ReadingMode.MATH)
        self.put(me, math, [{"type": "solution", "data": self.BODY}])
        entries = me.get("/api/v1/me/annotations/?type=solution").json()
        flat = json.dumps(entries)
        assert "12-misol" in flat
        found = me.get("/api/v1/me/annotations/?q=misol").json()
        assert "12-misol" in json.dumps(found)

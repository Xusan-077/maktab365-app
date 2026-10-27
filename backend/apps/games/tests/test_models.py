import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.games.models import Option, option_set_errors

from .conftest import make_question

pytestmark = pytest.mark.django_db


def opts(*correct):
    return [{"is_correct": flag} for flag in correct]


@pytest.mark.parametrize(
    ("options", "errors"),
    [
        (opts(True, False, False, False), []),
        (opts(True, False, False), ["options_count"]),
        (opts(True, False, False, False, False), ["options_count"]),
        (opts(False, False, False, False), ["options_one_correct"]),
        (opts(True, True, False, False), ["options_one_correct"]),
    ],
)
def test_option_set_rule(options, errors):
    assert option_set_errors(options) == errors


def test_clean_accepts_valid_question(topics):
    question = make_question(topics.chapter())
    question.full_clean()


def test_clean_rejects_wrong_option_count(topics):
    question = make_question(topics.chapter())
    question.options.filter(order=3).delete()
    with pytest.raises(ValidationError) as exc:
        question.full_clean()
    assert exc.value.message_dict["options"] == ["options_count"]


def test_clean_rejects_no_correct(topics):
    question = make_question(topics.chapter())
    question.options.update(is_correct=False)
    with pytest.raises(ValidationError) as exc:
        question.full_clean()
    assert exc.value.message_dict["options"] == ["options_one_correct"]


def test_clean_requires_uz_text(topics):
    question = make_question(topics.chapter(), text={"ru": "Только русский"})
    with pytest.raises(ValidationError) as exc:
        question.full_clean()
    assert "text" in exc.value.message_dict


def test_db_forbids_two_correct_options(topics):
    question = make_question(topics.chapter())
    with pytest.raises(IntegrityError):
        Option.objects.filter(question=question, order=1).update(is_correct=True)


def test_db_forbids_fifth_option(topics):
    question = make_question(topics.chapter())
    with pytest.raises(IntegrityError):
        Option.objects.create(question=question, text={"uz": "E"}, order=4)

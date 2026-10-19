import pytest
from django.core.exceptions import ValidationError

from apps.core.fields import LocalizedTextField


def clean(value):
    return LocalizedTextField().clean(value, None)


def test_valid_values():
    assert clean({"uz": "Salom"}) == {"uz": "Salom"}
    assert clean({"uz": "Salom", "ru": "Привет", "en": "Hi"})["en"] == "Hi"


@pytest.mark.parametrize(
    "value",
    [{}, {"ru": "Привет"}, {"uz": "  "}, {"uz": "a", "de": "b"}, {"uz": 1}, ["uz"], "uz"],
)
def test_invalid_values(value):
    with pytest.raises(ValidationError):
        clean(value)

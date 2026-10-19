from django.core.exceptions import ValidationError
from django.db import models

LOCALES = ("uz", "ru", "en")
REQUIRED_LOCALE = "uz"


def validate_localized_text(value):
    """`{uz: str, ru?: str, en?: str}` — kalitlar faqat uz/ru/en, `uz` majburiy va bo'sh emas."""
    if not isinstance(value, dict):
        raise ValidationError("Lokalizatsiyalangan matn obyekt bo'lishi kerak.", code="invalid")
    unknown = sorted(set(value) - set(LOCALES))
    if unknown:
        raise ValidationError(
            "Noma'lum til kalitlari: %(keys)s.", code="unknown_locale", params={"keys": unknown}
        )
    for locale, text in value.items():
        if not isinstance(text, str):
            raise ValidationError(
                "'%(locale)s' qiymati matn bo'lishi kerak.",
                code="invalid",
                params={"locale": locale},
            )
    if not value.get(REQUIRED_LOCALE, "").strip():
        raise ValidationError("'uz' matni majburiy.", code="required")


class LocalizedTextField(models.JSONField):
    """Ko'p tilli matn (frontend `LocalizedText` tipiga mos)."""

    default_validators = [validate_localized_text]
    description = "Localized text (uz required, ru/en optional)"

    def __init__(self, *args, **kwargs):
        # blank=True bo'lsa ham `uz` majburiy — bo'sh maydon `{}` emas, `{"uz": ""}` ham emas.
        kwargs.setdefault("default", dict)
        super().__init__(*args, **kwargs)

    def validate(self, value, model_instance):
        # Bo'sh qiymat validatorlarni o'tkazib yuboradi, lekin `uz` har doim majburiy.
        super().validate(value, model_instance)
        validate_localized_text(value)

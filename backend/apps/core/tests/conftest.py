import pytest
from django.db import models

from apps.core.models import SoftDeleteModel, TimeStampedModel, UUIDModel


class Note(UUIDModel, TimeStampedModel, SoftDeleteModel):
    title = models.CharField(max_length=50)

    class Meta:
        app_label = "core"


@pytest.fixture
def note_table(db):
    # `core` ilovasida migratsiya yo'q, shuning uchun test DB'si jadvalni syncdb orqali yaratadi.
    return Note

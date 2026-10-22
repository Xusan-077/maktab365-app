from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel, UUIDModel


class PdfReadProgress(UUIDModel, TimeStampedModel):
    """PDF darslikda oxirgi ochilgan sahifa (foydalanuvchi + kitob uchun bitta yozuv)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pdf_progress"
    )
    pdf_book = models.ForeignKey("content.PdfBook", on_delete=models.CASCADE, related_name="+")
    last_page = models.PositiveIntegerField()
    # Faqat shu vaqtdan yangiroq mijoz yozuvi sahifani almashtiradi: kech kelgan eski yozuv
    # (boshqa qurilma, oflayn navbat) yangisini bosmaydi.
    client_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "pdf_book"], name="pdf_progress_once_per_book"),
            models.CheckConstraint(condition=Q(last_page__gte=1), name="pdf_progress_page_min_1"),
        ]
        indexes = [models.Index(fields=["user", "-updated_at"])]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}"


class PdfBookmark(UUIDModel):
    """Saqlangan PDF darslik (foydalanuvchi + kitob uchun bitta yozuv)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pdf_bookmarks"
    )
    pdf_book = models.ForeignKey("content.PdfBook", on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "pdf_book"], name="pdf_bookmark_once_per_book")
        ]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}"

from django.db import models


class BookDailyStat(models.Model):
    """Kitob bo'yicha kunlik sonlar: ochilish va yuklab olish. Faqat son, shaxsiy ma'lumotsiz."""

    book = models.ForeignKey(
        "content.PdfBook", on_delete=models.CASCADE, related_name="daily_stats"
    )
    day = models.DateField(db_index=True)
    opens = models.PositiveIntegerField(default=0)
    downloads = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["book", "day"], name="uniq_book_day_stat")]

    def __str__(self):
        return f"{self.book_id} {self.day}"


class PageDailyStat(models.Model):
    """Kitob sahifasi bo'yicha kunlik ko'rishlar soni (eng ko'p o'qilgan betlar)."""

    book = models.ForeignKey(
        "content.PdfBook", on_delete=models.CASCADE, related_name="page_daily_stats"
    )
    day = models.DateField(db_index=True)
    page = models.PositiveIntegerField()
    views = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["book", "day", "page"], name="uniq_book_day_page_stat")
        ]

    def __str__(self):
        return f"{self.book_id} {self.day} p{self.page}"

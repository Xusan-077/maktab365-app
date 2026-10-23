from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .cache import bump_content_version
from .models import PdfBook, PdfBookChapter, Subject


@receiver([post_save, post_delete], sender=Subject)
@receiver([post_save, post_delete], sender=PdfBook)
@receiver([post_save, post_delete], sender=PdfBookChapter)
def invalidate_content_cache(sender, **kwargs):
    """Nashr/tahrir/o'chirish: ochiq API keshi tozalanadi (tranzaksiya tugagach)."""
    transaction.on_commit(bump_content_version)

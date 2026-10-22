from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .cache import bump_content_version
from .models import Book, Chapter, PdfBook, Subject, Topic


@receiver([post_save, post_delete], sender=Subject)
@receiver([post_save, post_delete], sender=Book)
@receiver([post_save, post_delete], sender=Chapter)
@receiver([post_save, post_delete], sender=Topic)
@receiver([post_save, post_delete], sender=PdfBook)
def invalidate_content_cache(sender, **kwargs):
    """Nashr/tahrir/o'chirish: ochiq API keshi tozalanadi (tranzaksiya tugagach)."""
    transaction.on_commit(bump_content_version)

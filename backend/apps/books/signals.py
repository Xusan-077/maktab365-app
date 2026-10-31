from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.content.cache import bump_content_version

from .models import Book, BookChapter, BookPage


@receiver([post_save, post_delete], sender=Book)
@receiver([post_save, post_delete], sender=BookChapter)
@receiver([post_save, post_delete], sender=BookPage)
def invalidate_content_cache(sender, **kwargs):
    """Ochiq `books/*` javoblari `public_cached` da turadi: o'zgarishda kesh versiyasi almashadi."""
    transaction.on_commit(bump_content_version)

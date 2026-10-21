"""Mavzu kaliti (`{kitob}-{mavzu}`), ko'rinish qoidasi va mashq id'lari."""

from django.db.models import CharField, Value
from django.db.models.functions import Concat
from rest_framework.exceptions import NotFound

from apps.content.cache import is_staff, show_drafts
from apps.content.models import Topic, TopicStatus


def topic_key(topic: Topic) -> str:
    """Frontend mavzu id'si: `algebra-9-viyet-teoremasi`. `topic.book` yuklangan bo'lishi kerak."""
    return f"{topic.book.slug}-{topic.slug}"


def visible_topics(request):
    """Foydalanuvchiga ko'rinadigan mavzular (ochiq kontent API qoidasi bilan bir xil)."""
    topics = Topic.objects.select_related("book")
    if not show_drafts(request):
        topics = topics.filter(status=TopicStatus.PUBLISHED)
    if not is_staff(request.user):
        topics = topics.filter(book__is_published=True)
    return topics


def key_expr(prefix: str = ""):
    """Mavzu kaliti ifodasi; `prefix` — mavzuga o'tuvchi aloqa (`topic__`)."""
    return Concat(f"{prefix}book__slug", Value("-"), f"{prefix}slug", output_field=CharField())


def keyed(queryset):
    return queryset.annotate(key=key_expr())


def resolve_topic(request, key: str) -> Topic:
    topic = keyed(visible_topics(request)).filter(key=key).first()
    if topic is None:
        raise NotFound("Topic not found.")
    return topic


def resolve_topics(request, keys) -> dict[str, Topic]:
    """Kalitlar bo'yicha ko'rinadigan mavzular; topilmaganlari natijada yo'q."""
    keys = list(dict.fromkeys(keys))
    return {t.key: t for t in keyed(visible_topics(request)).filter(key__in=keys)}


def exercise_ids(topic: Topic) -> list[str]:
    return [b["id"] for b in topic.blocks if b.get("type") == "exercise" and b.get("id")]

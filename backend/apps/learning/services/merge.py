"""Mehmon ma'lumotini akkauntga qo'shish (kirgandan keyin bir marta; takror chaqirish xavfsiz).

Qoidalar frontend `lib/merge-guest-data.ts` (`mergeProgress`) bilan bir xil va
`contracts/fixtures/merge-*.json` orqali ikki tomonda tekshiriladi.
"""

from django.db import transaction
from rest_framework.exceptions import NotFound

from ..models import BookmarkKind
from .bookmarks import add_bookmark, visible_book
from .progress import merge_progress
from .topics import resolve_topics

MERGE_LIMIT = 500


def merge_guest_data(request, progress: list[dict], bookmarks: list[dict]) -> dict:
    """`{progress, bookmarks, failed}`: o'zgargan yozuvlar va qo'shib bo'lmagan id'lar."""
    user = request.user
    keys = [item["topic_id"] for item in progress]
    keys += [item["topic_id"] for item in bookmarks if item["kind"] == BookmarkKind.TOPIC]
    topics = resolve_topics(request, keys)

    result = {"progress": 0, "bookmarks": 0, "failed": []}
    with transaction.atomic():
        for item in progress:
            topic = topics.get(item["topic_id"])
            if topic is None:
                result["failed"].append(item["topic_id"])
            elif merge_progress(user, topic, item):
                result["progress"] += 1

        for item in bookmarks:
            if item["kind"] == BookmarkKind.TOPIC:
                topic = topics.get(item["topic_id"])
                if topic is None:
                    result["failed"].append(item["topic_id"])
                elif add_bookmark(user, topic=topic)[1]:
                    result["bookmarks"] += 1
            else:
                try:
                    book = visible_book(request, item["book_id"])
                except NotFound:
                    result["failed"].append(item["book_id"])
                    continue
                if add_bookmark(user, book=book)[1]:
                    result["bookmarks"] += 1
    result["failed"] = list(dict.fromkeys(result["failed"]))
    return result

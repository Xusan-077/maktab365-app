"""Muqova va rasmlar uchun ommaviy saqlash (`STORAGES["covers"]`).

PDF fayllar shaxsiy `default` bucket'da qoladi va imzolangan URL bilan beriladi; muqova rasmlari
(`covers/`, `images/`) esa ommaviy domendagi alohida bucket'da turadi. `COVERS_BUCKET_NAME`
berilmasa `covers` — `default` bilan bir xil (dev va testlar o'zgarmaydi).
"""

from django.core.files.storage import Storage, storages


def covers_storage() -> Storage:
    """`FileField(storage=...)` uchun callable: migratsiyada obyekt emas, funksiya saqlanadi."""
    return storages["covers"]

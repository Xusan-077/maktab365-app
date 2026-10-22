from django.core.management.base import BaseCommand
from django.db import transaction

from apps.content.catalog_seed import SUBJECTS as IMPORTED
from apps.content.models import Subject

# Maktab fanlari. `import_content` biladigan to'rtta fan `catalog_seed` dan olinadi: slug,
# tartib va sarlavha ikki joyda farq qilmasin.
EXTRA: dict[str, dict] = {
    "matematika": {
        "order": 1,
        "icon": "calculator",
        "title": {"uz": "Matematika", "ru": "Математика", "en": "Mathematics"},
    },
    "ona-tili": {
        "order": 5,
        "icon": "book-open",
        "title": {"uz": "Ona tili", "ru": "Родной язык", "en": "Native language"},
    },
    "adabiyot": {
        "order": 7,
        "icon": "feather",
        "title": {"uz": "Adabiyot", "ru": "Литература", "en": "Literature"},
    },
    "rus-tili": {
        "order": 8,
        "icon": "languages",
        "title": {"uz": "Rus tili", "ru": "Русский язык", "en": "Russian"},
    },
    "fizika": {
        "order": 9,
        "icon": "atom",
        "title": {"uz": "Fizika", "ru": "Физика", "en": "Physics"},
    },
    "kimyo": {
        "order": 10,
        "icon": "flask-conical",
        "title": {"uz": "Kimyo", "ru": "Химия", "en": "Chemistry"},
    },
    "biologiya": {
        "order": 11,
        "icon": "dna",
        "title": {"uz": "Biologiya", "ru": "Биология", "en": "Biology"},
    },
    "geografiya": {
        "order": 12,
        "icon": "globe",
        "title": {"uz": "Geografiya", "ru": "География", "en": "Geography"},
    },
    "informatika": {
        "order": 13,
        "icon": "monitor",
        "title": {"uz": "Informatika", "ru": "Информатика", "en": "Computer science"},
    },
    "tabiiy-fan": {
        "order": 14,
        "icon": "leaf",
        "title": {"uz": "Tabiiy fan", "ru": "Естествознание", "en": "Natural science"},
    },
    "texnologiya": {
        "order": 15,
        "icon": "wrench",
        "title": {"uz": "Texnologiya", "ru": "Технология", "en": "Technology"},
    },
    "jismoniy-tarbiya": {
        "order": 16,
        "icon": "dumbbell",
        "title": {"uz": "Jismoniy tarbiya", "ru": "Физкультура", "en": "Physical education"},
    },
    "chizmachilik": {
        "order": 17,
        "icon": "ruler",
        "title": {"uz": "Chizmachilik", "ru": "Черчение", "en": "Technical drawing"},
    },
    "tasviriy-san-at": {
        "order": 18,
        "icon": "palette",
        "title": {"uz": "Tasviriy san'at", "ru": "Изобразительное искусство", "en": "Fine arts"},
    },
    "musiqa": {
        "order": 19,
        "icon": "music",
        "title": {"uz": "Musiqa", "ru": "Музыка", "en": "Music"},
    },
}

SUBJECTS: dict[str, dict] = {**IMPORTED, **EXTRA}


class Command(BaseCommand):
    help = (
        "Asosiy maktab fanlarini qo'shadi (idempotent). Mavjud fan (slug bo'yicha) "
        "o'zgartirilmaydi: admin tahrirlari saqlanadi."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        for slug, meta in SUBJECTS.items():
            _, was_created = Subject.objects.get_or_create(
                slug=slug,
                defaults={"title": meta["title"], "icon": meta["icon"], "order": meta["order"]},
            )
            created += was_created
        self.stdout.write(f"fan: {created} yangi, {len(SUBJECTS) - created} mavjud")

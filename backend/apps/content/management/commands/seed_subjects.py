from django.core.management.base import BaseCommand
from django.db import transaction

from apps.content.cache import bump_content_version
from apps.content.models import Subject

# Maktab fanlari: slug barqaror (kitoblar shunga bog'lanadi), `order` ro'yxat tartibi.
SUBJECTS: dict[str, dict] = {
    "algebra": {
        "order": 2,
        "icon": "sigma",
        "title": {"uz": "Algebra", "ru": "Алгебра", "en": "Algebra"},
    },
    "geometriya": {
        "order": 3,
        "icon": "triangle",
        "title": {"uz": "Geometriya", "ru": "Геометрия", "en": "Geometry"},
    },
    "ingliz-tili": {
        "order": 4,
        "icon": "languages",
        "title": {"uz": "Ingliz tili", "ru": "Английский язык", "en": "English"},
    },
    "tarix": {
        "order": 6,
        "icon": "landmark",
        "title": {"uz": "Tarix", "ru": "История", "en": "History"},
    },
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


# Katalog tablari uchun fan guruhi (`Subject.group`); admin keyin `/admin/fanlar` da o'zgartiradi.
GROUPS: dict[str, str] = {
    "matematika": "exact",
    "algebra": "exact",
    "geometriya": "exact",
    "informatika": "exact",
    "fizika": "exact",
    "chizmachilik": "exact",
    "kimyo": "natural",
    "biologiya": "natural",
    "geografiya": "natural",
    "tabiiy-fan": "natural",
    "ona-tili": "language",
    "adabiyot": "language",
    "ingliz-tili": "language",
    "rus-tili": "language",
    "tarix": "social",
    "tasviriy-san-at": "arts",
    "musiqa": "arts",
    "texnologiya": "arts",
    "jismoniy-tarbiya": "arts",
}


def _span(first: int, last: int) -> list[int]:
    return list(range(first, last + 1))


# Fan o'tiladigan sinflar (`Subject.grades`). Admin keyin `/admin/fanlar` da o'zgartiradi.
GRADES: dict[str, list[int]] = {
    "matematika": _span(1, 6),
    "algebra": _span(7, 11),
    "geometriya": _span(7, 11),
    "informatika": _span(5, 11),
    "fizika": _span(7, 11),
    "chizmachilik": _span(8, 9),
    "kimyo": _span(7, 11),
    "biologiya": _span(5, 11),
    "geografiya": _span(5, 11),
    "tabiiy-fan": _span(1, 4),
    "ona-tili": _span(1, 11),
    "adabiyot": _span(1, 11),
    "ingliz-tili": _span(1, 11),
    "rus-tili": _span(1, 11),
    "tarix": _span(5, 11),
    "tasviriy-san-at": _span(1, 7),
    "musiqa": _span(1, 7),
    "texnologiya": _span(1, 9),
    "jismoniy-tarbiya": _span(1, 11),
}


class Command(BaseCommand):
    help = (
        "Asosiy maktab fanlarini qo'shadi (idempotent). Mavjud fan (slug bo'yicha) "
        "o'zgartirilmaydi: admin tahrirlari saqlanadi (sinflar ham). "
        "--force: mavjud fanlarning sinflarini ro'yxatdagi qiymatga qaytaradi."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Mavjud fanlarning sinflarini (grades) ro'yxatdagi qiymat bilan almashtiradi.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        for slug, meta in SUBJECTS.items():
            _, was_created = Subject.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": meta["title"],
                    "icon": meta["icon"],
                    "order": meta["order"],
                    "group": GROUPS.get(slug, ""),
                    "grades": GRADES[slug],
                },
            )
            created += was_created
        # Guruhi hali berilmagan mavjud fanlarga guruh qo'yiladi (admin tanlaganiga tegilmaydi).
        for slug, group in GROUPS.items():
            Subject.objects.filter(slug=slug, group="").update(group=group)
        if options["force"]:
            for slug, grades in GRADES.items():
                Subject.objects.filter(slug=slug).update(grades=grades)
        # `update()` signal chaqirmaydi: ochiq API keshi qo'lda yangilanadi.
        transaction.on_commit(bump_content_version)
        self.stdout.write(f"fan: {created} yangi, {len(SUBJECTS) - created} mavjud")

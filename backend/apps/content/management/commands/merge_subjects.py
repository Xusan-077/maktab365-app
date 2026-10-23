"""Takroriy/eski fanlarni yangi fanga birlashtiradi: kitoblar ko'chiriladi, keyin eski fan o'chadi.

`PdfBook.subject` — `on_delete=PROTECT`, shuning uchun fanni bazadan to'g'ridan-to'g'ri
o'chirib bo'lmaydi (`violates foreign key constraint content_pdfbook_subject_id_...`).
Bu buyruq avval kitoblarni yangi fanga
o'tkazadi, so'ng eski fanni o'chiradi. Hech bir kitob o'chmaydi.

    python manage.py merge_subjects --dry-run                      # faqat reja
    python manage.py merge_subjects --dry-run --prune-unknown      # seed'da yo'q fanlar ham nomzod
    python manage.py merge_subjects --map eski-slug=yangi-slug --yes
"""

import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.content.management.commands.seed_subjects import SUBJECTS
from apps.content.models import PdfBook, Subject

_APOSTROPHES = str.maketrans(dict.fromkeys("ʻʼ’‘`´", "'"))


def normalize(text: str) -> str:
    """Katta-kichik harf, apostrof turlari va ortiqcha bo'shliqlarga befarq taqqoslash kaliti."""
    text = (text or "").translate(_APOSTROPHES).casefold()
    return re.sub(r"[^\w']+", " ", text).strip()


def slug_base(slug: str) -> str:
    """`algebra-2` → `algebra`."""
    return re.sub(r"-\d{1,2}$", "", slug)


def match_keys(subject: Subject) -> set[tuple[str, str]]:
    keys = {("slug", slug_base(subject.slug))}
    for lang in ("uz", "ru", "en"):
        title = normalize((subject.title or {}).get(lang, ""))
        if title:
            keys.add((lang, title))
    return keys


def group_duplicates(subjects: list[Subject]) -> list[list[Subject]]:
    """Bir xil slug asosi yoki bir xil nomli fanlar bitta guruhga tushadi (birlashtirish usuli)."""
    parent = {s.pk: s.pk for s in subjects}

    def find(pk):
        while parent[pk] != pk:
            parent[pk] = parent[parent[pk]]
            pk = parent[pk]
        return pk

    owner: dict[tuple[str, str], int] = {}
    for subject in subjects:
        for key in match_keys(subject):
            if key in owner:
                parent[find(subject.pk)] = find(owner[key])
            else:
                owner[key] = subject.pk
    groups: dict[int, list[Subject]] = defaultdict(list)
    for subject in subjects:
        groups[find(subject.pk)].append(subject)
    return [members for members in groups.values() if len(members) > 1]


def pick_canonical(members: list[Subject]) -> Subject:
    """Seed'dagi to'g'ri slug → ko'proq kitob → eskiroq yozuv."""
    return min(
        members,
        key=lambda s: (s.slug not in SUBJECTS, -s.book_count, s.created_at),
    )


class Command(BaseCommand):
    help = "Takroriy/eski fanlarni yangi fanga birlashtiradi (kitoblar ko'chadi, eski fan o'chadi)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Faqat reja, bazaga tegmaydi.")
        parser.add_argument("--yes", action="store_true", help="Rejani qo'llashni tasdiqlash.")
        parser.add_argument(
            "--map",
            action="append",
            default=[],
            metavar="ESKI=YANGI",
            help="Qo'lda moslashtirish (slug yoki id), takrorlash mumkin.",
        )
        parser.add_argument(
            "--prune-unknown",
            action="store_true",
            help="Seed'da yo'q fanlar ham eski (kitobsizi o'chadi, kitobli bo'lsa --map kerak).",
        )
        parser.add_argument(
            "--extend-grades",
            action="store_true",
            help="Yangi fanda yo'q kitob sinflari bo'lsa, shu sinflar yangi fanga qo'shiladi.",
        )
        parser.add_argument(
            "--backup",
            default="backup_content.json",
            help="Qo'llashdan oldin `dumpdata content` yoziladigan fayl.",
        )

    # --- reja ---

    def handle(self, *args, **options):
        subjects = list(
            Subject.objects.annotate(book_count=Count("pdf_books")).order_by("order", "slug")
        )
        self.print_subjects(subjects)

        by_ref = {str(s.pk): s for s in subjects} | {s.slug: s for s in subjects}
        plan: dict[Subject, Subject] = {}  # eski -> yangi
        unresolved: list[Subject] = []

        for raw in options["map"]:
            old_ref, sep, new_ref = raw.partition("=")
            old, new = by_ref.get(old_ref.strip()), by_ref.get(new_ref.strip())
            if not sep or old is None or new is None:
                raise CommandError(f"--map noto'g'ri yoki fan topilmadi: {raw!r}")
            if old == new:
                raise CommandError(f"--map: eski va yangi bir xil: {raw!r}")
            plan[old] = new

        for members in group_duplicates(subjects):
            canonical = pick_canonical(members)
            for member in members:
                if member != canonical and member not in plan:
                    plan[member] = canonical

        if options["prune_unknown"]:
            for subject in subjects:
                if subject.slug in SUBJECTS or subject in plan or subject in plan.values():
                    continue
                if subject.book_count == 0:
                    plan[subject] = None  # kitobsiz - shunchaki o'chadi
                else:
                    unresolved.append(subject)

        # Zanjir (A->B, B->C) bo'lsa oxirgi maqsadga keltiriladi.
        for old in list(plan):
            target, seen = plan[old], {old}
            while target is not None and target in plan and plan[target] is not None:
                if target in seen:
                    raise CommandError("--map: aylana (A->B->A)")
                seen.add(target)
                target = plan[target]
            plan[old] = target

        self.print_plan(plan, unresolved)
        problems = self.find_grade_problems(plan)
        for target, grades in problems.items():
            self.stdout.write(
                self.style.WARNING(
                    f"! {target.slug}: kitob sinflari {sorted(grades)} fan sinflari "
                    f"{target.grades} da yo'q"
                    + (" (--extend-grades bilan qo'shiladi)" if options["extend_grades"] else "")
                )
            )

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("\nDry-run: bazaga hech narsa yozilmadi."))
            return
        if unresolved:
            raise CommandError(
                "Kitobli, lekin moslanmagan fanlar bor: "
                + ", ".join(s.slug for s in unresolved)
                + ". Ularga --map ESKI=YANGI bering."
            )
        if not plan:
            self.stdout.write("Birlashtiradigan fan yo'q.")
            return
        if problems and not options["extend_grades"]:
            raise CommandError(
                "Sinflar mos emas: --extend-grades bering yoki --map ni o'zgartiring."
            )
        if not options["yes"]:
            raise CommandError(
                "Reja ko'rildi. Qo'llash uchun --yes bering (avval --dry-run bilan tekshiring)."
            )

        self.apply(plan, problems, options["backup"])

    # --- qo'llash ---

    def apply(self, plan, problems, backup):
        books_before = PdfBook.objects.count()
        backup_path = Path(backup)
        if backup_path.exists():
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_path = backup_path.with_name(f"{backup_path.stem}-{stamp}{backup_path.suffix}")
        call_command("dumpdata", "content", indent=2, output=str(backup_path))
        self.stdout.write(f"Backup: {backup_path}")

        moved = 0
        with transaction.atomic():
            for old, new in plan.items():
                if new is not None:
                    locked = Subject.objects.select_for_update().get(pk=new.pk)
                    if problems.get(new):
                        locked.grades = sorted(set(locked.grades) | problems[new])
                        locked.save(update_fields=["grades", "updated_at"])
                    moved += PdfBook.objects.filter(subject_id=old.pk).update(
                        subject_id=new.pk, updated_at=timezone.now()
                    )
                if PdfBook.objects.filter(subject_id=old.pk).exists():
                    raise CommandError(
                        f"{old.slug}: kitoblar qoldi, o'chirilmadi (tranzaksiya bekor)."
                    )
                Subject.objects.get(pk=old.pk).delete()
            if PdfBook.objects.count() != books_before:
                raise CommandError("Kitoblar soni o'zgardi - tranzaksiya bekor qilindi.")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nTayyor: {moved} ta kitob ko'chirildi, {len(plan)} ta fan o'chirildi."
            )
        )
        self.print_subjects(
            list(Subject.objects.annotate(book_count=Count("pdf_books")).order_by("order", "slug")),
            title="Yakuniy fanlar",
        )

    # --- yordamchilar ---

    def find_grade_problems(self, plan) -> dict[Subject, set[int]]:
        problems: dict[Subject, set[int]] = {}
        for old, new in plan.items():
            if new is None:
                continue
            grades = set(PdfBook.objects.filter(subject_id=old.pk).values_list("grade", flat=True))
            missing = grades - set(new.grades)
            if missing:
                problems.setdefault(new, set()).update(missing)
        return problems

    def print_subjects(self, subjects, title="Hozirgi fanlar"):
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n{title} ({len(subjects)})"))
        for s in subjects:
            grades = ",".join(str(g) for g in s.grades)
            self.stdout.write(
                f"  {s.pk}  {s.slug:<22} {(s.title or {}).get('uz', ''):<22} "
                f"guruh={s.group or '-':<8} sinflar=[{grades}]  kitoblar={s.book_count}"
            )

    def print_plan(self, plan, unresolved):
        self.stdout.write(self.style.MIGRATE_HEADING("\nReja: eski id -> yangi id"))
        if not plan and not unresolved:
            self.stdout.write("  (birlashtiradigan takroriy/eski fan topilmadi)")
        for old, new in plan.items():
            if new is None:
                note = f"o'chadi (kitobsiz, {old.book_count} ta)"
                self.stdout.write(f"  {old.pk} ({old.slug}) -> {note}")
            else:
                self.stdout.write(
                    f"  {old.pk} ({old.slug}) -> {new.pk} ({new.slug})  "
                    f"[{old.book_count} ta kitob ko'chadi]"
                )
        if unresolved:
            self.stdout.write(self.style.WARNING("\nMos fan topilmadi (--map kerak):"))
            for s in unresolved:
                self.stdout.write(f"  {s.pk} ({s.slug}) - {s.book_count} ta kitob")

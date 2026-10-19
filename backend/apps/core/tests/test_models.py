import uuid

from apps.core.tests.conftest import Note


def test_uuid_and_timestamps(note_table):
    note = note_table.objects.create(title="a")
    assert isinstance(note.id, uuid.UUID)
    assert note.created_at and note.updated_at


def test_soft_delete_hides_from_default_manager(note_table):
    note = note_table.objects.create(title="a")
    note.delete()
    assert not Note.objects.filter(pk=note.pk).exists()
    assert Note.all_objects.filter(pk=note.pk).exists()
    assert Note.all_objects.get(pk=note.pk).is_deleted


def test_queryset_delete_is_soft_and_restore(note_table):
    note = note_table.objects.create(title="a")
    Note.objects.all().delete()
    assert Note.objects.count() == 0
    restored = Note.all_objects.get(pk=note.pk)
    restored.restore()
    assert Note.objects.count() == 1


def test_hard_delete(note_table):
    note = note_table.objects.create(title="a")
    note.hard_delete()
    assert Note.all_objects.count() == 0

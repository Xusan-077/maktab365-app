from django.db import migrations

PRESETS = ["Zakovat", "IQ", "Umumiy bilim", "Mantiq", "Tarix", "Sport", "Boshqa"]


def seed(apps, schema_editor):
    Category = apps.get_model("quizzes", "QuizCategory")
    for order, name in enumerate(PRESETS):
        Category.objects.get_or_create(teacher=None, name=name, defaults={"order": order})


def unseed(apps, schema_editor):
    apps.get_model("quizzes", "QuizCategory").objects.filter(
        teacher=None, name__in=PRESETS
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("quizzes", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]

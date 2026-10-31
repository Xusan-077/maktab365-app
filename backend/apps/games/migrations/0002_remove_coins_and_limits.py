from django.db import migrations, models


class Migration(migrations.Migration):
    """Tanga va limit jadvallari ma'lumoti bilan o'chadi. Orqaga qaytarilganda jadvallar bo'sh
    tiklanadi, mavjud sessiyalarga `paid_with="free"`, `coins_spent=0` qo'yiladi."""

    dependencies = [
        ("games", "0001_initial"),
    ]

    operations = [
        migrations.DeleteModel(name="CoinTransaction"),
        migrations.DeleteModel(name="CoinWallet"),
        migrations.DeleteModel(name="GameAllowance"),
        # Avval default: qaytarishda NOT NULL ustun mavjud qatorlarga qo'shila olishi uchun.
        migrations.AlterField(
            model_name="gamesession",
            name="paid_with",
            field=models.CharField(
                choices=[("free", "Free"), ("coins", "Coins")], default="free", max_length=8
            ),
        ),
        migrations.RemoveField(model_name="gamesession", name="paid_with"),
        migrations.RemoveField(model_name="gamesession", name="coins_spent"),
    ]

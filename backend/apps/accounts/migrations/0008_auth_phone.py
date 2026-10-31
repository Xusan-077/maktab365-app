from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_env_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="phone",
            field=models.CharField(blank=True, default="", max_length=13),
        ),
        migrations.AddConstraint(
            model_name="profile",
            constraint=models.UniqueConstraint(
                condition=models.Q(("phone", ""), _negated=True),
                fields=("phone",),
                name="auth_profile_phone_unique",
            ),
        ),
    ]

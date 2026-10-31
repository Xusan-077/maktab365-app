import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [("games", "0001_initial")]
AFTER = [("games", "0002_remove_coins_and_limits")]
COIN_TABLES = {"games_coinwallet", "games_cointransaction", "games_gameallowance"}


def migrate(target):
    executor = MigrationExecutor(connection)
    executor.migrate(target)
    return MigrationExecutor(connection).loader.project_state(target).apps


def tables():
    return set(connection.introspection.table_names())


@pytest.mark.django_db(transaction=True)
def test_remove_coins_migration_is_reversible():
    user = get_user_model().objects.create_user(email="m@example.com", password="x" * 12)
    apps = migrate(AFTER)
    session = apps.get_model("games", "GameSession").objects.create(user_id=user.pk, game_type="q")
    try:
        apps = migrate(BEFORE)
        assert tables() >= COIN_TABLES
        restored = apps.get_model("games", "GameSession").objects.get(pk=session.pk)
        assert restored.paid_with == "free"
        assert restored.coins_spent == 0
    finally:
        migrate(AFTER)
    assert not COIN_TABLES & tables()
    assert apps.get_model("games", "GameSession").objects.filter(pk=session.pk).exists()

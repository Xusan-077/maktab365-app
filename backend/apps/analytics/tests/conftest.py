import pytest

from apps.content.tests.conftest import Catalog, clear_cache  # noqa: F401 — autouse fixture


@pytest.fixture
def catalog(db):
    return Catalog()

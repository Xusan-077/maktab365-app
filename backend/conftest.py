import pytest

from apps.core.tests.passwords import NEW_TEST_PASSWORD, TEST_PASSWORD


@pytest.fixture(scope="session")
def test_password() -> str:
    """Umumiy test paroli (tasodifiy); foydalanuvchi yaratadigan hamma testlar shuni ishlatadi."""
    return TEST_PASSWORD


@pytest.fixture(scope="session")
def new_test_password() -> str:
    return NEW_TEST_PASSWORD

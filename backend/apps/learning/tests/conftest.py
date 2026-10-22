import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Profile, User
from apps.content.tests.conftest import Catalog, clear_cache  # noqa: F401 — autouse fixture
from apps.core.tests.passwords import TEST_PASSWORD


def make_user(email, **profile):
    user = User.objects.create_user(email=email, password=TEST_PASSWORD)
    if profile:
        Profile.objects.update_or_create(user=user, defaults=profile)
    return user


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def user(db):
    return make_user("ali@example.com")


@pytest.fixture
def api(user):
    return client_for(user)


@pytest.fixture
def other_api(db):
    return client_for(make_user("vali@example.com"))

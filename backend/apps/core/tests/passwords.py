"""Testlar uchun parollar: har jarayonda tasodifiy yaratiladi, kodda parol yo'q."""

import secrets

TEST_PASSWORD = secrets.token_urlsafe(18)
NEW_TEST_PASSWORD = secrets.token_urlsafe(18)
OTHER_TEST_PASSWORD = secrets.token_urlsafe(18)

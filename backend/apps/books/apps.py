from django.apps import AppConfig


class BooksConfig(AppConfig):
    name = "apps.books"

    def ready(self):
        from . import signals  # noqa: F401

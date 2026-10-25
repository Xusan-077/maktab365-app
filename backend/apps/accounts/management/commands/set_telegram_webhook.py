import re

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

WEBHOOK_PATH = "/api/v1/auth/telegram/webhook/"
SECRET_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,256}$")


class Command(BaseCommand):
    help = (
        "Telegram bot webhook'ini `<base_url>/api/v1/auth/telegram/webhook/` ga ulaydi "
        "(setWebhook + secret_token = TELEGRAM_WEBHOOK_SECRET). `--delete` — webhook'ni o'chiradi."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "base_url", nargs="?", help="Backend manzili, masalan https://api.example.uz"
        )
        parser.add_argument("--delete", action="store_true", help="deleteWebhook chaqiradi")
        parser.add_argument(
            "--drop-pending",
            action="store_true",
            help="Telegram navbatida qolgan eski update'larni tashlab yuboradi",
        )

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            raise CommandError("TELEGRAM_BOT_TOKEN bo'sh.")
        if options["delete"]:
            self._call(token, "deleteWebhook", {"drop_pending_updates": options["drop_pending"]})
            self.stdout.write("Webhook o'chirildi.")
            return

        secret = settings.TELEGRAM_WEBHOOK_SECRET
        if not SECRET_PATTERN.match(secret):
            raise CommandError(
                "TELEGRAM_WEBHOOK_SECRET bo'sh yoki yaroqsiz (A-Z a-z 0-9 _ -, 1..256)."
            )
        base_url = (options["base_url"] or "").rstrip("/")
        if not base_url.startswith("https://"):
            raise CommandError("base_url https:// bilan boshlanishi kerak (Telegram talabi).")
        url = f"{base_url}{WEBHOOK_PATH}"
        self._call(
            token,
            "setWebhook",
            {
                "url": url,
                "secret_token": secret,
                "allowed_updates": ["message"],
                "drop_pending_updates": options["drop_pending"],
            },
        )
        self.stdout.write(f"Webhook ulandi: {url}")

    def _call(self, token: str, method: str, payload: dict) -> None:
        try:
            response = requests.post(
                f"https://api.telegram.org/bot{token}/{method}", json=payload, timeout=15
            )
            body = response.json()
        except (requests.RequestException, ValueError) as error:
            raise CommandError(
                f"Telegram API'ga ulanib bo'lmadi: {error.__class__.__name__}"
            ) from None
        if not body.get("ok"):
            raise CommandError(f"Telegram {method} xatosi: {body.get('description', 'unknown')}")

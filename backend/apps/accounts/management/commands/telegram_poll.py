import time

import requests
import structlog
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.accounts import telegram_login

log = structlog.get_logger()

API = "https://api.telegram.org/bot{token}/{method}"
LONG_POLL_SECONDS = 25
RETRY_SECONDS = 3


class Command(BaseCommand):
    help = (
        "Lokal ishlab chiqish: bot update'larini getUpdates (long polling) bilan oladi va webhook "
        "bilan bir xil ishlaydi (`telegram_login.handle_update`). Telegram localhost'ga webhook "
        "yubora olmaydi — shuning uchun dev'da shu buyruq. Webhook ulangan bo'lsa ishlamaydi "
        "(`set_telegram_webhook --delete`)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Bitta getUpdates va chiqish")

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token or not telegram_login.is_configured():
            raise CommandError(
                "TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME va TELEGRAM_WEBHOOK_SECRET kerak."
            )
        self.stdout.write(
            f"@{settings.TELEGRAM_BOT_USERNAME} polling boshlandi (Ctrl+C — to'xtatish)"
        )
        offset = None
        while True:
            try:
                offset = self._poll(token, offset)
            except requests.RequestException as error:
                if options["once"]:
                    raise CommandError(f"Telegram API: {error.__class__.__name__}") from None
                log.warning("telegram_poll_error", error=error.__class__.__name__)
                time.sleep(RETRY_SECONDS)
            if options["once"]:
                if offset is not None:
                    # Telegram offset'ni keyingi getUpdates'da tasdiqlaydi — aks holda keyingi
                    # ishga tushirishda shu update'lar qayta ishlanadi.
                    requests.get(
                        API.format(token=token, method="getUpdates"),
                        params={"offset": offset, "timeout": 0},
                        timeout=15,
                    )
                return

    def _poll(self, token: str, offset: int | None) -> int | None:
        response = requests.get(
            API.format(token=token, method="getUpdates"),
            params={
                "timeout": LONG_POLL_SECONDS,
                "allowed_updates": '["message"]',
                **({"offset": offset} if offset is not None else {}),
            },
            timeout=LONG_POLL_SECONDS + 10,
        )
        body = response.json()
        if not body.get("ok"):
            if body.get("error_code") == 409:
                raise CommandError(
                    "Telegram 409: webhook ulangan yoki shu token bilan boshqa jarayon polling "
                    "qilmoqda. Webhook'ni o'chirish: manage.py set_telegram_webhook --delete"
                )
            raise CommandError(f"getUpdates xatosi: {body.get('description', 'unknown')}")
        for update in body["result"]:
            offset = update["update_id"] + 1
            reply = telegram_login.handle_update(update)
            if reply:
                method = reply.pop("method")
                requests.post(API.format(token=token, method=method), json=reply, timeout=15)
                self.stdout.write(f"update {update['update_id']}: {reply['text']}")
        return offset

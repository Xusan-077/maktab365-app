"""SMS OTP (Eskiz.uz) uchun interfeys. Implementatsiya keyingi bosqichda."""

from abc import ABC, abstractmethod


class SmsSender(ABC):
    @abstractmethod
    def send(self, phone: str, text: str) -> None:
        """`phone` — E.164 (`+998901234567`)."""


class EskizSmsSender(SmsSender):
    def send(self, phone: str, text: str) -> None:
        raise NotImplementedError("Eskiz.uz integratsiyasi hali yozilmagan.")

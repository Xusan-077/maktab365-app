"""Auth xatlari: matnlar uz/ru/en, bitta HTML + matn shabloni (`templates/accounts/email/`)."""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .models import Locale, TokenPurpose

# Kirill foydalanuvchisiga lotin matni yuboriladi (email klientida transliteratsiya yo'q).
EMAIL_LANGUAGES = ("uz", "ru", "en")

COPY = {
    TokenPurpose.EMAIL_VERIFY: {
        "uz": {
            "subject": "maktab365: emailingizni tasdiqlang",
            "greeting": "Assalomu alaykum!",
            "text": "maktab365 da ro'yxatdan o'tganingiz uchun rahmat. "
            "Email manzilingizni tasdiqlash uchun quyidagi tugmani bosing.",
            "button": "Emailni tasdiqlash",
            "expires": "Havola 24 soat amal qiladi.",
            "ignore": "Agar siz ro'yxatdan o'tmagan bo'lsangiz, bu xatga e'tibor bermang.",
        },
        "ru": {
            "subject": "maktab365: подтвердите email",
            "greeting": "Здравствуйте!",
            "text": "Спасибо за регистрацию в maktab365. "
            "Чтобы подтвердить адрес электронной почты, нажмите на кнопку ниже.",
            "button": "Подтвердить email",
            "expires": "Ссылка действует 24 часа.",
            "ignore": "Если вы не регистрировались, просто проигнорируйте это письмо.",
        },
        "en": {
            "subject": "maktab365: confirm your email",
            "greeting": "Hello!",
            "text": "Thanks for signing up for maktab365. "
            "Press the button below to confirm your email address.",
            "button": "Confirm email",
            "expires": "The link is valid for 24 hours.",
            "ignore": "If you didn't sign up, you can ignore this email.",
        },
    },
    TokenPurpose.PASSWORD_RESET: {
        "uz": {
            "subject": "maktab365: parolni tiklash",
            "greeting": "Assalomu alaykum!",
            "text": "Akkauntingiz uchun parolni tiklash so'raldi. "
            "Yangi parol o'rnatish uchun quyidagi tugmani bosing.",
            "button": "Yangi parol o'rnatish",
            "expires": "Havola 1 soat amal qiladi va faqat bir marta ishlaydi.",
            "ignore": "Agar buni siz so'ramagan bo'lsangiz, xatga e'tibor bermang — "
            "parolingiz o'zgarmaydi.",
        },
        "ru": {
            "subject": "maktab365: восстановление пароля",
            "greeting": "Здравствуйте!",
            "text": "Для вашего аккаунта запрошено восстановление пароля. "
            "Нажмите на кнопку ниже, чтобы задать новый пароль.",
            "button": "Задать новый пароль",
            "expires": "Ссылка действует 1 час и срабатывает только один раз.",
            "ignore": "Если вы не запрашивали восстановление, проигнорируйте письмо — "
            "пароль не изменится.",
        },
        "en": {
            "subject": "maktab365: reset your password",
            "greeting": "Hello!",
            "text": "A password reset was requested for your account. "
            "Press the button below to set a new password.",
            "button": "Set a new password",
            "expires": "The link is valid for 1 hour and works only once.",
            "ignore": "If you didn't request this, ignore this email — your password won't change.",
        },
    },
}

# Frontend yo'llari (`frontend/src/lib/utils/routes.ts` bilan bir xil).
FRONTEND_PATHS = {
    TokenPurpose.EMAIL_VERIFY: "/email-tasdiqlash",
    TokenPurpose.PASSWORD_RESET: "/parolni-tiklash",
}


def email_language(locale: str | None) -> str:
    if locale == Locale.UZ_CYRL:
        return "uz"
    return locale if locale in EMAIL_LANGUAGES else "uz"


def action_url(purpose: str, token: str, locale: str | None) -> str:
    # Frontend til prefiksi: profil tili (kirill ham) — sahifa foydalanuvchi tilida ochiladi.
    prefix = locale if locale in Locale.values else Locale.UZ
    return f"{settings.FRONTEND_URL}/{prefix}{FRONTEND_PATHS[purpose]}?token={token}"


def send_token_email(*, to: str, purpose: str, token: str, locale: str | None) -> None:
    language = email_language(locale)
    copy = COPY[purpose][language]
    context = {**copy, "url": action_url(purpose, token, locale), "lang": language}
    message = EmailMultiAlternatives(
        subject=copy["subject"],
        body=render_to_string("accounts/email/action.txt", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to],
    )
    message.attach_alternative(render_to_string("accounts/email/action.html", context), "text/html")
    message.send()

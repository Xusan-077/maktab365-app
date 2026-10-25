from django.conf import settings
from django.urls import path

from . import auth_views, social_views, telegram_login_views
from .views import ExportView, MeView, OnboardingView, RoleView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/onboarding/", OnboardingView.as_view(), name="me-onboarding"),
    path("me/role/", RoleView.as_view(), name="me-role"),
    path("me/export/", ExportView.as_view(), name="me-export"),
    path("me/identities/", social_views.IdentityListView.as_view(), name="me-identities"),
    path(
        "me/identities/<uuid:identity_id>/",
        social_views.IdentityDetailView.as_view(),
        name="me-identity",
    ),
    path(
        "me/identities/<str:provider>/",
        social_views.IdentityLinkView.as_view(),
        name="me-identity-link",
    ),
    path("me/password/set/", social_views.PasswordSetView.as_view(), name="me-password-set"),
    path("auth/google/", social_views.GoogleLoginView.as_view(), name="auth-google"),
    path("auth/telegram/", social_views.TelegramLoginView.as_view(), name="auth-telegram"),
    path(
        "auth/telegram/start/",
        telegram_login_views.TelegramLoginStartView.as_view(),
        name="auth-telegram-start",
    ),
    path(
        "auth/telegram/status/",
        telegram_login_views.TelegramLoginStatusView.as_view(),
        name="auth-telegram-status",
    ),
    path(
        "auth/telegram/complete/",
        telegram_login_views.TelegramLoginCompleteView.as_view(),
        name="auth-telegram-complete",
    ),
    path(
        "auth/telegram/webhook/",
        telegram_login_views.TelegramWebhookView.as_view(),
        name="auth-telegram-webhook",
    ),
    path("auth/otp/request/", social_views.OtpRequestView.as_view(), name="auth-otp-request"),
    path("auth/otp/verify/", social_views.OtpVerifyView.as_view(), name="auth-otp-verify"),
    path("auth/register/", auth_views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", auth_views.LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", auth_views.RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", auth_views.LogoutView.as_view(), name="auth-logout"),
    path("auth/logout-all/", auth_views.LogoutAllView.as_view(), name="auth-logout-all"),
    path("auth/email/verify/", auth_views.EmailVerifyView.as_view(), name="auth-email-verify"),
    path("auth/email/resend/", auth_views.EmailResendView.as_view(), name="auth-email-resend"),
    path(
        "auth/password/forgot/",
        auth_views.PasswordForgotView.as_view(),
        name="auth-password-forgot",
    ),
    path(
        "auth/password/reset/", auth_views.PasswordResetView.as_view(), name="auth-password-reset"
    ),
    path(
        "auth/password/change/",
        auth_views.PasswordChangeView.as_view(),
        name="auth-password-change",
    ),
]

if settings.OTP_DEV_INBOX:
    from .dev_views import DevOtpInboxView

    urlpatterns += [path("dev/otp/", DevOtpInboxView.as_view(), name="dev-otp-inbox")]

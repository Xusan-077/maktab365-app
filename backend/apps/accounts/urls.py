from django.urls import path

from . import auth_views
from .views import ExportView, MeView, OnboardingView, RoleView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/onboarding/", OnboardingView.as_view(), name="me-onboarding"),
    path("me/role/", RoleView.as_view(), name="me-role"),
    path("me/export/", ExportView.as_view(), name="me-export"),
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

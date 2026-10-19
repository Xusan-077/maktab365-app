from django.urls import path

from .views import ExportView, MeView, OnboardingView, RoleView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/onboarding/", OnboardingView.as_view(), name="me-onboarding"),
    path("me/role/", RoleView.as_view(), name="me-role"),
    path("me/export/", ExportView.as_view(), name="me-export"),
]

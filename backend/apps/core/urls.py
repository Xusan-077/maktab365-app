from django.urls import include, path

from .views import HealthView

urlpatterns = [
    path("", include("apps.accounts.urls")),
    path("health/", HealthView.as_view(), name="health"),
]

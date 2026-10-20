from django.urls import path

from .views import MySupportListView, SupportCreateView

urlpatterns = [
    path("support/", SupportCreateView.as_view(), name="support-create"),
    path("me/support/", MySupportListView.as_view(), name="me-support"),
]

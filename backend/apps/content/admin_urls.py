from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.accounts.admin_user_views import UserAdminViewSet
from apps.analytics.views import AdminStatsView
from apps.support.admin_views import SupportAdminViewSet

from . import admin_views as views
from .pdf_admin_views import PdfBookAdminViewSet

router = SimpleRouter()
router.register("subjects", views.SubjectAdminViewSet, basename="admin-subject")
router.register("users", UserAdminViewSet, basename="admin-user")
router.register("pdf-books", PdfBookAdminViewSet, basename="admin-pdf-book")
router.register("support", SupportAdminViewSet, basename="admin-support")

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="admin-dashboard"),
    path("stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("uploads/", views.UploadView.as_view(), name="admin-upload"),
    path("", include(router.urls)),
]

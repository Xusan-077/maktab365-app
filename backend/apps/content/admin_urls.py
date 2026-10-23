from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.accounts.admin_user_views import UserAdminViewSet

from . import admin_views as views
from .pdf_admin_views import PdfBookAdminViewSet

router = SimpleRouter()
router.register("subjects", views.SubjectAdminViewSet, basename="admin-subject")
router.register("users", UserAdminViewSet, basename="admin-user")
router.register("pdf-books", PdfBookAdminViewSet, basename="admin-pdf-book")

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="admin-dashboard"),
    path("uploads/", views.UploadView.as_view(), name="admin-upload"),
    path("", include(router.urls)),
]

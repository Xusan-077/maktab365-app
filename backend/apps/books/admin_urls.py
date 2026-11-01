from django.urls import path
from rest_framework.routers import SimpleRouter

from .admin_library import AdminLibraryView
from .admin_views import BookAdminViewSet, BookTypeAdminViewSet

router = SimpleRouter()
router.register("book-types", BookTypeAdminViewSet, basename="admin-book-type")
router.register("books", BookAdminViewSet, basename="admin-book")

urlpatterns = [
    path("library/", AdminLibraryView.as_view(), name="admin-library"),
    *router.urls,
]

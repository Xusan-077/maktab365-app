from rest_framework.routers import SimpleRouter

from .admin_views import BookAdminViewSet

router = SimpleRouter()
router.register("books", BookAdminViewSet, basename="admin-book")

urlpatterns = router.urls

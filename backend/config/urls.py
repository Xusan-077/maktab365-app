from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

handler404 = "apps.core.views.not_found"
handler500 = "apps.core.views.server_error"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.core.urls")),
    path("api/v1/admin/", include("apps.content.admin_urls")),
    path("api/v1/admin/", include("apps.games.admin_urls")),
    path("api/v1/admin/", include("apps.books.admin_urls")),
    path("api/v1/", include("apps.content.urls")),
    path("api/v1/", include("apps.learning.urls")),
    path("api/v1/", include("apps.support.urls")),
    path("api/v1/", include("apps.analytics.urls")),
    path("api/v1/", include("apps.games.urls")),
    path("api/v1/", include("apps.quizzes.urls")),
    path("api/v1/", include("apps.books.urls")),
]

# Dev: yuklangan fayllar (muqova rasmlari) lokal `media/` dan beriladi; prod'da S3-mos saqlash.
if settings.DEBUG:
    from django.conf.urls.static import static

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Sxema va Swagger faqat dev'da (prod'da API tuzilmasi ochilmaydi).
if getattr(settings, "ENABLE_API_DOCS", False):
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    ]

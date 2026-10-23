from django.urls import path

from . import bot_views, pdf_views

urlpatterns = [
    path("bot/books/", bot_views.BotSearchView.as_view(), name="bot-books"),
    path("pdf-books/", pdf_views.PdfBookListView.as_view(), name="pdf-books"),
    path(
        "pdf-books/subjects/", pdf_views.PdfBookSubjectListView.as_view(), name="pdf-book-subjects"
    ),
    path("pdf-books/search/", pdf_views.PdfChapterSearchView.as_view(), name="pdf-chapter-search"),
    path(
        "pdf-books/by-slug/<slug:slug>/",
        pdf_views.PdfBookBySlugView.as_view(),
        name="pdf-book-by-slug",
    ),
    path("pdf-books/<uuid:pk>/", pdf_views.PdfBookDetailView.as_view(), name="pdf-book"),
    path(
        "pdf-books/<uuid:pk>/download/",
        pdf_views.PdfDownloadView.as_view(),
        name="pdf-book-download",
    ),
    path(
        "pdf-books/<uuid:pk>/file-url/",
        pdf_views.PdfFileUrlView.as_view(),
        name="pdf-book-file-url",
    ),
    path("pdf-books/<uuid:pk>/file/", pdf_views.PdfFileView.as_view(), name="pdf-book-file"),
    path(
        "pdf-books/<uuid:pk>/chapters/<uuid:chapter_id>/slides/",
        pdf_views.PdfChapterSlidesUrlView.as_view(),
        name="pdf-chapter-slides-url",
    ),
    path(
        "pdf-books/<uuid:pk>/chapters/<uuid:chapter_id>/slides/file/",
        pdf_views.PdfChapterSlidesFileView.as_view(),
        name="pdf-chapter-slides-file",
    ),
]

from django.urls import path

from . import pdf_views

urlpatterns = [
    path("pdf-books/", pdf_views.PdfBookListView.as_view(), name="pdf-books"),
    path(
        "pdf-books/subjects/", pdf_views.PdfBookSubjectListView.as_view(), name="pdf-book-subjects"
    ),
    path("pdf-books/<uuid:pk>/", pdf_views.PdfBookDetailView.as_view(), name="pdf-book"),
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

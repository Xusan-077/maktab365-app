from django.urls import path

from . import views

urlpatterns = [
    path("me/pdf-progress/", views.PdfProgressListView.as_view(), name="me-pdf-progress"),
    path(
        "me/pdf-progress/<str:pdf_book_id>/",
        views.PdfProgressDetailView.as_view(),
        name="me-pdf-progress-detail",
    ),
    path("me/pdf-bookmarks/", views.PdfBookmarkListView.as_view(), name="me-pdf-bookmarks"),
    path(
        "me/pdf-bookmarks/<str:pdf_book_id>/",
        views.PdfBookmarkDetailView.as_view(),
        name="me-pdf-bookmark",
    ),
    path("me/library/", views.LibraryView.as_view(), name="me-library"),
    path("me/merge-guest-data/", views.MergeGuestDataView.as_view(), name="me-merge-guest-data"),
]

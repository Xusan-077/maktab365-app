from django.urls import path

from . import pdf_views, views

urlpatterns = [
    path("grades/", views.GradeListView.as_view(), name="grades"),
    path("subjects/", views.SubjectListView.as_view(), name="subjects"),
    path("books/", views.BookListView.as_view(), name="books"),
    path("books/<slug:slug>/", views.BookDetailView.as_view(), name="book"),
    path("books/<slug:book>/topics/<slug:topic>/", views.TopicDetailView.as_view(), name="topic"),
    path("search/", views.SearchView.as_view(), name="search"),
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
]

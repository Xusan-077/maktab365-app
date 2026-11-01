from django.urls import path

from . import annotation_views, entry_views, me_views, testmode_views, views

urlpatterns = [
    path("books/", views.BookListView.as_view(), name="books-list"),
    path("book-types/", views.BookTypeListView.as_view(), name="book-types"),
    path("books/by-slug/<slug:slug>/", views.BookBySlugView.as_view(), name="books-by-slug"),
    path("books/<uuid:pk>/", views.BookDetailView.as_view(), name="books-detail"),
    path("books/<uuid:pk>/file-url/", views.BookFileUrlView.as_view(), name="books-file-url"),
    path("books/<uuid:pk>/file/", views.BookFileView.as_view(), name="books-file"),
    path("books/<uuid:pk>/pages/", views.BookPagesView.as_view(), name="books-pages"),
    path(
        "books/<uuid:pk>/pages/<int:number>/text/",
        views.BookPageTextView.as_view(),
        name="books-page-text",
    ),
    path("books/<uuid:pk>/search/", views.BookSearchView.as_view(), name="books-search"),
    path(
        "me/books/progress/",
        me_views.MyBookProgressListView.as_view(),
        name="me-books-progress",
    ),
    path(
        "me/books/<uuid:pk>/progress/",
        me_views.MyBookProgressView.as_view(),
        name="me-books-progress-detail",
    ),
    path(
        "me/books/<uuid:pk>/bookmarks/",
        me_views.MyBookmarksView.as_view(),
        name="me-books-bookmarks",
    ),
    path(
        "me/books/<uuid:pk>/bookmarks/<int:page>/",
        me_views.MyBookmarkDetailView.as_view(),
        name="me-books-bookmark",
    ),
    path(
        "me/books/<uuid:pk>/pages/<int:number>/notes/",
        annotation_views.MyPageNoteView.as_view(),
        name="me-books-note",
    ),
    path(
        "me/books/<uuid:pk>/pages/<int:number>/annotations/",
        annotation_views.MyPageAnnotationsView.as_view(),
        name="me-books-page-annotations",
    ),
    path(
        "me/books/<uuid:pk>/annotations/",
        annotation_views.MyAnnotationsView.as_view(),
        name="me-books-annotations",
    ),
    path(
        "me/books/<uuid:pk>/annotations/<uuid:annotation_id>/",
        annotation_views.MyAnnotationDetailView.as_view(),
        name="me-books-annotation",
    ),
    path(
        "me/annotations/",
        entry_views.MyEntriesView.as_view(),
        name="me-annotations",
    ),
    path(
        "me/annotations/books/",
        entry_views.MyEntryBooksView.as_view(),
        name="me-annotations-books",
    ),
    path(
        "me/books/<uuid:pk>/test/",
        testmode_views.MyTestSheetView.as_view(),
        name="me-books-test",
    ),
    path(
        "me/books/<uuid:pk>/test/answer/",
        testmode_views.MyTestAnswerView.as_view(),
        name="me-books-test-answer",
    ),
    path(
        "me/books/<uuid:pk>/test/check/",
        testmode_views.MyTestCheckView.as_view(),
        name="me-books-test-check",
    ),
    path(
        "me/books/<uuid:pk>/test/attempts/",
        testmode_views.MyTestAttemptsView.as_view(),
        name="me-books-test-attempts",
    ),
    path(
        "me/books/<uuid:pk>/test/attempts/<uuid:attempt_id>/",
        testmode_views.MyTestAttemptDetailView.as_view(),
        name="me-books-test-attempt",
    ),
]

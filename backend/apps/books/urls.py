from django.urls import path

from . import me_views, views

urlpatterns = [
    path("books/", views.BookListView.as_view(), name="books-list"),
    path("books/<uuid:pk>/", views.BookDetailView.as_view(), name="books-detail"),
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
]

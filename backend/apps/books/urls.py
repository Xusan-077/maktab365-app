from django.urls import path

from . import views

urlpatterns = [
    path("books/", views.BookListView.as_view(), name="books-list"),
    path("books/<uuid:pk>/", views.BookDetailView.as_view(), name="books-detail"),
    path("books/<uuid:pk>/pages/", views.BookPagesView.as_view(), name="books-pages"),
]

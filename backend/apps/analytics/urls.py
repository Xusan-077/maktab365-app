from django.urls import path

from . import views

urlpatterns = [
    path("pdf-books/<uuid:pk>/stats/", views.BookStatEventView.as_view(), name="pdf-book-stats"),
]

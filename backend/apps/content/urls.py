from django.urls import path

from . import views

urlpatterns = [
    path("grades/", views.GradeListView.as_view(), name="grades"),
    path("subjects/", views.SubjectListView.as_view(), name="subjects"),
    path("books/", views.BookListView.as_view(), name="books"),
    path("books/<slug:slug>/", views.BookDetailView.as_view(), name="book"),
    path("books/<slug:book>/topics/<slug:topic>/", views.TopicDetailView.as_view(), name="topic"),
    path("search/", views.SearchView.as_view(), name="search"),
]

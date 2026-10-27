from django.urls import path

from . import views

urlpatterns = [
    path("games/topics/", views.GameTopicListView.as_view(), name="games-topics"),
    path(
        "games/topics/<slug:slug>/questions/",
        views.GameQuestionsView.as_view(),
        name="games-topic-questions",
    ),
    path("games/check/", views.CheckAnswerView.as_view(), name="games-check"),
    path("games/allowance/", views.AllowanceView.as_view(), name="games-allowance"),
    path("games/sessions/", views.SessionStartView.as_view(), name="games-sessions"),
    path(
        "games/sessions/<uuid:pk>/finish/",
        views.SessionFinishView.as_view(),
        name="games-session-finish",
    ),
]

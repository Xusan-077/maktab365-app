from django.urls import path

from . import views

urlpatterns = [
    path("quizzes/", views.QuizListCreateView.as_view(), name="quizzes"),
    path("quizzes/categories/", views.CategoryListCreateView.as_view(), name="quiz-categories"),
    path("quizzes/uploads/", views.UploadView.as_view(), name="quiz-uploads"),
    path("quizzes/public/<uuid:pk>/", views.PublicQuizView.as_view(), name="quiz-public"),
    path(
        "quizzes/public/<uuid:pk>/check/",
        views.PublicCheckView.as_view(),
        name="quiz-public-check",
    ),
    path("quizzes/<uuid:pk>/", views.QuizDetailView.as_view(), name="quiz"),
    path("quizzes/<uuid:pk>/duplicate/", views.QuizDuplicateView.as_view(), name="quiz-duplicate"),
    path(
        "quizzes/<uuid:pk>/attempts/", views.AttemptListCreateView.as_view(), name="quiz-attempts"
    ),
]

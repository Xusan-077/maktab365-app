from django.urls import path

from . import admin_views as views

question = views.QuestionAdminViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    path(
        "topics/<uuid:topic_id>/questions/",
        views.TopicQuestionsView.as_view(),
        name="admin-topic-questions",
    ),
    path(
        "topics/<uuid:topic_id>/questions/reorder/",
        views.TopicQuestionsReorderView.as_view(),
        name="admin-topic-questions-reorder",
    ),
    path(
        "topics/<uuid:topic_id>/questions/import/",
        views.TopicQuestionsImportView.as_view(),
        name="admin-topic-questions-import",
    ),
    path("questions/<uuid:pk>/", question, name="admin-question"),
]

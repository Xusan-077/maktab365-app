from django.urls import path

from . import views

urlpatterns = [
    path("me/progress/", views.ProgressListView.as_view(), name="me-progress"),
    path(
        "me/progress/<str:topic_id>/", views.ProgressDetailView.as_view(), name="me-progress-detail"
    ),
    path("me/events/", views.EventView.as_view(), name="me-events"),
    path("me/bookmarks/", views.BookmarkView.as_view(), name="me-bookmarks"),
    path("me/recent/", views.RecentListView.as_view(), name="me-recent"),
    path("me/goals/", views.GoalListView.as_view(), name="me-goals"),
    path("me/goals/<uuid:goal_id>/", views.GoalDetailView.as_view(), name="me-goal"),
    path("me/dashboard/", views.DashboardView.as_view(), name="me-dashboard"),
    path("me/results/", views.ResultsView.as_view(), name="me-results"),
    path(
        "me/teacher/dashboard/", views.TeacherDashboardView.as_view(), name="me-teacher-dashboard"
    ),
    path("me/merge-guest-data/", views.MergeGuestDataView.as_view(), name="me-merge-guest-data"),
]

"""Maintenance URL configuration."""

from django.urls import path

from apps.maintenance import views

app_name = "maintenance"

urlpatterns = [
    path("report/", views.ReportIssueView.as_view(), name="report"),
    path("mine/", views.TenantIssueListView.as_view(), name="my_issues"),
    path("triage/", views.OwnerTriageListView.as_view(), name="triage"),
    path("<int:pk>/", views.IssueDetailView.as_view(), name="detail"),
    path("<int:pk>/status/", views.UpdateIssueStatusView.as_view(), name="update_status"),
    path("<int:pk>/follow-up/", views.AddFollowUpView.as_view(), name="follow_up"),
]

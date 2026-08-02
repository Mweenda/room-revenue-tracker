"""Revenue URL configuration."""

from django.urls import path

from apps.revenue import views

app_name = "revenue"

urlpatterns = [
    path("summary/", views.RevenueSummaryView.as_view(), name="summary"),
    path("submit/", views.PaymentSubmissionView.as_view(), name="submit_payment"),
    path("history/", views.PaymentHistoryView.as_view(), name="history"),
    path("pending/", views.PendingVerificationQueueView.as_view(), name="pending_queue"),
    path("payments/<int:pk>/", views.PaymentDetailView.as_view(), name="payment_detail"),
    path("payments/<int:pk>/verify/", views.PaymentVerifyView.as_view(), name="verify"),
    path("payments/<int:pk>/reject/", views.PaymentRejectView.as_view(), name="reject"),
    path(
        "payments/<int:pk>/resubmit/",
        views.PaymentResubmitView.as_view(),
        name="resubmit",
    ),
]

"""Utilities URL configuration."""

from django.urls import path

from apps.utilities import views

app_name = "utilities"

urlpatterns = [
    path("portal/", views.UtilityPortalView.as_view(), name="portal"),
    path("readings/new/", views.MeterReadingCreateView.as_view(), name="submit_reading"),
    path("bills/<int:pk>/pay/", views.MarkUtilityPaidView.as_view(), name="mark_paid"),
]

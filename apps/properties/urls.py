"""Property URL configuration."""

from django.urls import path

from apps.properties import views

app_name = "properties"

urlpatterns = [
    path("occupancy/", views.OccupancyDashboardView.as_view(), name="occupancy"),
]

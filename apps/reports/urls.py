"""Reports URL configuration."""

from django.urls import path

from apps.reports import views

app_name = "reports"

urlpatterns = [
    path("", views.ReportsHomeView.as_view(), name="home"),
    path("export/ledger/", views.LedgerExportView.as_view(), name="export_ledger"),
    path(
        "export/occupancy/",
        views.OccupancyExportView.as_view(),
        name="export_occupancy",
    ),
    path("export/utility/", views.UtilityExportView.as_view(), name="export_utility"),
    path(
        "export/maintenance/",
        views.MaintenanceExportView.as_view(),
        name="export_maintenance",
    ),
]

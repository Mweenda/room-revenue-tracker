"""Core URL configuration."""

from django.urls import path

from apps.core import views

app_name = "core"

urlpatterns = [
    path("", views.HomeView.as_view(), name="home"),
    path("post-login/", views.PostLoginRedirectView.as_view(), name="post_login_redirect"),
    path("dashboard/owner/", views.OwnerDashboardView.as_view(), name="owner_dashboard"),
    path("dashboard/tenant/", views.TenantDashboardView.as_view(), name="tenant_dashboard"),
    path("dashboard/staff/", views.StaffDashboardView.as_view(), name="staff_dashboard"),
    path("health/", views.HealthCheckView.as_view(), name="health"),
]

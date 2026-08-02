"""Tenant URL configuration."""

from django.urls import path

from apps.tenants import views

app_name = "tenants"

urlpatterns = [
    path("portal/", views.TenantPortalView.as_view(), name="portal"),
    path("onboard/", views.TenantOnboardingView.as_view(), name="onboard"),
]

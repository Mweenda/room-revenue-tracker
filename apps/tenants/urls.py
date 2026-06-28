"""Tenant app URL configuration."""

from django.urls import path
from .views import TenantPortalView

app_name = 'tenants'

urlpatterns = [
    path('portal/', TenantPortalView.as_view(), name='portal'),
]

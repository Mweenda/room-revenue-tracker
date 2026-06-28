"""Core views."""

from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect
from django.views.generic import TemplateView

from apps.accounts.models import User
from apps.core.mixins import RoleRequiredMixin


class PostLoginRedirectView(LoginRequiredMixin, TemplateView):
    """Redirect authenticated users to their role-specific dashboard."""

    def get(self, request, *args, **kwargs):
        role_urls = {
            User.OWNER: "core:owner_dashboard",
            User.TENANT: "core:tenant_dashboard",
            User.STAFF: "core:staff_dashboard",
        }
        url_name = role_urls.get(request.user.role, "core:owner_dashboard")
        return redirect(url_name)


class OwnerDashboardView(RoleRequiredMixin, TemplateView):
    template_name = "core/owner_dashboard.html"
    allowed_roles = (User.OWNER,)


class TenantDashboardView(RoleRequiredMixin, TemplateView):
    template_name = "core/tenant_dashboard.html"
    allowed_roles = (User.TENANT,)


class StaffDashboardView(RoleRequiredMixin, TemplateView):
    template_name = "core/staff_dashboard.html"
    allowed_roles = (User.STAFF,)

"""Tenant portal views."""

from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from apps.core.mixins import RoleRequiredMixin


class TenantPortalView(RoleRequiredMixin, TemplateView):
    """Tenant portal showing personal contract details."""

    allowed_roles = ['tenant']
    template_name = 'tenants/portal.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if hasattr(self.request.user, 'tenantprofile'):
            context['profile'] = self.request.user.tenantprofile
        return context

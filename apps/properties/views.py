"""Property management views."""

from django.views.generic import ListView
from apps.core.mixins import RoleRequiredMixin
from apps.properties.models import Block


class OccupancyDashboardView(RoleRequiredMixin, ListView):
    """Dashboard showing occupancy status across all blocks."""

    allowed_roles = ['owner', 'staff']
    model = Block
    template_name = 'properties/dashboard.html'
    context_object_name = 'blocks'

    def get_queryset(self):
        return Block.objects.prefetch_related(
            'rooms__bed_spaces__tenant_profiles__user'
        )

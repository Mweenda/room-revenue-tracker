"""Owner and tenant dashboard views with KPIs."""

import json
from decimal import Decimal

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Count, Prefetch, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import redirect
from django.utils import timezone
from django.views.generic import TemplateView

from apps.accounts.models import User
from apps.core.mixins import RoleRequiredMixin
from apps.maintenance.models import MaintenanceIssue
from apps.properties.models import BedSpace, Block, Room
from apps.revenue.models import PaymentRecord
from apps.revenue.services import monthly_block_revenue, monthly_revenue_totals
from apps.tenants.models import TenantProfile


class HomeView(TemplateView):
    """Landing page for the application."""
    template_name = "core/home.html"


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

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        today = timezone.localdate()
        totals = monthly_revenue_totals(today.year, today.month)

        total_rooms = Room.objects.count()
        occupied = BedSpace.objects.filter(is_occupied=True).count()
        vacant = BedSpace.objects.filter(is_occupied=False).count()
        open_issues = MaintenanceIssue.objects.filter(
            status__in=[MaintenanceIssue.OPEN, MaintenanceIssue.IN_PROGRESS]
        ).count()
        pending_count = PaymentRecord.objects.filter(
            status=PaymentRecord.PENDING
        ).count()

        chart_qs = (
            PaymentRecord.objects.filter(status=PaymentRecord.VERIFIED)
            .annotate(month=TruncMonth("submitted_at"))
            .values("month")
            .annotate(total=Sum("amount"))
            .order_by("month")
        )
        labels = []
        values = []
        by_month = {
            row["month"].date().replace(day=1): row["total"]
            for row in chart_qs
            if row["month"]
        }
        for i in range(11, -1, -1):
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            key = timezone.datetime(year, month, 1).date()
            labels.append(key.strftime("%b %Y"))
            values.append(float(by_month.get(key, Decimal("0"))))

        context.update(
            {
                **totals,
                "total_rooms": total_rooms,
                "occupied": occupied,
                "vacant": vacant,
                "open_issues": open_issues,
                "pending_count": pending_count,
                "block_breakdown": monthly_block_revenue(today.year, today.month),
                "blocks": Block.objects.prefetch_related(
                    Prefetch(
                        "rooms__bed_spaces",
                        queryset=BedSpace.objects.select_related("room").prefetch_related(
                            Prefetch(
                                "tenant_profiles",
                                queryset=TenantProfile.objects.filter(
                                    move_out_date__isnull=True
                                ).select_related("user"),
                            )
                        ),
                    )
                ),
                "recent_payments": PaymentRecord.objects.select_related(
                    "tenant__user", "bed_space"
                ).order_by("-submitted_at")[:10],
                "recent_issues": MaintenanceIssue.objects.select_related(
                    "bed_space", "reported_by"
                ).order_by("-created_at")[:5],
                "chart_labels_json": json.dumps(labels),
                "chart_values_json": json.dumps(values),
                "issues_by_block": (
                    MaintenanceIssue.objects.filter(
                        status__in=[
                            MaintenanceIssue.OPEN,
                            MaintenanceIssue.IN_PROGRESS,
                        ]
                    )
                    .values("bed_space__room__block__code")
                    .annotate(count=Count("id"))
                ),
            }
        )
        return context


class TenantDashboardView(RoleRequiredMixin, TemplateView):
    """Redirect tenants to the enriched portal."""

    allowed_roles = (User.TENANT,)
    template_name = "core/tenant_dashboard.html"

    def get(self, request, *args, **kwargs):
        return redirect("tenants:portal")


class StaffDashboardView(RoleRequiredMixin, TemplateView):
    template_name = "core/staff_dashboard.html"
    allowed_roles = (User.STAFF,)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["pending_count"] = PaymentRecord.objects.filter(
            status=PaymentRecord.PENDING
        ).count()
        context["open_issues"] = MaintenanceIssue.objects.filter(
            status__in=[MaintenanceIssue.OPEN, MaintenanceIssue.IN_PROGRESS]
        ).count()
        return context


class HealthCheckView(TemplateView):
    """GET /health/ — DB connectivity status."""

    def get(self, request, *args, **kwargs):
        from django.db import connection
        from django.http import JsonResponse

        try:
            connection.ensure_connection()
            return JsonResponse({"status": "ok", "database": "up"}, status=200)
        except Exception as exc:  # noqa: BLE001
            return JsonResponse(
                {"status": "error", "database": "down", "detail": str(exc)},
                status=503,
            )

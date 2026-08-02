"""Report export views — streaming CSV responses."""

from __future__ import annotations

import csv

from django.db.models import Prefetch
from django.http import StreamingHttpResponse
from django.views.generic import TemplateView, View

from apps.accounts.models import User
from apps.core.mixins import RoleRequiredMixin
from apps.maintenance.models import MaintenanceIssue
from apps.properties.models import BedSpace
from apps.revenue.models import PaymentRecord
from apps.tenants.models import TenantProfile
from apps.utilities.models import MeterReading


class Echo:
    def write(self, value):
        return value


class ReportsHomeView(RoleRequiredMixin, TemplateView):
    allowed_roles = (User.OWNER, User.STAFF)
    template_name = "reports/home.html"


class LedgerExportView(RoleRequiredMixin, View):
    allowed_roles = (User.OWNER, User.STAFF)

    def get(self, request):
        qs = PaymentRecord.objects.select_related(
            "tenant__user",
            "bed_space",
        ).order_by("submitted_at")
        start = request.GET.get("start")
        end = request.GET.get("end")
        if start:
            qs = qs.filter(submitted_at__date__gte=start)
        if end:
            qs = qs.filter(submitted_at__date__lte=end)

        def rows():
            pseudo = Echo()
            writer = csv.writer(pseudo)
            yield writer.writerow(
                [
                    "bed_space",
                    "tenant",
                    "amount",
                    "method",
                    "status",
                    "date",
                    "transaction_ref",
                ]
            )
            for payment in qs.iterator():
                yield writer.writerow(
                    [
                        payment.bed_space.identifier,
                        payment.tenant.user.get_full_name()
                        or payment.tenant.user.username,
                        str(payment.amount),
                        payment.payment_method,
                        payment.status,
                        payment.submitted_at.date().isoformat(),
                        payment.transaction_ref,
                    ]
                )

        response = StreamingHttpResponse(rows(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="ledger_export.csv"'
        return response


class OccupancyExportView(RoleRequiredMixin, View):
    allowed_roles = (User.OWNER, User.STAFF)

    def get(self, request):
        qs = BedSpace.objects.select_related("room__block").prefetch_related(
            Prefetch(
                "tenant_profiles",
                queryset=TenantProfile.objects.filter(
                    move_out_date__isnull=True
                ).select_related("user"),
            )
        )

        def rows():
            pseudo = Echo()
            writer = csv.writer(pseudo)
            yield writer.writerow(
                ["identifier", "block", "room", "label", "occupied", "tenant"]
            )
            for bed in qs:
                profile = next(iter(bed.tenant_profiles.all()), None)
                tenant_name = ""
                if profile:
                    tenant_name = profile.user.get_full_name() or profile.user.username
                yield writer.writerow(
                    [
                        bed.identifier,
                        bed.room.block.code,
                        bed.room.number,
                        bed.label,
                        "yes" if bed.is_occupied else "no",
                        tenant_name,
                    ]
                )

        response = StreamingHttpResponse(rows(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="occupancy_export.csv"'
        return response


class UtilityExportView(RoleRequiredMixin, View):
    allowed_roles = (User.OWNER, User.STAFF)

    def get(self, request):
        start = request.GET.get("start")
        end = request.GET.get("end")
        readings = MeterReading.objects.select_related("block").prefetch_related(
            "bills__tenant__user"
        )
        if start:
            readings = readings.filter(reading_date__gte=start)
        if end:
            readings = readings.filter(reading_date__lte=end)

        def rows():
            pseudo = Echo()
            writer = csv.writer(pseudo)
            yield writer.writerow(
                [
                    "block",
                    "reading_date",
                    "total_cost",
                    "tenant",
                    "owner_share",
                    "tenant_excess",
                    "is_paid",
                ]
            )
            for reading in readings:
                bills = list(reading.bills.all())
                if not bills:
                    yield writer.writerow(
                        [
                            reading.block.code,
                            reading.reading_date.isoformat(),
                            str(reading.total_cost),
                            "",
                            "",
                            "",
                            "",
                        ]
                    )
                for bill in bills:
                    yield writer.writerow(
                        [
                            reading.block.code,
                            reading.reading_date.isoformat(),
                            str(reading.total_cost),
                            bill.tenant.user.get_full_name()
                            or bill.tenant.user.username,
                            str(bill.owner_share),
                            str(bill.tenant_excess),
                            "yes" if bill.is_paid else "no",
                        ]
                    )

        response = StreamingHttpResponse(rows(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="utility_export.csv"'
        return response


class MaintenanceExportView(RoleRequiredMixin, View):
    allowed_roles = (User.OWNER, User.STAFF)

    def get(self, request):
        qs = MaintenanceIssue.objects.select_related(
            "bed_space",
            "reported_by",
        ).order_by("created_at")

        def rows():
            pseudo = Echo()
            writer = csv.writer(pseudo)
            yield writer.writerow(
                [
                    "bed_space",
                    "category",
                    "title",
                    "status",
                    "created_at",
                    "resolved_at",
                    "resolution_hours",
                ]
            )
            for issue in qs.iterator():
                hours = ""
                if issue.resolved_at:
                    delta = issue.resolved_at - issue.created_at
                    hours = round(delta.total_seconds() / 3600, 1)
                yield writer.writerow(
                    [
                        issue.bed_space.identifier,
                        issue.category,
                        issue.title,
                        issue.status,
                        issue.created_at.isoformat(),
                        issue.resolved_at.isoformat() if issue.resolved_at else "",
                        hours,
                    ]
                )

        response = StreamingHttpResponse(rows(), content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="maintenance_export.csv"'
        )
        return response

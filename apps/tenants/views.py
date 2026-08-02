"""Tenant portal and onboarding views."""

import logging

from django.contrib import messages
from django.core.mail import send_mail
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views.generic import CreateView, TemplateView

from apps.accounts.models import User
from apps.core.mixins import RoleRequiredMixin
from apps.tenants.forms import TenantOnboardingForm

logger = logging.getLogger(__name__)


class TenantPortalView(RoleRequiredMixin, TemplateView):
    """Tenant portal showing personal contract and related data."""

    allowed_roles = (User.TENANT,)
    template_name = "tenants/portal.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = getattr(self.request.user, "tenantprofile", None)
        context["profile"] = profile
        if profile:
            from apps.maintenance.models import MaintenanceIssue
            from apps.revenue.models import PaymentRecord
            from apps.utilities.models import UtilityBill

            context["payments"] = (
                PaymentRecord.objects.filter(tenant=profile)
                .select_related("bed_space")
                .order_by("-submitted_at")[:6]
            )
            context["last_payment"] = context["payments"][0] if context["payments"] else None
            context["utility_bills"] = (
                UtilityBill.objects.filter(tenant=profile)
                .select_related("meter_reading")
                .order_by("-meter_reading__reading_date")[:5]
            )
            context["open_issues"] = MaintenanceIssue.objects.filter(
                reported_by=self.request.user,
                status__in=[
                    MaintenanceIssue.OPEN,
                    MaintenanceIssue.IN_PROGRESS,
                ],
            ).order_by("-created_at")[:10]
            unpaid = UtilityBill.objects.filter(tenant=profile, is_paid=False)
            context["outstanding_utility"] = sum(
                (bill.tenant_excess for bill in unpaid),
                start=0,
            )
        return context


class TenantOnboardingView(RoleRequiredMixin, CreateView):
    """Owner-only tenant creation flow."""

    allowed_roles = (User.OWNER,)
    form_class = TenantOnboardingForm
    template_name = "tenants/onboard.html"
    success_url = reverse_lazy("properties:occupancy")

    def form_valid(self, form):
        response = super().form_valid(form)
        password = getattr(self.object, "_generated_password", None)
        user = self.object.user
        send_mail(
            subject=_("Welcome to Room Revenue Tracker"),
            message=_(
                "Hello %(name)s,\n\n"
                "Your tenant account has been created.\n"
                "Username: %(username)s\n"
                "Temporary password: %(password)s\n"
                "Please log in and change your password.\n"
            )
            % {
                "name": user.get_full_name() or user.username,
                "username": user.username,
                "password": password or _("(provided separately)"),
            },
            from_email=None,
            recipient_list=[user.email],
            fail_silently=True,
        )
        logger.info("Welcome credentials emailed to tenant %s", user.email)
        messages.success(
            self.request,
            _("Tenant %(name)s onboarded successfully.")
            % {"name": user.get_full_name() or user.username},
        )
        return response

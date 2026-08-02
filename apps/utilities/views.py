"""Utility portal forms and views."""

from django import forms
from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views.generic import CreateView, ListView, TemplateView, View

from apps.accounts.models import User
from apps.core.mixins import RoleRequiredMixin
from apps.utilities.models import MeterReading, UtilityBill


class MeterReadingForm(forms.ModelForm):
    class Meta:
        model = MeterReading
        fields = ["reading_date", "units_used", "cost_per_unit"]
        widgets = {
            "reading_date": forms.DateInput(
                attrs={"type": "date", "class": "w-full p-2 border rounded min-h-[44px]"}
            ),
            "units_used": forms.NumberInput(
                attrs={"class": "w-full p-2 border rounded min-h-[44px]", "step": "0.01"}
            ),
            "cost_per_unit": forms.NumberInput(
                attrs={"class": "w-full p-2 border rounded min-h-[44px]", "step": "0.01"}
            ),
        }


class UtilityPortalView(RoleRequiredMixin, TemplateView):
    allowed_roles = (User.TENANT,)
    template_name = "utilities/portal.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = self.request.user.tenantprofile
        block = profile.bed_space.room.block if profile.bed_space else None
        context["profile"] = profile
        context["block"] = block
        if block:
            reading = (
                MeterReading.objects.filter(block=block)
                .prefetch_related("bills")
                .order_by("-reading_date", "-id")
                .first()
            )
            context["latest_reading"] = reading
            if reading:
                context["my_bill"] = UtilityBill.objects.filter(
                    meter_reading=reading,
                    tenant=profile,
                ).first()
            context["readings"] = MeterReading.objects.filter(block=block)[:10]
            context["my_bills"] = UtilityBill.objects.filter(tenant=profile).select_related(
                "meter_reading"
            )[:10]
        return context


class MeterReadingCreateView(RoleRequiredMixin, CreateView):
    allowed_roles = (User.TENANT,)
    model = MeterReading
    form_class = MeterReadingForm
    template_name = "utilities/submit_reading.html"
    success_url = reverse_lazy("utilities:portal")

    def form_valid(self, form):
        profile = self.request.user.tenantprofile
        if not profile.bed_space:
            messages.error(self.request, _("No bed space assigned."))
            return redirect("utilities:portal")
        form.instance.block = profile.bed_space.room.block
        form.instance.recorded_by = self.request.user
        messages.success(self.request, _("Meter reading submitted."))
        return super().form_valid(form)


class MarkUtilityPaidView(RoleRequiredMixin, View):
    allowed_roles = (User.TENANT,)

    def post(self, request, pk):
        bill = get_object_or_404(
            UtilityBill,
            pk=pk,
            tenant=request.user.tenantprofile,
        )
        bill.is_paid = True
        bill.save(update_fields=["is_paid"])
        messages.success(request, _("Utility excess marked as paid."))
        return redirect("utilities:portal")

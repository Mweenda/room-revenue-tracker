"""Revenue management views."""

from decimal import Decimal

from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.translation import gettext_lazy as _
from django.views.generic import CreateView, DetailView, ListView, View
from django_ratelimit.decorators import ratelimit

from apps.accounts.models import User
from apps.core.mixins import RoleRequiredMixin
from apps.properties.models import Block
from apps.revenue.forms import PaymentRejectForm, PaymentSubmissionForm
from apps.revenue.models import PaymentRecord
from apps.revenue.services import monthly_block_revenue, monthly_revenue_totals


class RevenueSummaryView(RoleRequiredMixin, ListView):
    """Revenue summary dashboard for owners."""

    allowed_roles = (User.OWNER,)
    model = PaymentRecord
    template_name = "revenue/summary.html"
    context_object_name = "payments"
    paginate_by = 20

    def get_queryset(self):
        return PaymentRecord.objects.select_related(
            "tenant__user",
            "bed_space__room__block",
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        today = timezone.localdate()
        totals = monthly_revenue_totals(today.year, today.month)
        context.update(totals)
        context["block_breakdown"] = monthly_block_revenue(today.year, today.month)
        return context


@method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True), name="dispatch")
class PaymentSubmissionView(RoleRequiredMixin, CreateView):
    """Payment submission form for tenants."""

    allowed_roles = (User.TENANT,)
    model = PaymentRecord
    form_class = PaymentSubmissionForm
    template_name = "revenue/submit_payment.html"
    success_url = reverse_lazy("tenants:portal")

    def dispatch(self, request, *args, **kwargs):
        profile = getattr(request.user, "tenantprofile", None)
        if not profile or not profile.bed_space_id:
            messages.error(request, _("No bed space assigned to your account."))
            return redirect("tenants:portal")
        return super().dispatch(request, *args, **kwargs)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        profile = self.request.user.tenantprofile
        kwargs["tenant"] = profile
        kwargs["bed_space"] = profile.bed_space
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, _("Payment submitted for verification."))
        return super().form_valid(form)


class PaymentHistoryView(RoleRequiredMixin, ListView):
    allowed_roles = (User.TENANT,)
    model = PaymentRecord
    template_name = "revenue/history.html"
    context_object_name = "payments"
    paginate_by = 20

    def get_queryset(self):
        profile = self.request.user.tenantprofile
        return PaymentRecord.objects.filter(tenant=profile).select_related("bed_space")


class PendingVerificationQueueView(RoleRequiredMixin, ListView):
    allowed_roles = (User.OWNER, User.STAFF)
    model = PaymentRecord
    template_name = "revenue/pending_queue.html"
    context_object_name = "payments"
    paginate_by = 20

    def get_queryset(self):
        qs = PaymentRecord.objects.filter(status=PaymentRecord.PENDING).select_related(
            "tenant__user",
            "bed_space__room__block",
        )
        block = self.request.GET.get("block")
        if block:
            qs = qs.filter(bed_space__room__block__code=block)
        sort = self.request.GET.get("sort", "-submitted_at")
        allowed = {
            "submitted_at",
            "-submitted_at",
            "amount",
            "-amount",
            "bed_space__room__block__code",
        }
        if sort in allowed:
            qs = qs.order_by(sort)
        return qs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["blocks"] = Block.objects.all()
        return context


class PaymentDetailView(RoleRequiredMixin, DetailView):
    allowed_roles = (User.OWNER, User.STAFF)
    model = PaymentRecord
    template_name = "revenue/payment_detail.html"
    context_object_name = "payment"

    def get_queryset(self):
        return PaymentRecord.objects.select_related(
            "tenant__user",
            "bed_space__room__block",
            "verified_by",
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["reject_form"] = PaymentRejectForm()
        return context


class PaymentVerifyView(RoleRequiredMixin, View):
    allowed_roles = (User.OWNER, User.STAFF)

    def post(self, request, pk):
        payment = get_object_or_404(PaymentRecord, pk=pk, status=PaymentRecord.PENDING)
        payment.verify(request.user)
        messages.success(request, _("Payment verified."))
        return redirect("revenue:pending_queue")


class PaymentRejectView(RoleRequiredMixin, View):
    allowed_roles = (User.OWNER, User.STAFF)

    def post(self, request, pk):
        payment = get_object_or_404(PaymentRecord, pk=pk, status=PaymentRecord.PENDING)
        form = PaymentRejectForm(request.POST)
        if form.is_valid():
            payment.reject(request.user, form.cleaned_data["rejection_reason"])
            messages.warning(request, _("Payment rejected."))
            return redirect("revenue:pending_queue")
        messages.error(request, _("Please provide a rejection reason."))
        return redirect("revenue:payment_detail", pk=pk)


class PaymentResubmitView(RoleRequiredMixin, CreateView):
    allowed_roles = (User.TENANT,)
    model = PaymentRecord
    form_class = PaymentSubmissionForm
    template_name = "revenue/submit_payment.html"
    success_url = reverse_lazy("tenants:portal")

    def dispatch(self, request, *args, **kwargs):
        self.original = get_object_or_404(
            PaymentRecord,
            pk=kwargs["pk"],
            tenant=request.user.tenantprofile,
            status=PaymentRecord.REJECTED,
        )
        return super().dispatch(request, *args, **kwargs)

    def get_initial(self):
        return {
            "amount": self.original.amount,
            "payment_method": self.original.payment_method,
        }

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        profile = self.request.user.tenantprofile
        kwargs["tenant"] = profile
        kwargs["bed_space"] = profile.bed_space
        kwargs["resubmit_of"] = self.original
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, _("Payment resubmitted for verification."))
        return super().form_valid(form)

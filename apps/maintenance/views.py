"""Maintenance forms and views."""

from django import forms
from django.contrib import messages
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views.generic import CreateView, DetailView, FormView, ListView

from apps.accounts.models import User
from apps.core.mixins import RoleRequiredMixin
from apps.maintenance.models import IssueComment, IssuePhoto, MaintenanceIssue
from apps.properties.models import Block


class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        single = super().clean
        if isinstance(data, (list, tuple)):
            return [single(d, initial) for d in data]
        return [single(data, initial)]


class MaintenanceReportForm(forms.ModelForm):
    photos = MultipleFileField(required=False)

    class Meta:
        model = MaintenanceIssue
        fields = ["category", "title", "description"]
        widgets = {
            "category": forms.Select(attrs={"class": "w-full p-2 border rounded min-h-[44px]"}),
            "title": forms.TextInput(attrs={"class": "w-full p-2 border rounded min-h-[44px]"}),
            "description": forms.Textarea(
                attrs={"class": "w-full p-2 border rounded", "rows": 4}
            ),
        }

    def clean_photos(self):
        photos = self.cleaned_data.get("photos") or []
        photos = [p for p in photos if p]
        if len(photos) > 3:
            raise forms.ValidationError(_("Maximum 3 photos per report"))
        for photo in photos:
            if photo.size > 5 * 1024 * 1024:
                raise forms.ValidationError(_("File too large. Maximum size is 5MB."))
        return photos


class StatusUpdateForm(forms.Form):
    status = forms.ChoiceField(choices=MaintenanceIssue.STATUS_CHOICES)
    resolution_note = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"class": "w-full p-2 border rounded", "rows": 3}),
    )


class FollowUpForm(forms.Form):
    body = forms.CharField(
        widget=forms.Textarea(attrs={"class": "w-full p-2 border rounded", "rows": 3}),
        label=_("Follow-up comment"),
    )


class ReportIssueView(RoleRequiredMixin, CreateView):
    allowed_roles = (User.TENANT,)
    model = MaintenanceIssue
    form_class = MaintenanceReportForm
    template_name = "maintenance/report.html"
    success_url = reverse_lazy("tenants:portal")

    def form_valid(self, form):
        profile = self.request.user.tenantprofile
        if not profile.bed_space:
            messages.error(self.request, _("No bed space assigned."))
            return redirect("tenants:portal")
        with transaction.atomic():
            form.instance.bed_space = profile.bed_space
            form.instance.reported_by = self.request.user
            self.object = form.save()
            for photo in form.cleaned_data.get("photos") or []:
                IssuePhoto.objects.create(issue=self.object, image=photo)
        messages.success(self.request, _("Maintenance issue reported."))
        return redirect(self.success_url)


class TenantIssueListView(RoleRequiredMixin, ListView):
    allowed_roles = (User.TENANT,)
    model = MaintenanceIssue
    template_name = "maintenance/my_issues.html"
    context_object_name = "issues"
    paginate_by = 20

    def get_queryset(self):
        return MaintenanceIssue.objects.filter(
            reported_by=self.request.user
        ).prefetch_related("photos")


class OwnerTriageListView(RoleRequiredMixin, ListView):
    allowed_roles = (User.OWNER, User.STAFF)
    model = MaintenanceIssue
    template_name = "maintenance/triage.html"
    context_object_name = "issues"
    paginate_by = 20

    def get_queryset(self):
        qs = MaintenanceIssue.objects.select_related(
            "bed_space__room__block",
            "reported_by",
        ).prefetch_related("photos")
        block = self.request.GET.get("block")
        category = self.request.GET.get("category")
        status = self.request.GET.get("status")
        if block:
            qs = qs.filter(bed_space__room__block__code=block)
        if category:
            qs = qs.filter(category=category)
        if status:
            qs = qs.filter(status=status)
        sort = self.request.GET.get("sort", "-created_at")
        if sort in {"created_at", "-created_at", "status", "-status"}:
            qs = qs.order_by(sort)
        return qs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["blocks"] = Block.objects.all()
        context["categories"] = MaintenanceIssue.CATEGORY_CHOICES
        context["statuses"] = MaintenanceIssue.STATUS_CHOICES
        return context


class IssueDetailView(RoleRequiredMixin, DetailView):
    allowed_roles = (User.OWNER, User.STAFF, User.TENANT)
    model = MaintenanceIssue
    template_name = "maintenance/detail.html"
    context_object_name = "issue"

    def get_queryset(self):
        qs = MaintenanceIssue.objects.select_related(
            "bed_space__room__block",
            "reported_by",
        ).prefetch_related("photos", "comments__author")
        if self.request.user.role == User.TENANT:
            qs = qs.filter(reported_by=self.request.user)
        return qs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["status_form"] = StatusUpdateForm(initial={"status": self.object.status})
        context["follow_up_form"] = FollowUpForm()
        return context


class UpdateIssueStatusView(RoleRequiredMixin, FormView):
    allowed_roles = (User.OWNER, User.STAFF)
    form_class = StatusUpdateForm

    def form_valid(self, form):
        issue = get_object_or_404(MaintenanceIssue, pk=self.kwargs["pk"])
        issue.update_status(
            form.cleaned_data["status"],
            form.cleaned_data.get("resolution_note", ""),
        )
        messages.success(self.request, _("Issue status updated."))
        return redirect("maintenance:detail", pk=issue.pk)

    def form_invalid(self, form):
        return redirect("maintenance:detail", pk=self.kwargs["pk"])


class AddFollowUpView(RoleRequiredMixin, FormView):
    allowed_roles = (User.TENANT,)
    form_class = FollowUpForm

    def form_valid(self, form):
        issue = get_object_or_404(
            MaintenanceIssue,
            pk=self.kwargs["pk"],
            reported_by=self.request.user,
        )
        IssueComment.objects.create(
            issue=issue,
            author=self.request.user,
            body=form.cleaned_data["body"],
        )
        messages.success(self.request, _("Follow-up comment added."))
        return redirect("maintenance:detail", pk=issue.pk)

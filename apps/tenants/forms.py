"""Tenant onboarding forms."""

from django import forms
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.crypto import get_random_string
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import User
from apps.properties.models import BedSpace
from apps.tenants.models import TenantProfile

UserModel = get_user_model()


class TenantOnboardingForm(forms.ModelForm):
    """Owner-only form to create a tenant and assign a bed space."""

    first_name = forms.CharField(max_length=150)
    last_name = forms.CharField(max_length=150)
    email = forms.EmailField()
    phone = forms.CharField(max_length=20)

    class Meta:
        model = TenantProfile
        fields = [
            "nrc_number",
            "emergency_contact",
            "bed_space",
            "move_in_date",
            "rent_amount",
        ]
        widgets = {
            "move_in_date": forms.DateInput(attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["bed_space"].queryset = BedSpace.objects.filter(
            is_occupied=False
        ).select_related("room__block")
        for field in self.fields.values():
            css = field.widget.attrs.get("class", "")
            field.widget.attrs["class"] = f"{css} w-full p-2 border rounded".strip()

    def clean_phone(self):
        phone = self.cleaned_data["phone"]
        if UserModel.objects.filter(phone=phone).exists():
            raise forms.ValidationError(_("A user with this phone already exists."))
        return phone

    def clean_email(self):
        email = self.cleaned_data["email"]
        if UserModel.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(_("A user with this email already exists."))
        return email

    @transaction.atomic
    def save(self, commit=True):
        password = get_random_string(10)
        username = self.cleaned_data["phone"].replace("+", "").replace(" ", "")
        user = UserModel.objects.create_user(
            username=username,
            email=self.cleaned_data["email"],
            password=password,
            phone=self.cleaned_data["phone"],
            first_name=self.cleaned_data["first_name"],
            last_name=self.cleaned_data["last_name"],
            role=User.TENANT,
        )
        profile = super().save(commit=False)
        profile.user = user
        if commit:
            profile.save()
        profile._generated_password = password  # noqa: SLF001
        return profile

"""Forms for revenue management."""

from django import forms
from django.utils.translation import gettext_lazy as _

from apps.core.utils import sanitize_image_upload
from apps.revenue.models import PaymentRecord


class PaymentSubmissionForm(forms.ModelForm):
    """Form for tenants to submit payment proof."""

    class Meta:
        model = PaymentRecord
        fields = ["amount", "payment_method", "transaction_ref", "proof_image"]
        widgets = {
            "amount": forms.NumberInput(
                attrs={"class": "w-full p-2 border rounded min-h-[44px]", "step": "0.01"}
            ),
            "payment_method": forms.Select(
                attrs={"class": "w-full p-2 border rounded min-h-[44px]"}
            ),
            "transaction_ref": forms.TextInput(
                attrs={"class": "w-full p-2 border rounded min-h-[44px]"}
            ),
            "proof_image": forms.ClearableFileInput(
                attrs={
                    "class": "w-full p-2 border rounded min-h-[44px]",
                    "accept": "image/jpeg,image/png",
                }
            ),
        }

    def __init__(self, *args, **kwargs):
        self.tenant = kwargs.pop("tenant", None)
        self.bed_space = kwargs.pop("bed_space", None)
        self.resubmit_of = kwargs.pop("resubmit_of", None)
        super().__init__(*args, **kwargs)
        self.fields["payment_method"].choices = PaymentRecord.METHOD_CHOICES

    def clean_proof_image(self):
        image = self.cleaned_data["proof_image"]
        return sanitize_image_upload(image)

    def save(self, commit=True):
        instance = super().save(commit=False)
        if self.tenant:
            instance.tenant = self.tenant
        if self.bed_space:
            instance.bed_space = self.bed_space
        instance.status = PaymentRecord.PENDING
        if commit:
            instance.save()
        return instance


class PaymentRejectForm(forms.Form):
    rejection_reason = forms.CharField(
        widget=forms.Textarea(
            attrs={"class": "w-full p-2 border rounded", "rows": 3}
        ),
        label=_("Rejection reason"),
    )

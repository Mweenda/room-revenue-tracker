"""Test suite for revenue ledger and payment verification."""

from decimal import Decimal
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image

from apps.revenue.models import PaymentRecord
from apps.revenue.services import monthly_block_revenue, monthly_revenue_totals
from apps.revenue.tasks import send_payment_reminders


def _make_proof(name="proof.jpg"):
    buf = BytesIO()
    Image.new("RGB", (10, 10), color="red").save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/jpeg")


@pytest.mark.django_db
class TestRevenueLedgerAutomations:

    def test_payment_submission_creates_pending_record(self, client, tenant_profile_factory):
        profile = tenant_profile_factory()
        client.force_login(profile.user)

        response = client.post(
            reverse("revenue:submit_payment"),
            {
                "amount": "1500.00",
                "payment_method": "airtel",
                "transaction_ref": "TXN12345678",
                "proof_image": _make_proof(),
            },
        )
        assert response.status_code == 302

        payment = PaymentRecord.objects.get(transaction_ref="TXN12345678")
        assert payment.status == PaymentRecord.PENDING
        assert payment.tenant == profile
        assert payment.proof_image

    def test_payment_proof_file_size_limit(self, client, tenant_profile_factory):
        profile = tenant_profile_factory()
        client.force_login(profile.user)

        buf = BytesIO()
        Image.new("RGB", (3000, 3000), color="red").save(buf, format="JPEG", quality=95)
        data = buf.getvalue()
        if len(data) < 6 * 1024 * 1024:
            data += b"x" * (6 * 1024 * 1024 - len(data))
        large_file = SimpleUploadedFile("test.jpg", data, content_type="image/jpeg")

        response = client.post(
            reverse("revenue:submit_payment"),
            {
                "amount": "1500.00",
                "payment_method": "mtn",
                "transaction_ref": "TXN87654321",
                "proof_image": large_file,
            },
        )
        assert response.status_code == 200
        errors = str(response.context["form"].errors.get("proof_image", "")).lower()
        assert "file too large" in errors or "maximum size" in errors

    def test_owner_rejects_payment(self, client, owner_user, tenant_profile_factory):
        profile = tenant_profile_factory()
        payment = PaymentRecord.objects.create(
            tenant=profile,
            bed_space=profile.bed_space,
            amount=Decimal("1500.00"),
            payment_method="airtel",
            transaction_ref="TXNREJECT1",
            proof_image=_make_proof("reject.jpg"),
        )
        client.force_login(owner_user)
        response = client.post(
            reverse("revenue:reject", args=[payment.pk]),
            {"rejection_reason": "Blurry proof"},
        )
        assert response.status_code == 302
        payment.refresh_from_db()
        assert payment.status == PaymentRecord.REJECTED
        assert payment.rejection_reason == "Blurry proof"

    def test_tenant_can_resubmit_rejected_payment(self, client, tenant_profile_factory):
        profile = tenant_profile_factory()
        PaymentRecord.objects.create(
            tenant=profile,
            bed_space=profile.bed_space,
            amount=Decimal("1500.00"),
            payment_method="airtel",
            transaction_ref="TXNOLD1",
            proof_image=_make_proof("old.jpg"),
            status=PaymentRecord.REJECTED,
            rejection_reason="Try again",
        )
        rejected = PaymentRecord.objects.get(transaction_ref="TXNOLD1")
        client.force_login(profile.user)
        response = client.post(
            reverse("revenue:resubmit", args=[rejected.pk]),
            {
                "amount": "1500.00",
                "payment_method": "mtn",
                "transaction_ref": "TXNNEW1",
                "proof_image": _make_proof("new.jpg"),
            },
        )
        assert response.status_code == 302
        assert PaymentRecord.objects.filter(transaction_ref="TXNNEW1").exists()

    def test_monthly_revenue_totals(self, tenant_profile_factory):
        profile = tenant_profile_factory(rent_amount=Decimal("1000.00"))
        PaymentRecord.objects.create(
            tenant=profile,
            bed_space=profile.bed_space,
            amount=Decimal("700.00"),
            payment_method="airtel",
            transaction_ref="TXNVER1",
            proof_image=_make_proof("v1.jpg"),
            status=PaymentRecord.VERIFIED,
        )
        today = timezone.localdate()
        totals = monthly_revenue_totals(today.year, today.month)
        assert totals["expected_revenue"] >= Decimal("1000.00")
        assert totals["verified_revenue"] >= Decimal("700.00")

    def test_payment_reminder_task_is_idempotent(self, tenant_profile_factory):
        tenant_profile_factory()
        assert send_payment_reminders() >= 1
        assert send_payment_reminders() >= 1

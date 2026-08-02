"""Celery tasks for revenue reminders."""

from __future__ import annotations

import logging

from celery import shared_task
from django.core.mail import send_mail
from django.utils.translation import gettext as _

from apps.revenue.services import tenants_needing_payment_reminder

logger = logging.getLogger(__name__)


@shared_task(name="revenue.send_payment_reminders")
def send_payment_reminders() -> int:
    """Email tenants who still lack a verified payment this month.

    Idempotent: sending twice only re-notifies; it never creates duplicate payments.
    """
    tenants = tenants_needing_payment_reminder()
    sent = 0
    for profile in tenants:
        user = profile.user
        if not user.email:
            continue
        send_mail(
            subject=_("Rent payment reminder"),
            message=_(
                "Hello %(name)s,\n\n"
                "This is a reminder that your rent payment for this month "
                "has not been verified yet. Please submit payment via the portal.\n"
            )
            % {"name": user.get_full_name() or user.username},
            from_email=None,
            recipient_list=[user.email],
            fail_silently=True,
        )
        sent += 1
        logger.info("Payment reminder sent to %s", user.email)
    return sent

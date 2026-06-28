"""django-allauth customisations."""

from allauth.account.adapter import DefaultAccountAdapter


class AccountAdapter(DefaultAccountAdapter):
    """Extend allauth to support phone-based login identifiers."""

    def clean_username(self, username, shallow=False):
        return username

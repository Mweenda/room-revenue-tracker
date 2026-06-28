"""Role-based access mixins."""

from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin


class RoleRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    """Restrict a view to users with one of the allowed roles."""

    allowed_roles: tuple[str, ...] = ()

    def test_func(self) -> bool:
        return self.request.user.is_authenticated and self.request.user.role in self.allowed_roles

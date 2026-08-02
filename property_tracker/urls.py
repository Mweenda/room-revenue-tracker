"""Root URL configuration."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.views import HealthCheckView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("health/", HealthCheckView.as_view(), name="health"),
    path("", include("apps.core.urls")),
    path("properties/", include("apps.properties.urls")),
    path("tenants/", include("apps.tenants.urls")),
    path("revenue/", include("apps.revenue.urls")),
    path("utilities/", include("apps.utilities.urls")),
    path("maintenance/", include("apps.maintenance.urls")),
    path("reports/", include("apps.reports.urls")),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        import debug_toolbar

        urlpatterns = [
            path("__debug__/", include(debug_toolbar.urls)),
        ] + urlpatterns
    except ImportError:
        pass

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({"service": "support-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("sms-admin/", admin.site.urls),
    path("api/requests/", include("requests.urls")),
    path("api/form-builder/", include("form_builder.urls")),
]

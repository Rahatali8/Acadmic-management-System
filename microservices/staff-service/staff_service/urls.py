from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({"service": "staff-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("sms-admin/", admin.site.urls),
    path("api/", include("teachers.urls")),
    path("api/", include("coordinator.urls")),
    path("api/", include("principals.urls")),
]

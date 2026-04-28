from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({"service": "result-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("sms-admin/", admin.site.urls),
    path("api/result/", include("result.urls")),
    path("api/results/", include("result.urls")),
]

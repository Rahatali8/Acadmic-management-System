from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({"service": "attendance-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("sms-admin/", admin.site.urls),
    path("api/attendance/", include("attendance.urls")),
    # ZKTeco device endpoints — device pushes directly here
    path("iclock/cdata", include("attendance.urls_zkteco")),
    path("iclock/getrequest", include("attendance.urls_zkteco")),
    path("iclock/registry", include("attendance.urls_zkteco")),
    path("iclock/push", include("attendance.urls_zkteco")),
]

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({"service": "timetable-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("sms-admin/", admin.site.urls),
    path("api/timetable/", include("timetable.urls")),
    path("api/transfers/", include("transfers.urls")),
]

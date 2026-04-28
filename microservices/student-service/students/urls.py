from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet, student_my_profile, student_upload_photo,
    StudentBulkUploadView, StudentBulkUploadTemplateView,
)

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')

urlpatterns = [
    # Student self-profile (must be BEFORE router.urls to avoid pk collision)
    path("students/my-profile/", student_my_profile, name='student_my_profile'),
    path("students/upload-photo/", student_upload_photo, name='student_upload_photo'),
    path("students/bulk-upload/", StudentBulkUploadView.as_view(), name='student_bulk_upload'),
    path("students/bulk-upload-template/", StudentBulkUploadTemplateView.as_view(), name='student_bulk_upload_template'),
    path("", include(router.urls)),
]

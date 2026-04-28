from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ResultViewSet,
    TeacherResultListView,
    CoordinatorResultListView,
    CheckMidTermView,
    ResultSubmitView,
    ResultApprovalView,
    PrincipalResultApprovalView,
    CalculatePositionsView,
    BulkApproveView,
    BulkRejectView,
    PrincipalResultStatsView,
    ResultsBulkUploadView,
    SampleTemplateView,
    SampleMonthlyTemplateView,
    SampleMidTemplateView,
    SampleFinalTemplateView,
    AvailableSubjectsView,
    TeacherSubjectsDebugView,
    PromoteStudentsView,
    # New views (Tasks 3, 4, 7)
    CoordinatorApproveResultView,
    CoordinatorRejectResultView,
    PrincipalApproveResultView,
    PrincipalRejectResultView,
    StudentMyResultsView,
)

router = DefaultRouter()
router.register(r'', ResultViewSet)

urlpatterns = [
    path('promote-students/', PromoteStudentsView.as_view(), name='promote-students'),
    path('create/', TeacherResultListView.as_view(), name='teacher-result-create'),
    path('my-results/', TeacherResultListView.as_view(), name='teacher-my-results'),

    # Student portal
    path('student/my-results/', StudentMyResultsView.as_view(), name='student-my-results'),

    # Coordinator endpoints
    path('coordinator/pending/', CoordinatorResultListView.as_view(), name='coordinator-pending-results'),
    path('coordinator/results/', CoordinatorResultListView.as_view(), name='coordinator-results'),
    path('coordinator/bulk-approve/', BulkApproveView.as_view(), name='coordinator-bulk-approve'),
    path('coordinator/bulk-reject/', BulkRejectView.as_view(), name='coordinator-bulk-reject'),
    path('coordinator/approve/<int:pk>/', CoordinatorApproveResultView.as_view(), name='coordinator-approve-result'),
    path('coordinator/reject/<int:pk>/', CoordinatorRejectResultView.as_view(), name='coordinator-reject-result'),

    # Principal endpoints
    path('principal/stats/', PrincipalResultStatsView.as_view(), name='principal-result-stats'),
    path('principal/approve/<int:pk>/', PrincipalApproveResultView.as_view(), name='principal-approve-result'),
    path('principal/reject/<int:pk>/', PrincipalRejectResultView.as_view(), name='principal-reject-result'),
    # Legacy principal approve (keep existing for backward compat)
    path('principal/<int:pk>/approve/', PrincipalResultApprovalView.as_view(), name='principal-result-approve'),

    # Other
    path('calculate-positions/', CalculatePositionsView.as_view(), name='calculate-positions'),
    path('bulk-upload/', ResultsBulkUploadView.as_view(), name='results-bulk-upload'),
    path('bulk-upload', ResultsBulkUploadView.as_view()),
    path('sample-template/', SampleTemplateView.as_view(), name='results-sample-template'),
    path('sample-template-monthly/', SampleMonthlyTemplateView.as_view(), name='results-sample-template-monthly'),
    path('sample-template-mid/', SampleMidTemplateView.as_view(), name='results-sample-template-mid'),
    path('sample-template-final/', SampleFinalTemplateView.as_view(), name='results-sample-template-final'),
    path('sample-template', SampleTemplateView.as_view()),
    path('sample-template-monthly', SampleMonthlyTemplateView.as_view()),
    path('sample-template-mid', SampleMidTemplateView.as_view()),
    path('sample-template-final', SampleFinalTemplateView.as_view()),
    path('debug-teacher-subjects/', TeacherSubjectsDebugView.as_view(), name='debug-teacher-subjects'),
    path('debug-teacher-subjects', TeacherSubjectsDebugView.as_view()),
    path('check-midterm/<int:student_id>/', CheckMidTermView.as_view(), name='check-midterm'),
    path('available-subjects/', AvailableSubjectsView.as_view(), name='available-subjects'),
    path('<int:pk>/submit/', ResultSubmitView.as_view(), name='result-submit'),
    path('<int:pk>/approve/', ResultApprovalView.as_view(), name='result-approve'),
    path('', include(router.urls)),
]

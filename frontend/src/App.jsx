import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useAuth } from './context/AuthContext.jsx';

// Layouts
import StudentLayout from './layouts/StudentLayout.jsx';
import InstructorLayout from './layouts/InstructorLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import MainLayout from './layouts/MainLayout.jsx';

// Public & Auth Pages
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import { ForgotPassword, ResetPassword } from './pages/auth/RecoveryPage.jsx';
import { VerifyEmailPage } from './pages/auth/AuthExtras.jsx';
import CertificateVerificationPage from './pages/public/CertificateVerificationPage.jsx';

// Student Portal Pages
import StudentDashboardPage from './pages/student/DashboardPage.jsx';
import ExploreProgramsPage from './pages/student/ExploreProgramsPage.jsx';
import CourseCatalogPage from './pages/student/CourseCatalogPage.jsx';
import CourseDetailsPage from './pages/student/CourseDetailsPage.jsx';
import CourseFitPage from './pages/student/CourseFitPage.jsx';
import ApplicationsPage from './pages/student/ApplicationsPage.jsx';
import MyApplicationsPage from './pages/student/MyApplicationsPage.jsx';
import ApplicationDetailPage from './pages/student/ApplicationDetailPage.jsx';
import FoundationReviewPage from './pages/student/FoundationReviewPage.jsx';
import ApplicationWizardPage from './pages/student/ApplicationWizardPage.jsx';
import TrainingPage from './pages/student/TrainingPage.jsx';
import EnrollmentsPage from './pages/student/EnrollmentsPage.jsx';
import StudentAttendancePage from './pages/student/AttendancePage.jsx';
import StudentAssessmentsPage from './pages/student/AssessmentsPage.jsx';
import ReadinessStartPage from './pages/student/ReadinessStartPage.jsx';
import ReadinessAssessmentPage from './pages/student/ReadinessAssessmentPage.jsx';
import ReadinessResultPage from './pages/student/ReadinessResultPage.jsx';
import StudentProgressPage from './pages/student/ProgressPage.jsx';
import GoalPage from './pages/student/GoalPage.jsx';
import LearningPathPage from './pages/student/LearningPathPage.jsx';
import EvaluationPage from './pages/student/EvaluationPage.jsx';
import CourseEvaluationPage from './pages/student/CourseEvaluationPage.jsx';
import PaymentsPage from './pages/student/PaymentsPage.jsx';
import MockCheckoutPage from './pages/student/MockCheckoutPage.jsx';
import MediaPage from './pages/student/MediaPage.jsx';
import CertificatePage from './pages/student/CertificatePage.jsx';
import StudentNotificationsPage from './pages/student/NotificationsPage.jsx';
import StudentProfilePage from './pages/student/ProfilePage.jsx';

// Instructor Portal Pages
import InstructorDashboard from './pages/instructor/Dashboard.jsx';
import { CoursesPage as InstructorCoursesPage, CourseDetail as InstructorCourseDetail } from './pages/instructor/Courses.jsx';
import { CohortsPage as InstructorCohortsPage, CohortDetail as InstructorCohortDetail } from './pages/instructor/Cohorts.jsx';
import { SessionsPage as InstructorSessionsPage, SessionDetail as InstructorSessionDetail } from './pages/instructor/Sessions.jsx';
import { StudentsPage as InstructorStudentsPage, StudentProfile as InstructorStudentProfile } from './pages/instructor/Students.jsx';
import InstructorAttendancePage from './pages/instructor/Attendance.jsx';
import {
  AssessmentsPage as InstructorAssessmentsPage,
  AssessmentForm as InstructorAssessmentForm,
  AssessmentDetail as InstructorAssessmentDetail,
  AssessmentSubmissions as InstructorAssessmentSubmissions,
} from './pages/instructor/Assessments.jsx';
import { SubmissionsPage as InstructorSubmissionsPage, SubmissionDetail as InstructorSubmissionDetail } from './pages/instructor/Submissions.jsx';
import InstructorProgressPage from './pages/instructor/Progress.jsx';
import InstructorNotificationsPage from './pages/instructor/Notifications.jsx';
import InstructorProfilePage from './pages/instructor/Profile.jsx';
import MessagesPage from './pages/instructor/Messages.jsx';
import GradebookPage from './pages/instructor/GradebookPage.jsx';

// Admin Portal Pages
import AdminGatewayPage from './pages/admin/AdminGatewayPage.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import DivisionOverviewPage from './pages/admin/DivisionOverviewPage.jsx';
import ProgramsPage from './pages/admin/ProgramsPage.jsx';
import AdminCohortsPage from './pages/admin/AdminCohortsPage.jsx';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage.jsx';
import AdminAdmissionsPage from './pages/admin/AdminAdmissionsPage.jsx';
import StudentsListPage from './pages/admin/StudentsListPage.jsx';
import StudentDetailPage from './pages/admin/StudentDetailPage.jsx';
import AdminAttendancePage from './pages/admin/AdminAttendancePage.jsx';
import AdminAssessmentsPage from './pages/admin/AdminAssessmentsPage.jsx';
import AdminCertificatesPage from './pages/admin/AdminCertificatesPage.jsx';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage.jsx';
import AdminMediaPage from './pages/admin/AdminMediaPage.jsx';
import AdminManagementPage from './pages/admin/AdminManagementPage.jsx';
import InstructorManagementPage from './pages/admin/InstructorManagementPage.jsx';
import AuditLogsPage from './pages/admin/AuditLogsPage.jsx';
import FinancePage from './pages/admin/FinancePage.jsx';
import ReportsPage from './pages/admin/ReportsPage.jsx';
import FeedbackPage from './pages/admin/FeedbackPage.jsx';
import AdminReadinessPage from './pages/admin/AdminReadinessPage.jsx';
import SuperAdminDashboardPage from './pages/admin/SuperAdminDashboardPage.jsx';

function SmartRootRedirect() {
  const { user, booting } = useAuth();
  if (booting) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  const role = user.role?.toLowerCase() || '';
  if (role === 'instructor') return <Navigate to="/instructor/dashboard" replace />;
  if (role.includes('admin')) return <Navigate to="/admin" replace />;
  return <Navigate to="/student/dashboard" replace />;
}

function ProtectedRoute({ allowedRoles, children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = user.role?.toLowerCase() || '';
    const hasRole = allowedRoles.some((r) => role.includes(r.toLowerCase()));
    if (!hasRole) {
      return (
        <div className="p-5 text-center">
          <h4>Access Restricted</h4>
          <p className="text-muted">You do not have permission to access this portal.</p>
        </div>
      );
    }
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Root Intelligent Router */}
      <Route path="/" element={<SmartRootRedirect />} />

      {/* Public Authentication Flow (Benchmark Instructor Layout) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/verify-certificate/:certNumber" element={<CertificateVerificationPage />} />
      <Route path="/verify-certificate" element={<CertificateVerificationPage />} />

      {/* Student Portal Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={['student', 'admin']}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboardPage />} />
        <Route path="programs" element={<Navigate to="/student/catalog" replace />} />
        <Route path="explore" element={<Navigate to="/student/catalog" replace />} />
        <Route path="courses" element={<CourseCatalogPage />} />
        <Route path="catalog" element={<CourseCatalogPage />} />
        <Route path="courses/:id" element={<CourseDetailsPage />} />
        <Route path="catalog/:id" element={<CourseDetailsPage />} />
        <Route path="courses/:id/apply" element={<ApplicationWizardPage />} />
        <Route path="apply/:courseId" element={<ApplicationWizardPage />} />
        <Route path="courses/:id/fit" element={<CourseFitPage />} />
        <Route path="fit-check/:courseId" element={<CourseFitPage />} />
        <Route path="applications" element={<MyApplicationsPage />} />
        <Route path="my-applications" element={<MyApplicationsPage />} />
        <Route path="applications/:id" element={<ApplicationDetailPage />} />
        <Route path="applications/:id/foundation" element={<FoundationReviewPage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="enrollments" element={<EnrollmentsPage />} />
        <Route path="attendance" element={<StudentAttendancePage />} />
        <Route path="assessments" element={<StudentAssessmentsPage />} />
        <Route path="readiness" element={<Navigate to="/student/catalog" replace />} />
        <Route path="readiness/start" element={<Navigate to="/student/catalog" replace />} />
        <Route path="readiness/:attemptId" element={<ReadinessAssessmentPage />} />
        <Route path="readiness/:attemptId/result" element={<ReadinessResultPage />} />
        <Route path="progress" element={<StudentProgressPage />} />
        <Route path="goal" element={<GoalPage />} />
        <Route path="learning-path" element={<LearningPathPage />} />
        <Route path="evaluation" element={<CourseEvaluationPage />} />
        <Route path="evaluation/:cohortId" element={<CourseEvaluationPage />} />
        <Route path="evaluations" element={<CourseEvaluationPage />} />
        <Route path="evaluations/:cohortId" element={<CourseEvaluationPage />} />
        <Route path="feedback" element={<EvaluationPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="payments/mock-checkout" element={<MockCheckoutPage />} />
        <Route path="checkout/:invoiceId" element={<MockCheckoutPage />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="certificates" element={<CertificatePage />} />
        <Route path="certificates/:id" element={<CertificatePage />} />
        <Route path="notifications" element={<StudentNotificationsPage />} />
        <Route path="profile" element={<StudentProfilePage />} />
      </Route>

      {/* Instructor Portal Routes (Benchmark) */}
      <Route
        path="/instructor"
        element={
          <ProtectedRoute allowedRoles={['instructor', 'admin']}>
            <InstructorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<InstructorDashboard />} />
        <Route path="courses" element={<InstructorCoursesPage />} />
        <Route path="courses/:id" element={<InstructorCourseDetail />} />
        <Route path="cohorts" element={<InstructorCohortsPage />} />
        <Route path="cohorts/:id" element={<InstructorCohortDetail />} />
        <Route path="sessions" element={<InstructorSessionsPage />} />
        <Route path="sessions/:id" element={<InstructorSessionDetail />} />
        <Route path="students" element={<InstructorStudentsPage />} />
        <Route path="students/:id" element={<InstructorStudentProfile />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:conversationId" element={<MessagesPage />} />
        <Route path="attendance" element={<InstructorAttendancePage />} />
        <Route path="assessments" element={<InstructorAssessmentsPage />} />
        <Route path="assessments/new" element={<InstructorAssessmentForm />} />
        <Route path="assessments/:id" element={<InstructorAssessmentDetail />} />
        <Route path="assessments/:id/edit" element={<InstructorAssessmentForm />} />
        <Route path="assessments/:id/submissions" element={<InstructorAssessmentSubmissions />} />
        <Route path="submissions" element={<InstructorSubmissionsPage />} />
        <Route path="submissions/:id" element={<InstructorSubmissionDetail />} />
        <Route path="gradebook" element={<GradebookPage />} />
        <Route path="cohorts/:cohortId/gradebook" element={<GradebookPage />} />
        <Route path="progress" element={<InstructorProgressPage />} />
        <Route path="notifications" element={<InstructorNotificationsPage />} />
        <Route path="profile" element={<InstructorProfilePage />} />
      </Route>

      {/* Admin Division Gateway (Landing & In-Place Authentication) */}
      <Route path="/admin" element={<AdminGatewayPage />} />
      <Route path="/admin/gateway" element={<AdminGatewayPage />} />

      {/* Admin Portal Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'pre_university_admin', 'university_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="super" element={<SuperAdminDashboardPage />} />
        <Route path="super/dashboard" element={<SuperAdminDashboardPage />} />
        <Route path="strategic" element={<SuperAdminDashboardPage />} />
        <Route path="division/:division" element={<DivisionOverviewPage />} />
        <Route path="PRE_UNIVERSITY" element={<DivisionOverviewPage />} />
        <Route path="UNIVERSITY" element={<DivisionOverviewPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="cohorts" element={<AdminCohortsPage />} />
        <Route path="training" element={<AdminCohortsPage />} />
        <Route path="admissions" element={<AdminAdmissionsPage />} />
        <Route path="applications" element={<AdminAdmissionsPage />} />
        <Route path="applications/overview" element={<AdminApplicationsPage />} />
        <Route path="readiness" element={<AdminReadinessPage />} />
        <Route path="students" element={<StudentsListPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="attendance" element={<AdminAttendancePage />} />
        <Route path="assessments" element={<AdminAssessmentsPage />} />
        <Route path="certificates" element={<AdminCertificatesPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="media" element={<AdminMediaPage />} />
        <Route path="administrators" element={<AdminManagementPage />} />
        <Route path="instructors" element={<InstructorManagementPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

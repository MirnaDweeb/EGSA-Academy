import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../../services/studentService';
import { attendanceService } from '../../services/studentPortalServices';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorState } from '../../components/StateComponents.jsx';

// Institutional Dashboard Subcomponents
import DashboardHero from '../../components/student/dashboard/DashboardHero.jsx';
import DashboardStats from '../../components/student/dashboard/DashboardStats.jsx';
import CurrentTrainingCard from '../../components/student/dashboard/CurrentTrainingCard.jsx';
import AdmissionsJourney from '../../components/student/dashboard/AdmissionsJourney.jsx';
import QuickActions from '../../components/student/dashboard/QuickActions.jsx';
import UpcomingItems from '../../components/student/dashboard/UpcomingItems.jsx';
import NotificationsPreview from '../../components/student/dashboard/NotificationsPreview.jsx';
import ActivityTimeline from '../../components/student/dashboard/ActivityTimeline.jsx';
import DashboardSkeleton from '../../components/student/dashboard/DashboardSkeleton.jsx';
import QRCheckInModal from '../../components/training/QRCheckInModal.jsx';

import './DashboardPage.css';

/**
 * Egyptian Space Agency — National Space Technology Training Platform
 * Student Operations & Academic Trajectory Dashboard
 */
export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const [data, setData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [myInvoices, setMyInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // QR Attendance Modal State
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedSessionForQR, setSelectedSessionForQR] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      dashboardService.get(),
      attendanceService.getStudentAttendance().catch(() => null),
      apiClient.get('/payments/my-invoices').catch(() => ({ data: { data: [] } })),
    ])
      .then(([dashRes, attRes, invRes]) => {
        setData(dashRes.data);
        setAttendanceData(attRes);
        setMyInvoices(invRes.data?.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Unable to retrieve academic records from Egyptian Space Agency servers.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const {
    profile,
    learningPath,
    currentApplication,
    applications = [],
    upcomingEnrollments = [],
    recommendations = [],
    notifications = [],
    unreadNotificationsCount = 0,
    certificates = [],
    certificatesCount = 0,
    upcomingSessions = [],
    upcomingAssessments = [],
    timeline = [],
  } = data;

  const progressPct =
    learningPath && learningPath.totalCourses > 0
      ? Math.round((learningPath.completedCount / learningPath.totalCourses) * 100)
      : 0;

  const activeApplicationsCount = applications.filter((a) =>
    [
      'Submitted',
      'Under Review',
      'Needs Information',
      'Readiness Required',
      'Manual Review',
      'Accepted',
      'Eligible - Payment Pending',
    ].includes(a.status)
  ).length;

  // Determine if there is an active urgent gate
  let urgentGate = null;
  if (
    currentApplication?.status === 'Accepted' ||
    currentApplication?.status === 'Eligible - Payment Pending'
  ) {
    urgentGate = {
      type: 'urgent',
      badge: 'ACTION REQUIRED',
      title: 'Tuition Settlement & Package Selection Required',
      message: `Your application for "${currentApplication.course?.title}" is accepted. Select logistics and confirm tuition.`,
      deadline: 'Pending Settle',
      actionLabel: 'Select Package & Pay',
      actionLink: '/student/payments',
    };
  } else if (currentApplication?.status === 'Readiness Required') {
    urgentGate = {
      type: 'urgent',
      badge: 'DIAGNOSTIC GATE',
      title: 'Prerequisite Readiness Assessment Required',
      message: `Complete the 10-question technical diagnostic for "${currentApplication.course?.title}" to advance review.`,
      deadline: 'Prerequisite Check',
      actionLabel: 'Start Readiness Test',
      actionLink: `/student/readiness/start?courseId=${currentApplication.course?._id}`,
    };
  }

  const hasPendingPayment =
    currentApplication?.status === 'Accepted' ||
    currentApplication?.status === 'Eligible - Payment Pending';
  const hasPendingReadiness = currentApplication?.status === 'Readiness Required';

  return (
    <div
      className="egsa-dashboard-root container-fluid px-3 px-lg-4 py-4"
      style={{ overflowX: 'hidden', width: '100%', maxWidth: '100%' }}
    >
      {/* 1. Dashboard Hero Section */}
      <DashboardHero
        user={authUser}
        profile={profile}
        currentApplication={currentApplication}
        upcomingEnrollments={upcomingEnrollments}
        urgentGate={urgentGate}
      />

      {/* 2. Key Academic & Training Statistics Grid */}
      <DashboardStats
        enrollmentsCount={upcomingEnrollments.length}
        applicationsCount={applications.length}
        activeApplicationsCount={activeApplicationsCount}
        attendanceData={attendanceData}
        progressPct={progressPct}
        learningPath={learningPath}
        certificatesCount={certificatesCount}
      />

      {/* 3. Main Dashboard 2-Column Grid */}
      <div className="row g-4">
        {/* Left Column: Core Training & Admissions (col-12 col-xl-8) */}
        <div className="col-12 col-xl-8">
          {/* Current Enrolled Program Card (or Polite Empty State) */}
          <CurrentTrainingCard
            enrollments={upcomingEnrollments}
            attendanceData={attendanceData}
            upcomingSessions={upcomingSessions}
            upcomingAssessments={upcomingAssessments}
            onMarkAttendance={(session) => {
              setSelectedSessionForQR(session);
              setIsQRModalOpen(true);
            }}
          />

          {/* Admissions Pipeline Journey Status */}
          <AdmissionsJourney application={currentApplication} />

          {/* Active Invoices & Commercial Tuition Card */}
          {myInvoices.length > 0 && (
            <div className="egsa-institutional-card mb-4" aria-labelledby="invoices-heading">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="card-header-icon-pill"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: 'rgba(30, 124, 133, 0.1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#1E7C85' }}></i>
                  </span>
                  <div>
                    <h6 id="invoices-heading" className="fw-bold mb-0 text-dark">
                      Tuition Invoices & Deadlines
                    </h6>
                    <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                      Commercial Payment & 72-Hour Seat Holds
                    </span>
                  </div>
                </div>
                <Link
                  to="/student/payments"
                  className="btn btn-sm btn-link text-decoration-none p-0 fw-semibold"
                  style={{ color: '#1E7C85' }}
                >
                  Manage Invoices &rarr;
                </Link>
              </div>

              <div className="d-flex flex-column gap-3">
                {myInvoices.slice(0, 3).map((inv) => {
                  const isPaid = ['Paid', 'PAID'].includes(inv.status);
                  const isWaived = inv.status === 'Waived';
                  const isOverdue = inv.countdown?.isOverdue;
                  const isUrgent = inv.countdown?.isUrgent;

                  return (
                    <div
                      key={inv._id}
                      className="p-3 rounded border d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3"
                      style={{
                        backgroundColor: isUrgent
                          ? 'rgba(223, 79, 76, 0.04)'
                          : isOverdue
                          ? 'rgba(100, 116, 139, 0.05)'
                          : isPaid || isWaived
                          ? 'rgba(30, 124, 133, 0.04)'
                          : '#FFFFFF',
                        borderColor: isUrgent
                          ? '#DF4F4C'
                          : isPaid || isWaived
                          ? '#1E7C85'
                          : '#CBD5E1',
                      }}
                    >
                      <div className="d-flex flex-column">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="fw-bold text-dark">{inv.invoiceNumber}</span>
                          <span
                            className="badge rounded-pill fw-bold"
                            style={{
                              backgroundColor: isPaid || isWaived
                                ? '#1E7C85'
                                : isUrgent
                                ? '#DF4F4C'
                                : isOverdue
                                ? '#64748B'
                                : '#D4B87C',
                              color: isPaid || isWaived || isUrgent || isOverdue ? '#FFFFFF' : '#000000',
                              fontSize: '0.68rem',
                            }}
                          >
                            {inv.status}
                          </span>
                        </div>
                        <span className="text-muted small">
                          {inv.course?.title || 'EGSA Program'} {inv.cohort?.name ? `(${inv.cohort.name})` : ''}
                        </span>
                        {!isPaid && !isWaived && (
                          <span
                            className="small mt-1 fw-semibold"
                            style={{ color: isUrgent ? '#DF4F4C' : isOverdue ? '#64748B' : '#3A6985' }}
                          >
                            <i className="fa-regular fa-clock me-1"></i>
                            {inv.countdown?.formatted || '72-Hour Seat Window'}
                          </span>
                        )}
                      </div>

                      <div className="d-flex align-items-center gap-3">
                        <div className="text-md-end">
                          <div className="fw-bold text-dark fs-6">{inv.amount} EGP</div>
                          <div className="text-muted small" style={{ fontSize: '0.7rem' }}>
                            {isPaid || isWaived ? 'Zero Balance Due' : `Balance Due: ${inv.balanceDue != null ? inv.balanceDue : inv.amount} EGP`}
                          </div>
                        </div>
                        {!isPaid && !isWaived && !isOverdue && (
                          <Link
                            to="/student/payments"
                            className="btn btn-sm fw-bold px-3"
                            style={{
                              backgroundColor: '#1E7C85',
                              borderColor: '#1E7C85',
                              color: '#FFFFFF',
                            }}
                          >
                            Pay Now
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Curriculum Specialization Roadmap */}
          {learningPath && (
            <div className="egsa-institutional-card mb-4" aria-labelledby="roadmap-heading">
              <div className="card-header-clean">
                <div className="d-flex align-items-center gap-2">
                  <span className="card-header-icon-pill">
                    <i className="fa-solid fa-route text-secondary-egsa"></i>
                  </span>
                  <div>
                    <span className="card-overline">Specialization Trajectory</span>
                    <h2 id="roadmap-heading" className="card-heading-title">
                      Curriculum Track — {learningPath.title}
                    </h2>
                  </div>
                </div>
                <Link to="/student/learning-path" className="clean-action-link">
                  View Full Roadmap <i className="fa-solid fa-arrow-right ms-1"></i>
                </Link>
              </div>

              <div className="d-flex flex-wrap justify-content-between align-items-center text-muted small mb-2">
                <span>
                  {learningPath.completedCount} of {learningPath.totalCourses} courses completed in this specialization
                </span>
                <span className="fw-bold text-dark">{progressPct}% Complete</span>
              </div>

              <div className="training-progress-track" style={{ height: '8px' }}>
                <div
                  className="training-progress-fill fill-qualified"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Recommended Programs Based on Goal */}
          {recommendations?.length > 0 && (
            <div className="egsa-institutional-card" aria-labelledby="recommendations-heading">
              <div className="card-header-clean">
                <div className="d-flex align-items-center gap-2">
                  <span className="card-header-icon-pill">
                    <i className="fa-solid fa-wand-magic-sparkles text-accent-egsa"></i>
                  </span>
                  <div>
                    <span className="card-overline">Specialization Recommendations</span>
                    <h2 id="recommendations-heading" className="card-heading-title">
                      Courses Recommended for Your Trajectory
                    </h2>
                  </div>
                </div>
                <Link to="/student/catalog" className="clean-action-link">
                  Full Catalog <i className="fa-solid fa-arrow-right ms-1"></i>
                </Link>
              </div>

              <div className="row g-3">
                {recommendations.slice(0, 4).map((c) => (
                  <div key={c._id} className="col-md-6">
                    <div className="p-3 border rounded h-100 d-flex flex-column justify-content-between bg-surface-subtle">
                      <div>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <span className="code-pill">{c.level || 'Accredited'}</span>
                          <span className="fw-bold small text-accent-egsa">
                            {c.price != null ? `${c.price} EGP` : 'Tuition TBA'}
                          </span>
                        </div>
                        <h3 className="h6 fw-bold text-dark mb-1">{c.title}</h3>
                        <p className="text-muted small mb-3 text-truncate-2">
                          {c.shortDescription || c.overview || 'Comprehensive space technology training.'}
                        </p>
                      </div>
                      <div className="d-flex gap-2 mt-auto">
                        <Link
                          to={`/student/courses/${c._id}`}
                          className="btn btn-outline-primary btn-sm flex-grow-1"
                        >
                          Details
                        </Link>
                        {c.price != null && (
                          <Link
                            to={`/student/courses/${c._id}/fit`}
                            className="btn btn-primary btn-sm flex-grow-1"
                          >
                            Check Fit
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actions, Upcoming Schedule, Communications & Audit Trail (col-12 col-xl-4) */}
        <div className="col-12 col-xl-4">
          {/* Quick Operational Actions Grid */}
          <QuickActions
            hasActiveEnrollment={upcomingEnrollments.length > 0}
            hasActiveApplication={applications.length > 0}
            hasPendingPayment={hasPendingPayment}
            hasPendingReadiness={hasPendingReadiness}
            currentApplicationId={currentApplication?._id}
            readinessCourseId={currentApplication?.course?._id}
          />

          {/* Real Upcoming Items & Deadlines */}
          <UpcomingItems
            upcomingSessions={upcomingSessions}
            upcomingAssessments={upcomingAssessments}
            urgentGate={urgentGate}
          />

          {/* Official Academy Notifications Preview */}
          <NotificationsPreview
            notifications={notifications}
            unreadCount={unreadNotificationsCount}
          />

          {/* Chronological Activity & Audit Trail */}
          <ActivityTimeline timeline={timeline} />
        </div>
      </div>

      {/* QR Attendance Check-In Modal */}
      <QRCheckInModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onSuccess={load}
        initialSession={selectedSessionForQR}
      />
    </div>
  );
}

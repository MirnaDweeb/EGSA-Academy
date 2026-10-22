import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationService } from '../../services/cycleServices';
import StatusPill from '../../components/common/StatusPill.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import styles from './MyApplicationsPage.module.css';

export default function MyApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const load = () => {
    setLoading(true);
    setError('');
    applicationService
      .my()
      .then((res) => setApplications(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load applications.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filteredApplications = applications.filter((app) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'action_required') {
      return (
        app.status === 'Eligible' ||
        app.status === 'Foundation Required' ||
        app.status === 'Foundation Recommended' ||
        app.status === 'Accepted' ||
        app.status === 'Needs Information'
      );
    }
    if (activeTab === 'under_review') {
      return (
        app.status === 'Manual Review' ||
        app.status === 'Submitted' ||
        app.status === 'Under Review' ||
        app.status === 'Waitlisted'
      );
    }
    if (activeTab === 'enrolled') {
      return app.status === 'Confirmed' || app.status === 'In Progress' || app.status === 'Completed';
    }
    return true;
  });

  const getPendingActionDetails = (app) => {
    const status = app.status || 'Submitted';
    const course = app.course || {};

    if (status === 'Eligible') {
      return {
        styleClass: styles.actionEligible,
        label: 'Current Pending Action',
        text: 'Academic eligibility cleared. Advance to the mandatory readiness evaluation.',
        buttonLabel: 'Proceed to Assessment',
        buttonClass: styles.btnAction,
        icon: 'fa-arrow-right',
        onClick: () => navigate(`/student/readiness/start?courseId=${course._id}`),
      };
    }

    if (status === 'Foundation Required' || status === 'Foundation Recommended') {
      return {
        styleClass: styles.actionFoundation,
        label: 'Prerequisite Action Required',
        text: 'Missing required foundational prerequisite course. Enroll in pathway course.',
        buttonLabel: 'View Foundation Course',
        buttonClass: styles.btnWarningAction,
        icon: 'fa-book-open',
        onClick: () => navigate(app.fitResultSnapshot?.recommendedCourseId ? `/student/courses/${app.fitResultSnapshot.recommendedCourseId}` : '/student/courses'),
      };
    }

    if (status === 'Manual Review' || status === 'Under Review') {
      return {
        styleClass: styles.actionReview,
        label: 'Pending Academic Committee Review',
        text: 'Application is actively queued for Academic Affairs manual review and division clearance.',
        buttonLabel: 'View Details',
        buttonClass: styles.btnAction,
        icon: 'fa-eye',
        onClick: () => navigate(`/student/applications/${app._id}`),
      };
    }

    if (status === 'Needs Information') {
      return {
        styleClass: styles.actionFoundation,
        label: 'Action Required',
        text: 'Admissions committee requested additional documentation or clarification.',
        buttonLabel: 'Respond to Committee',
        buttonClass: styles.btnWarningAction,
        icon: 'fa-pen-to-square',
        onClick: () => navigate(`/student/applications/${app._id}`),
      };
    }

    if (status === 'Accepted' || status === 'Eligible - Payment Pending') {
      return {
        styleClass: styles.actionEligible,
        label: 'Payment Pending — Seat Reserved',
        text: 'Candidate admitted! Complete tuition payment within 72 hours to lock your seat.',
        buttonLabel: 'Pay Tuition Invoice',
        buttonClass: styles.btnAction,
        icon: 'fa-credit-card',
        onClick: () => navigate(app.invoice ? `/student/checkout/${app.invoice._id || app.invoice}` : '/student/payments'),
      };
    }

    if (status === 'Waitlisted') {
      return {
        styleClass: styles.actionDefault,
        label: 'Waitlist Queue',
        text: `Cohort capacity reached. Placed on FIFO waitlist at position #${app.waitlistPosition || 1}.`,
        buttonLabel: 'View Application',
        buttonClass: styles.btnAction,
        icon: 'fa-hourglass',
        onClick: () => navigate(`/student/applications/${app._id}`),
      };
    }

    if (status === 'Confirmed' || status === 'Completed' || status === 'In Progress') {
      return {
        styleClass: styles.actionEligible,
        label: 'Enrollment Confirmed',
        text: 'Officially enrolled in active cohort. Access sessions and attendance records.',
        buttonLabel: 'Go to Training',
        buttonClass: styles.btnAction,
        icon: 'fa-chalkboard-user',
        onClick: () => navigate('/student/training'),
      };
    }

    return {
      styleClass: styles.actionDefault,
      label: 'Status',
      text: 'Application record logged.',
      buttonLabel: 'View Details',
      buttonClass: styles.btnAction,
      icon: 'fa-circle-info',
      onClick: () => navigate(`/student/applications/${app._id}`),
    };
  };

  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title="Student Applications Timeline"
        subtitle="Track real-time admissions status, prerequisite clearance, and pending actions across your Space Academy enrollments."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Applications' },
        ]}
        actions={
          <Link
            to="/student/courses"
            className="btn btn-sm fw-bold text-white shadow-sm"
            style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
          >
            <i className="fa-solid fa-plus me-1"></i> Apply for Course
          </Link>
        }
      />

      {/* Tabs */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('all')}
        >
          All Applications ({applications.length})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'action_required' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('action_required')}
        >
          Action Required
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'under_review' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('under_review')}
        >
          Under Review
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'enrolled' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('enrolled')}
        >
          Confirmed Enrolled
        </button>
      </div>

      {loading && <LoadingState label="Loading admissions timeline..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && filteredApplications.length === 0 && (
        <EmptyState
          title="No applications found"
          message="You have no applications in this view. Explore the Course Catalog to apply."
        />
      )}

      {/* Timeline Cards */}
      {!loading && !error && filteredApplications.length > 0 && (
        <div>
          {filteredApplications.map((app) => {
            const course = app.course || {};
            const isPreUniv = course.division === 'PRE_UNIVERSITY';
            const action = getPendingActionDetails(app);
            const submittedDate = app.submittedAt || app.createdAt;

            return (
              <div key={app._id} className={styles.timelineCard}>
                {/* Header */}
                <div className={styles.cardHeader}>
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span
                        className="badge fw-semibold"
                        style={{
                          backgroundColor: isPreUniv ? '#D4B87C' : '#3A6985',
                          color: isPreUniv ? '#1E1703' : '#FFFFFF',
                          fontSize: '0.75rem',
                        }}
                      >
                        {isPreUniv ? 'Pre-University' : 'University'}
                      </span>
                      <span className="badge bg-light text-secondary border small">
                        {course.level || 'Program'}
                      </span>
                      <span className={styles.refBadge}>
                        {app.referenceNumber || `EGSA-APP-${app._id.slice(-6).toUpperCase()}`}
                      </span>
                    </div>

                    <h5 className={styles.courseTitle}>{course.title || 'Space Program'}</h5>

                    <div className={styles.submissionTime}>
                      <i className="fa-regular fa-calendar-check"></i>
                      <span>
                        Submitted on{' '}
                        {submittedDate
                          ? new Date(submittedDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <div className="text-end">
                    <StatusPill status={app.status} />
                  </div>
                </div>

                {/* Admin Override Alert if applied */}
                {app.adminOverride?.applied && (
                  <div className={styles.overrideNotice}>
                    <i className="fa-solid fa-stamp me-1 text-success"></i>
                    <strong>Administrative Override Approved:</strong> {app.adminOverride.reason}
                  </div>
                )}

                {/* Missing Requirements List if any */}
                {app.missingRequirements && app.missingRequirements.length > 0 && (
                  <div className="p-2 mb-2 bg-light rounded border text-danger small">
                    <strong className="d-block text-dark mb-1">
                      <i className="fa-solid fa-triangle-exclamation me-1 text-warning"></i>
                      Identified Requirements:
                    </strong>
                    <ul className="mb-0 ps-3">
                      {app.missingRequirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Current Pending Action Box */}
                <div className={`${styles.pendingActionBox} ${action.styleClass}`}>
                  <div>
                    <span className={styles.actionLabel}>{action.label}</span>
                    <p className={styles.actionText}>{action.text}</p>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={action.buttonClass}
                      onClick={action.onClick}
                    >
                      <i className={`fa-solid ${action.icon}`}></i>
                      <span>{action.buttonLabel}</span>
                    </button>
                  </div>
                </div>

                {/* Footer link */}
                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span className="small text-muted">
                    Cohort: <strong>{app.cohort?.name || 'Scheduled Cycle'}</strong>
                  </span>
                  <Link
                    to={`/student/applications/${app._id}`}
                    className="small text-decoration-none fw-semibold"
                    style={{ color: '#1E7C85' }}
                  >
                    View Complete Application Record <i className="fa-solid fa-chevron-right ms-1"></i>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

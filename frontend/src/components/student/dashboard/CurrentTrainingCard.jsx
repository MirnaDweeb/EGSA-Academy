import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Current Training / Program Card for Egyptian Space Agency Dashboard.
 * Displays enrolled course, cohort cycle, attendance health, today's live session
 * with direct QR check-in & materials, and syllabus roadmap timeline.
 */
export default function CurrentTrainingCard({
  enrollments = [],
  attendanceData,
  upcomingSessions = [],
  upcomingAssessments = [],
  onMarkAttendance,
}) {
  const activeEnrollment = enrollments[0];

  // If no enrolled program, render institutional empty state
  if (!activeEnrollment) {
    return (
      <div className="egsa-institutional-card mb-4" aria-labelledby="training-heading">
        <div className="card-header-clean">
          <div className="d-flex align-items-center gap-2">
            <span className="card-header-icon-pill">
              <i className="fa-solid fa-graduation-cap text-primary-egsa"></i>
            </span>
            <div>
              <span className="card-overline">Current Academic Track</span>
              <h2 id="training-heading" className="card-heading-title">Active Training Program</h2>
            </div>
          </div>
          <Link to="/student/catalog" className="clean-action-link">
            Browse Catalog <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>

        <div className="empty-training-state">
          <div className="empty-state-icon-circle">
            <i className="fa-solid fa-satellite-dish"></i>
          </div>
          <h3 className="empty-state-title">No Active Training Enrollment</h3>
          <p className="empty-state-description">
            You are not currently enrolled in an active Egyptian Space Agency training cycle.
            Explore available accredited space programs, review prerequisites, and submit an application.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2 pt-2">
            <Link to="/student/catalog" className="btn btn-primary btn-sm px-3">
              <i className="fa-solid fa-compass me-1"></i> Explore Course Catalog
            </Link>
            <Link to="/student/applications" className="btn btn-outline-primary btn-sm px-3">
              <i className="fa-solid fa-file-lines me-1"></i> Check Applications
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const course = activeEnrollment.course || {};
  const cohort = activeEnrollment.cohort || {};
  const attendanceRate = attendanceData?.overallPercentage;

  // Extract sessions from correlated course attendance
  const courseAttendance = attendanceData?.courses?.find(
    (c) =>
      String(c.enrollmentId) === String(activeEnrollment._id) ||
      String(c.courseId) === String(course._id)
  ) || attendanceData?.courses?.[0];

  const sessions = courseAttendance?.sessions || [];
  const todaySession = sessions.find((s) => s.isToday || s.timingState === 'live_today');

  // Topic styling helper
  const getTopicBadgeStyle = (topic) => {
    const t = (topic || '').toLowerCase();
    if (t.includes('rf') || t.includes('data')) {
      return { bg: 'rgba(13, 148, 136, 0.12)', color: '#0F766E', border: '#0D9488' };
    }
    if (t.includes('avionics')) {
      return { bg: 'rgba(124, 58, 237, 0.12)', color: '#6D28D9', border: '#7C3AED' };
    }
    if (t.includes('telemetry')) {
      return { bg: 'rgba(217, 119, 6, 0.12)', color: '#92400E', border: '#D97706' };
    }
    if (t.includes('astrodynamics') || t.includes('orbit')) {
      return { bg: 'rgba(37, 99, 235, 0.12)', color: '#1D4ED8', border: '#2563EB' };
    }
    return { bg: 'rgba(58, 105, 133, 0.12)', color: '#2C5167', border: '#3A6985' };
  };

  // Determine next milestone
  let nextMilestone = null;
  if (todaySession) {
    nextMilestone = {
      label: todaySession.title || `Session ${todaySession.sessionNumber}`,
      type: 'Live Today · Attendance Open',
      date: todaySession.date,
      icon: 'fa-chalkboard-user',
      isToday: true,
      link: '/student/training',
    };
  } else if (upcomingAssessments.length > 0) {
    const nextAss = upcomingAssessments[0];
    nextMilestone = {
      label: nextAss.title || 'Technical Assessment',
      type: nextAss.type || 'Assessment',
      date: nextAss.dueDate || nextAss.assessmentDate,
      icon: 'fa-flask-vial',
      link: '/student/assessments',
    };
  } else if (upcomingSessions.length > 0) {
    const nextSess = upcomingSessions[0];
    nextMilestone = {
      label: nextSess.title || `Session ${nextSess.sessionNumber}`,
      type: 'Training Session',
      date: nextSess.date,
      icon: 'fa-chalkboard-user',
      link: '/student/training',
    };
  }

  const startDateFormatted = cohort.startDate
    ? new Date(cohort.startDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : course.startDate
    ? new Date(course.startDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Scheduled';

  const endDateFormatted = cohort.endDate
    ? new Date(cohort.endDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : course.endDate
    ? new Date(course.endDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="training-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-graduation-cap text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Current Academic Track</span>
            <h2 id="training-heading" className="card-heading-title">Active Training Program</h2>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge-egsa-status badge-status-confirmed">
            <i className="fa-solid fa-circle-check me-1"></i>
            {activeEnrollment.status || 'Active'}
          </span>
          <Link to="/student/training" className="clean-action-link d-none d-sm-inline-flex">
            Training Hub <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>

      <div className="active-training-card-body">
        <div className="row g-4 align-items-center">
          {/* Main Course Info */}
          <div className="col-lg-7">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              {course.code && (
                <span className="code-pill">
                  <i className="fa-solid fa-fingerprint me-1"></i>
                  {course.code}
                </span>
              )}
              {course.level && (
                <span className="badge-egsa-subtle">
                  Level: {course.level}
                </span>
              )}
              <span className="badge-egsa-subtle">
                <i className="fa-solid fa-location-dot me-1 text-primary-egsa"></i>
                {course.deliveryMode || 'Onsite'} · {course.location || 'EGSA Cairo'}
              </span>
            </div>

            <h3 className="training-program-title mb-2">
              {course.title || 'Egyptian Space Agency Training Program'}
            </h3>

            {course.overview && (
              <p className="training-program-desc text-muted mb-3">
                {course.overview}
              </p>
            )}

            {/* Metadata Grid */}
            <div className="training-metadata-strip">
              <div className="meta-item">
                <span className="meta-label">Cohort / Cycle</span>
                <span className="meta-value">
                  {cohort.name || 'Autumn Cycle 2026/27'}
                </span>
              </div>

              <div className="meta-item">
                <span className="meta-label">Start Date</span>
                <span className="meta-value">{startDateFormatted}</span>
              </div>

              {endDateFormatted && (
                <div className="meta-item d-none d-sm-block">
                  <span className="meta-label">Target Completion</span>
                  <span className="meta-value">{endDateFormatted}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress & Milestone Column */}
          <div className="col-lg-5">
            <div className="training-telemetry-box">
              {/* Attendance Indicator */}
              <div className="telemetry-row mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="telemetry-label">
                    <i className="fa-solid fa-calendar-check me-1 text-primary-egsa"></i>
                    Attendance Health
                  </span>
                  <span className="telemetry-value">
                    {attendanceRate != null ? `${attendanceRate}%` : 'Awaiting Records'}
                  </span>
                </div>
                <div className="training-progress-track">
                  <div
                    className={`training-progress-fill ${
                      attendanceRate >= 85 ? 'fill-qualified' : 'fill-standard'
                    }`}
                    style={{ width: `${Math.min(100, attendanceRate || 0)}%` }}
                  />
                </div>
                <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                  <span>Required: 85% for Certificate</span>
                  <span>{attendanceRate >= 85 ? 'Qualified' : 'In Progress'}</span>
                </div>
              </div>

              {/* Next Milestone / Today Session */}
              {nextMilestone ? (
                <div
                  className="next-milestone-box mb-3"
                  style={{
                    borderColor: nextMilestone.isToday ? '#3A6985' : '#CBD5E1',
                    backgroundColor: nextMilestone.isToday ? 'rgba(58, 105, 133, 0.05)' : '#F8FAFC',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span
                      className="milestone-tag"
                      style={{
                        color: nextMilestone.isToday ? '#3A6985' : '#64748B',
                        fontWeight: 700,
                      }}
                    >
                      <i className={`fa-solid ${nextMilestone.icon} me-1`}></i>
                      {nextMilestone.isToday ? 'LIVE TODAY' : 'NEXT MILESTONE'}
                    </span>
                    {nextMilestone.date && (
                      <span className="milestone-date">
                        {new Date(nextMilestone.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <div className="milestone-title">{nextMilestone.label}</div>
                  <div className="milestone-type">{nextMilestone.type}</div>
                </div>
              ) : (
                <div className="next-milestone-box mb-3">
                  <div className="milestone-tag">
                    <i className="fa-solid fa-circle-check me-1"></i>
                    COURSE STATUS
                  </div>
                  <div className="milestone-title">Class Active & On Schedule</div>
                  <div className="milestone-type">Follow weekly syllabus in the training portal</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="d-flex flex-wrap gap-2 pt-1">
                <Link to="/student/training" className="btn btn-primary btn-sm flex-grow-1 fw-bold">
                  <i className="fa-solid fa-graduation-cap me-1"></i> My Training
                </Link>
                <Link to="/student/attendance" className="btn btn-outline-primary btn-sm">
                  <i className="fa-solid fa-calendar-check me-1"></i> Attendance
                </Link>
                <Link to="/student/payments" className="btn btn-outline-secondary btn-sm" title="Tuition Invoices">
                  <i className="fa-solid fa-file-invoice-dollar me-1"></i> Invoices
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Live Today Session Highlight & QR Check-In Callout */}
        {todaySession && (
          <div
            className="p-3 mt-3 rounded border d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 shadow-xs"
            style={{
              backgroundColor: 'rgba(58, 105, 133, 0.05)',
              borderColor: '#3A6985',
              borderLeftWidth: '4px',
              borderLeftColor: '#3A6985',
            }}
          >
            <div className="d-flex flex-column">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span
                  className="badge rounded-pill fw-bold text-white px-2 py-1"
                  style={{ backgroundColor: '#3A6985', fontSize: '0.72rem' }}
                >
                  <span className="rounded-circle d-inline-block bg-danger me-1" style={{ width: 7, height: 7 }}></span>
                  Session {todaySession.sessionNumber} · Live Today
                </span>

                {todaySession.topic && (() => {
                  const tStyle = getTopicBadgeStyle(todaySession.topic);
                  return (
                    <span
                      className="badge rounded-pill fw-bold"
                      style={{
                        backgroundColor: tStyle.bg,
                        color: tStyle.color,
                        border: `1px solid ${tStyle.border}`,
                        fontSize: '0.72rem',
                      }}
                    >
                      {todaySession.topic}
                    </span>
                  );
                })()}

                <span className="text-muted small" style={{ fontSize: '0.74rem' }}>
                  <i className="fa-solid fa-location-dot me-1 text-primary-egsa"></i>
                  {todaySession.classroom || todaySession.location}
                </span>
              </div>

              <h4 className="h6 fw-bold text-dark mb-1" style={{ fontSize: '0.92rem' }}>
                {todaySession.title}
              </h4>

              {/* Direct Access Materials */}
              {todaySession.materials && todaySession.materials.length > 0 && (
                <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
                  <span className="text-muted small fw-semibold" style={{ fontSize: '0.72rem' }}>
                    Materials:
                  </span>
                  {todaySession.materials.map((mat, mIdx) => (
                    <a
                      key={mat._id || mIdx}
                      href={mat.fileUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm py-0 px-2 rounded border text-decoration-none bg-white text-dark shadow-xs d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.7rem', borderColor: '#CBD5E1' }}
                      title={`Download ${mat.title}`}
                    >
                      <i className="fa-solid fa-file-pdf text-danger" style={{ fontSize: '0.7rem' }}></i>
                      <span className="text-truncate" style={{ maxWidth: 150 }}>
                        {mat.title}
                      </span>
                      <i className="fa-solid fa-download text-muted ms-1" style={{ fontSize: '0.6rem' }}></i>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Check-In / Meeting Action Buttons */}
            <div className="d-flex align-items-center gap-2 flex-wrap flex-shrink-0">
              {todaySession.meetingUrl && (
                <a
                  href={todaySession.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline-primary py-1 px-3 fw-semibold"
                  style={{ fontSize: '0.78rem' }}
                >
                  <i className="fa-solid fa-video me-1"></i> Console Link
                </a>
              )}

              <button
                type="button"
                className="btn btn-sm fw-bold text-white px-3 py-1 shadow-sm d-inline-flex align-items-center gap-2"
                style={{
                  backgroundColor: '#1E7C85',
                  borderColor: '#1E7C85',
                  fontSize: '0.8rem',
                }}
                onClick={() => onMarkAttendance && onMarkAttendance(todaySession)}
              >
                <i className="fa-solid fa-qrcode fs-6"></i>
                <span>QR Attendance Check-In</span>
              </button>
            </div>
          </div>
        )}

        {/* Structured Syllabus Mini-Timeline */}
        {sessions.length > 0 && (
          <div className="mt-3 pt-3 border-top">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted fw-bold small text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                Course Syllabus Progress ({sessions.length} Sessions)
              </span>
              <Link to="/student/training" className="clean-action-link" style={{ fontSize: '0.75rem' }}>
                Full Syllabus Hub &rarr;
              </Link>
            </div>

            <div className="row g-2">
              {sessions.slice(0, 4).map((s) => {
                const isPast = s.timingState === 'completed' || s.status === 'Present' || s.status === 'verified';
                const isLive = s.timingState === 'live_today' || s.isToday;
                const topStyle = getTopicBadgeStyle(s.topic);

                return (
                  <div key={s.sessionId || s.sessionNumber} className="col-12 col-md-6 col-xl-3">
                    <div
                      className="p-2 rounded border h-100 d-flex flex-column justify-content-between"
                      style={{
                        backgroundColor: isLive ? 'rgba(58, 105, 133, 0.05)' : isPast ? 'rgba(30, 124, 133, 0.03)' : '#FFFFFF',
                        borderColor: isLive ? '#3A6985' : isPast ? '#1E7C85' : '#E2E8F0',
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-bold small text-dark" style={{ fontSize: '0.74rem' }}>
                          Day {s.sessionNumber}
                        </span>
                        {isPast ? (
                          <i className="fa-solid fa-circle-check" style={{ color: '#1E7C85', fontSize: '0.75rem' }}></i>
                        ) : isLive ? (
                          <span className="badge rounded-pill text-white" style={{ backgroundColor: '#3A6985', fontSize: '0.62rem' }}>
                            LIVE
                          </span>
                        ) : (
                          <i className="fa-regular fa-calendar text-muted" style={{ fontSize: '0.72rem' }}></i>
                        )}
                      </div>
                      <div className="text-truncate fw-semibold text-dark mb-1" style={{ fontSize: '0.76rem' }}>
                        {s.title}
                      </div>
                      <div>
                        <span
                          className="badge rounded-pill fw-bold"
                          style={{
                            backgroundColor: topStyle.bg,
                            color: topStyle.color,
                            fontSize: '0.64rem',
                            border: `1px solid ${topStyle.border}`,
                          }}
                        >
                          {s.topic}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

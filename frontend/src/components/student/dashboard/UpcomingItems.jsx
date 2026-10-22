import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Upcoming Items / Schedule Section for Egyptian Space Agency Dashboard.
 * Displays only authentic scheduled sessions, upcoming assessments, or action deadlines.
 */
export default function UpcomingItems({
  upcomingSessions = [],
  upcomingAssessments = [],
  urgentGate,
}) {
  const items = [];

  // Urgent gate deadline item if active
  if (urgentGate) {
    items.push({
      id: 'gate-urgent',
      type: 'Urgent Deadline',
      typeClass: 'type-urgent',
      icon: 'fa-triangle-exclamation',
      title: urgentGate.title,
      dateLabel: urgentGate.deadline || 'Pending Action',
      status: 'Required',
      statusClass: 'status-danger',
      actionLabel: urgentGate.actionLabel,
      actionLink: urgentGate.actionLink,
    });
  }

  // Real upcoming training sessions
  upcomingSessions.forEach((sess) => {
    items.push({
      id: `session-${sess._id}`,
      type: 'Training Session',
      typeClass: 'type-session',
      icon: 'fa-chalkboard-user',
      title: sess.title || `Session ${sess.sessionNumber}`,
      subtitle: `${sess.course?.title || 'Course'}${sess.cohort?.name ? ` · ${sess.cohort.name}` : ''}`,
      date: sess.date,
      dateLabel: new Date(sess.date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      timeLabel: `${sess.startTime || '10:00 AM'} - ${sess.endTime || '03:00 PM'}`,
      status: sess.status || 'Scheduled',
      statusClass: 'status-info',
      actionLabel: 'Details',
      actionLink: '/student/training',
    });
  });

  // Real upcoming assessments
  upcomingAssessments.forEach((ass) => {
    const dueDate = ass.dueDate || ass.assessmentDate;
    items.push({
      id: `assessment-${ass._id}`,
      type: ass.type || 'Assessment',
      typeClass: 'type-assessment',
      icon: 'fa-flask-vial',
      title: ass.title,
      subtitle: `${ass.course?.title || 'Program'}${ass.maxScore ? ` · Max Score: ${ass.maxScore}` : ''}`,
      date: dueDate,
      dateLabel: dueDate
        ? new Date(dueDate).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : 'Scheduled',
      status: ass.status || 'Active',
      statusClass: 'status-warning',
      actionLabel: 'View Assessment',
      actionLink: '/student/assessments',
    });
  });

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="upcoming-heading">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill" style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(30, 124, 133, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-calendar-days" style={{ color: '#1E7C85' }}></i>
          </span>
          <div>
            <h6 className="fw-bold mb-0 text-dark">Upcoming Sessions</h6>
            <span className="text-muted small" style={{ fontSize: '0.72rem' }}>Schedule & Milestones</span>
          </div>
        </div>
        <Link className="btn btn-sm btn-link text-decoration-none p-0 fw-semibold" style={{ color: '#1E7C85' }} to="/student/training">
          View Full Schedule &rarr;
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="empty-training-state py-4 text-center">
          <div className="empty-state-icon-circle-sm">
            <i className="fa-solid fa-calendar-check text-muted"></i>
          </div>
          <p className="empty-state-description mb-0">
            No active sessions right now. All academic requirements are current.
          </p>
        </div>
      ) : (
        <div className="upcoming-items-list">
          {items.map((item) => (
            <div key={item.id} className="upcoming-item-row">
              <div className="item-icon-box">
                <i className={`fa-solid ${item.icon}`}></i>
              </div>

              <div className="item-main-content">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <span className={`item-type-badge ${item.typeClass}`}>{item.type}</span>
                  <span className="item-date-text">
                    <i className="fa-regular fa-clock me-1"></i>
                    {item.dateLabel}
                    {item.timeLabel && ` · ${item.timeLabel}`}
                  </span>
                </div>
                <h3 className="item-title mb-0">{item.title}</h3>
                {item.subtitle && <p className="item-subtitle text-muted mb-0">{item.subtitle}</p>}
              </div>

              <div className="item-action-area">
                <Link to={item.actionLink} className="btn btn-outline-primary btn-sm px-3">
                  {item.actionLabel} <i className="fa-solid fa-chevron-right ms-1 small"></i>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

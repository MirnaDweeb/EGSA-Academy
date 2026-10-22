import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Egyptian Space Agency — Academic Training Center & Syllabus Hub
 * Displays structured session timeline (Session 1 to 8), high-contrast topic badges,
 * verified state transitions, downloadable slide decks/PDFs, meeting links, and
 * prominent QR Attendance Check-In for today's active session.
 */
export default function TrainingSchedule({ attendanceRecord, course, onMarkAttendance }) {
  const [filterTopic, setFilterTopic] = useState('ALL');
  const sessions = attendanceRecord?.sessions || [];

  if (sessions.length === 0) {
    return (
      <div className="egsa-institutional-card mb-4" aria-labelledby="schedule-heading">
        <div className="card-header-clean">
          <div className="d-flex align-items-center gap-2">
            <span className="card-header-icon-pill">
              <i className="fa-regular fa-calendar-days text-primary-egsa"></i>
            </span>
            <div>
              <span className="card-overline">Curriculum Delivery</span>
              <h2 id="schedule-heading" className="card-heading-title">Course Syllabus & Session Timeline</h2>
            </div>
          </div>
        </div>
        <div className="empty-training-state py-4 text-center">
          <div className="empty-state-icon-circle">
            <i className="fa-solid fa-calendar-xmark"></i>
          </div>
          <h3 className="empty-state-title">No Timetable Generated Yet</h3>
          <p className="empty-state-description">
            The session timetable and laboratory agenda for this cohort will be posted as soon as the
            Egyptian Space Agency academic registrar confirms faculty assignments.
          </p>
        </div>
      </div>
    );
  }

  // Extract unique topics for quick filter
  const topics = ['ALL', ...new Set(sessions.map((s) => s.topic || s.focus || 'Space Systems').filter(Boolean))];

  const filteredSessions = filterTopic === 'ALL'
    ? sessions
    : sessions.filter((s) => (s.topic || s.focus || 'Space Systems') === filterTopic);

  const getTopicStyle = (topic) => {
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

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="schedule-heading">
      {/* Header */}
      <div className="card-header-clean pb-3 border-bottom mb-3">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-regular fa-calendar-days text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Academic Training Delivery</span>
            <h2 id="schedule-heading" className="card-heading-title">Course Syllabus & Session Timeline</h2>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge rounded-pill fw-bold" style={{ backgroundColor: '#1E7C85', color: '#FFFFFF', fontSize: '0.72rem' }}>
            {sessions.length} Structured Sessions
          </span>
          <Link to="/student/attendance" className="clean-action-link d-none d-sm-inline-flex">
            Audit Logs <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>

      {/* Topic Filter Pills */}
      {topics.length > 2 && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="text-muted small fw-semibold" style={{ fontSize: '0.76rem' }}>
            Filter by Topic:
          </span>
          {topics.map((top) => {
            const isSelected = filterTopic === top;
            const style = top === 'ALL' ? null : getTopicStyle(top);
            return (
              <button
                key={top}
                type="button"
                className="btn btn-sm rounded-pill px-2 py-0 fw-semibold"
                style={{
                  fontSize: '0.72rem',
                  backgroundColor: isSelected ? (style ? style.border : '#1E7C85') : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#475569',
                  borderColor: isSelected ? (style ? style.border : '#1E7C85') : '#CBD5E1',
                  borderWidth: '1px',
                }}
                onClick={() => setFilterTopic(top)}
              >
                {top}
              </button>
            );
          })}
        </div>
      )}

      {/* Structured Sessions Timeline List */}
      <div className="d-flex flex-column gap-3">
        {filteredSessions.map((s) => {
          const timingState = s.timingState || (s.isToday ? 'live_today' : s.status === 'Present' || s.status === 'verified' ? 'completed' : 'scheduled');
          const isLiveToday = timingState === 'live_today' || s.isToday;
          const isCompleted = timingState === 'completed' || s.status === 'Present' || s.status === 'verified';
          const isScheduled = !isLiveToday && !isCompleted;

          const topic = s.topic || s.focus || 'Space Systems';
          const topicStyle = getTopicStyle(topic);

          const dateFormatted = s.date
            ? new Date(s.date).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Date TBA';

          const timeFormatted = s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : s.startTime || s.time || '10:00 AM – 02:00 PM';

          return (
            <div
              key={s.sessionId || s.sessionNumber}
              className="p-3 rounded border transition-all"
              style={{
                backgroundColor: isLiveToday
                  ? 'rgba(58, 105, 133, 0.04)'
                  : isCompleted
                  ? 'rgba(30, 124, 133, 0.02)'
                  : '#FFFFFF',
                borderColor: isLiveToday
                  ? '#3A6985'
                  : isCompleted
                  ? '#1E7C85'
                  : '#E2E8F0',
                borderLeftWidth: isLiveToday ? '5px' : isCompleted ? '4px' : '1px',
                borderLeftColor: isLiveToday ? '#3A6985' : isCompleted ? '#1E7C85' : '#E2E8F0',
                boxShadow: isLiveToday ? '0 4px 14px rgba(58, 105, 133, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              {/* Top Row: Session Tag, Topic Badge & State Indicator */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span
                    className="fw-bold px-2 py-0 rounded text-uppercase"
                    style={{
                      fontSize: '0.72rem',
                      backgroundColor: '#F1F5F9',
                      color: '#334155',
                      letterSpacing: '0.04em',
                      border: '1px solid #CBD5E1',
                    }}
                  >
                    Session {s.sessionNumber}
                  </span>

                  {/* High-Contrast Topic Badge */}
                  <span
                    className="badge rounded-pill fw-bold px-2 py-1"
                    style={{
                      backgroundColor: topicStyle.bg,
                      color: topicStyle.color,
                      border: `1px solid ${topicStyle.border}`,
                      fontSize: '0.72rem',
                      letterSpacing: '0.02em',
                    }}
                  >
                    <i className="fa-solid fa-atom me-1"></i>
                    {topic}
                  </span>

                  {s.deliveryMode && (
                    <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
                      {s.deliveryMode}
                    </span>
                  )}
                </div>

                {/* State Delineation */}
                <div>
                  {isCompleted ? (
                    <span
                      className="badge rounded-pill fw-bold d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: 'rgba(30, 124, 133, 0.15)',
                        color: '#1E7C85',
                        border: '1px solid #1E7C85',
                        fontSize: '0.72rem',
                      }}
                    >
                      <i className="fa-solid fa-circle-check"></i>
                      Completed & Attended
                    </span>
                  ) : isLiveToday ? (
                    <span
                      className="badge rounded-pill fw-bold d-inline-flex align-items-center gap-1 text-white"
                      style={{
                        backgroundColor: '#3A6985',
                        fontSize: '0.72rem',
                        animation: 'pulse 2s infinite',
                      }}
                    >
                      <span
                        className="rounded-circle d-inline-block bg-danger"
                        style={{ width: 8, height: 8 }}
                      ></span>
                      Live Today · Active Session
                    </span>
                  ) : (
                    <span
                      className="badge rounded-pill fw-bold d-inline-flex align-items-center gap-1 text-muted"
                      style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.72rem',
                      }}
                    >
                      <i className="fa-regular fa-calendar"></i>
                      Scheduled
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Focus */}
              <h3 className="h6 fw-bold text-dark mb-1" style={{ fontSize: '0.94rem' }}>
                {s.title}
              </h3>
              {s.focus && s.focus !== topic && (
                <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
                  <span className="fw-semibold text-secondary">Core Focus:</span> {s.focus}
                </p>
              )}

              {/* Activities list if present */}
              {s.activities && s.activities.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {s.activities.map((act, aIdx) => (
                    <span
                      key={aIdx}
                      className="badge bg-white text-muted border small"
                      style={{ fontSize: '0.68rem' }}
                    >
                      <i className="fa-solid fa-check-double me-1 text-primary-egsa"></i>
                      {act}
                    </span>
                  ))}
                </div>
              )}

              {/* Location, Date & Instructor Meta Strip */}
              <div
                className="d-flex flex-wrap align-items-center gap-3 text-muted small py-2 mb-2 border-top border-bottom"
                style={{ fontSize: '0.76rem', borderColor: '#F1F5F9' }}
              >
                <span>
                  <i className="fa-regular fa-calendar text-primary-egsa me-1"></i>
                  <strong className="text-dark">{dateFormatted}</strong>
                </span>
                <span>
                  <i className="fa-regular fa-clock text-primary-egsa me-1"></i>
                  {timeFormatted}
                </span>
                <span>
                  <i className="fa-solid fa-location-dot text-primary-egsa me-1"></i>
                  <strong>{s.classroom || s.location || 'EGSA Ground Station'}</strong>
                </span>
                {s.instructor && (
                  <span>
                    <i className="fa-solid fa-user-tie text-primary-egsa me-1"></i>
                    {s.instructor}
                  </span>
                )}
              </div>

              {/* Action Bar: Materials, Hybrid Meeting & QR Check-In */}
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 pt-1">
                {/* Session Materials Links */}
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="text-muted fw-semibold small" style={{ fontSize: '0.72rem' }}>
                    <i className="fa-solid fa-folder-closed me-1 text-primary-egsa"></i>
                    Materials:
                  </span>
                  {s.materials && s.materials.length > 0 ? (
                    s.materials.map((mat, mIdx) => (
                      <a
                        key={mat._id || mIdx}
                        href={mat.fileUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm py-0 px-2 rounded border text-decoration-none bg-white text-dark shadow-xs d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '0.72rem', borderColor: '#CBD5E1' }}
                        title={`Download ${mat.title}`}
                      >
                        <i
                          className={`fa-solid ${
                            mat.type === 'PDF' || mat.title?.endsWith('.pdf')
                              ? 'fa-file-pdf text-danger'
                              : 'fa-file-powerpoint text-warning'
                          }`}
                        ></i>
                        <span className="text-truncate" style={{ maxWidth: 170 }}>
                          {mat.title}
                        </span>
                        {mat.size && (
                          <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                            ({mat.size})
                          </span>
                        )}
                        <i className="fa-solid fa-download ms-1 text-muted" style={{ fontSize: '0.62rem' }}></i>
                      </a>
                    ))
                  ) : (
                    <span className="text-muted fst-italic small" style={{ fontSize: '0.72rem' }}>
                      Slide deck releases upon session start
                    </span>
                  )}
                </div>

                {/* Right Side Actions: Meeting link & QR Check-In */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {s.meetingUrl && (
                    <a
                      href={s.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary py-1 px-2 fw-semibold"
                      style={{ fontSize: '0.74rem' }}
                    >
                      <i className="fa-solid fa-video me-1"></i> Hybrid Console Link
                    </a>
                  )}

                  {/* Prominent QR Attendance Check-In for Today's Active Session */}
                  {isLiveToday && (
                    <button
                      type="button"
                      className="btn btn-sm fw-bold text-white px-3 py-1 shadow-sm d-inline-flex align-items-center gap-2"
                      style={{
                        backgroundColor: '#1E7C85',
                        borderColor: '#1E7C85',
                        fontSize: '0.78rem',
                      }}
                      onClick={() => onMarkAttendance && onMarkAttendance(s)}
                    >
                      <i className="fa-solid fa-qrcode fs-6"></i>
                      <span>QR Attendance Check-In</span>
                    </button>
                  )}

                  {isCompleted && s.checkInTime && (
                    <span className="text-muted small" style={{ fontSize: '0.7rem' }}>
                      <i className="fa-solid fa-clock-check me-1 text-success"></i>
                      Checked in {new Date(s.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

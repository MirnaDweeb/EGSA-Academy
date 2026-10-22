import React from 'react';
import { Link } from 'react-router-dom';

export default function CourseCard({ course, onApplyNow, isEnrolled = false, activeApp = null }) {
  const isPreUniv = course.division === 'PRE_UNIVERSITY';
  const priceDisplay = course.price != null || course.basePrice != null
    ? `${Number(course.price ?? course.basePrice).toLocaleString()} ${course.currency || 'EGP'}`
    : 'Pricing TBA';

  // Format prerequisites summary
  const prereqList = course.prerequisites || course.mandatoryPrerequisites || [];
  const prereqNames = prereqList.map((p) => (typeof p === 'object' ? p.title : p)).filter(Boolean);

  return (
    <div
      className="egsa-card p-4 h-100 d-flex flex-column shadow-sm"
      style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #CBD5E1' }}
    >
      {/* Top Badges */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="d-flex gap-1 flex-wrap">
          <span
            className="badge fw-semibold"
            style={{
              backgroundColor: isPreUniv ? '#D4B87C' : '#3A6985',
              color: isPreUniv ? '#1E1703' : '#FFFFFF',
              fontSize: '0.75rem',
            }}
          >
            <i className={`fa-solid ${isPreUniv ? 'fa-school' : 'fa-graduation-cap'} me-1`}></i>
            {isPreUniv ? 'Pre-University' : 'University'}
          </span>
          <span
            className="badge fw-semibold"
            style={{ backgroundColor: '#EEF2F6', color: '#1E7C85', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
          >
            {course.level || 'Foundation'}
          </span>
          {isEnrolled && (
            <span className="badge bg-success fw-semibold" style={{ fontSize: '0.75rem' }}>
              <i className="fa-solid fa-check-circle me-1"></i> Enrolled
            </span>
          )}
          {!isEnrolled && activeApp && (
            <span className="badge bg-warning text-dark fw-semibold" style={{ fontSize: '0.75rem' }}>
              <i className="fa-solid fa-clock me-1"></i> In Progress
            </span>
          )}
        </div>
        <span className="fw-bold" style={{ color: '#1E7C85', fontSize: '0.95rem' }}>
          {priceDisplay}
        </span>
      </div>

      <h5 className="mb-1 text-dark fw-bold" style={{ fontSize: '1.1rem' }}>{course.title}</h5>

      {course.targetAudience && (
        <small className="text-muted d-block mb-2" style={{ fontSize: '0.8rem' }}>
          <i className="fa-solid fa-users me-1 text-secondary"></i>
          {course.targetAudience}
        </small>
      )}

      {course.shortDescription && (
        <p className="text-muted small flex-grow-1 mb-3 line-clamp-2" style={{ fontSize: '0.85rem' }}>
          {course.shortDescription}
        </p>
      )}

      {/* Prerequisites & Requirements Section */}
      <div
        className="p-2 mb-3 rounded"
        style={{ backgroundColor: '#EEF2F6', border: '1px solid #E2E8F0', fontSize: '0.8rem' }}
      >
        <div className="fw-bold text-dark mb-1" style={{ color: '#3A6985' }}>
          <i className="fa-solid fa-clipboard-check me-1" style={{ color: '#1E7C85' }}></i>
          Prerequisites & Requirements:
        </div>
        {prereqNames.length > 0 ? (
          <div className="text-danger fw-semibold">
            <span className="text-muted fw-normal">Required: </span>
            {prereqNames.join(', ')}
          </div>
        ) : (
          <div className="text-success fw-semibold">
            <i className="fa-solid fa-check me-1"></i> No prior prerequisites required
          </div>
        )}
        {course.minExperience && (
          <div className="text-muted mt-1 text-truncate" title={course.minExperience}>
            <span className="fw-semibold text-secondary">Min Experience: </span>
            {course.minExperience}
          </div>
        )}
      </div>

      {/* Meta Specs List */}
      <ul className="list-unstyled small text-muted mb-3" style={{ fontSize: '0.825rem' }}>
        <li>
          <i className="fa-regular fa-clock me-2 text-secondary"></i>
          {course.duration != null ? `${course.duration} ${course.durationUnit || 'Days'}` : '10 Days'}
          {course.hoursPerDay ? ` · ${course.hoursPerDay}` : ''}
        </li>
        <li>
          <i className="fa-solid fa-location-dot me-2 text-secondary"></i>
          {course.location || course.deliveryMode || 'EGSA Cairo Facility'}
        </li>
        {course.capacity != null && (
          <li>
            <i className="fa-solid fa-chair me-2 text-secondary"></i>
            {course.capacity} seats capacity
            {course.seatsTaken != null ? ` (${Math.max(course.capacity - course.seatsTaken, 0)} available)` : ''}
          </li>
        )}
      </ul>

      {/* Primary High-Contrast Call to Action */}
      <div className="d-flex flex-column gap-2 mt-auto">
        {isEnrolled ? (
          <Link
            to="/student/training"
            className="btn btn-sm w-100 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2 py-2"
            style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
          >
            <i className="fa-solid fa-laptop-code"></i>
            <span>View in Training Hub</span>
          </Link>
        ) : activeApp ? (
          <Link
            to={`/student/apply/${course._id}`}
            className="btn btn-sm w-100 fw-bold text-dark shadow-sm d-flex align-items-center justify-content-center gap-2 py-2"
            style={{ backgroundColor: '#D4B87C', borderColor: '#D4B87C' }}
          >
            <i className="fa-solid fa-arrow-rotate-right"></i>
            <span>Resume Application</span>
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-sm w-100 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2 py-2"
            style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
            onClick={() => (onApplyNow ? onApplyNow(course) : null)}
          >
            <i className="fa-solid fa-bolt"></i>
            <span>Apply & Check Eligibility</span>
          </button>
        )}

        <Link
          to={`/student/courses/${course._id}`}
          className="btn btn-outline-secondary btn-sm w-100 fw-semibold"
          style={{ borderColor: '#CBD5E1', fontSize: '0.8rem' }}
        >
          View Course Syllabus & Details
        </Link>
      </div>
    </div>
  );
}

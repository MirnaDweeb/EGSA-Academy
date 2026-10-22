import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ReadinessResultModal({ show, onClose, result, course, applicationId }) {
  const navigate = useNavigate();
  if (!show || !result) return null;

  const score = result.scorePercentage ?? result.score ?? 0;
  const threshold = result.threshold ?? 70;
  const passed = score >= threshold || ['Ready', 'READY', 'ELIGIBLE'].includes(result.outcome);

  const topicBreakdown = result.topicBreakdown || [];
  const recommendedCourse = result.recommendedCourse || (result.recommendedCourses && result.recommendedCourses[0]);
  const linkedAppId = result.linkedApplicationId || applicationId;
  const invoiceId = result.invoiceId;

  const handleProceedToPayment = () => {
    if (invoiceId && linkedAppId) {
      navigate(`/student/payments?invoiceId=${invoiceId}&applicationId=${linkedAppId}`);
    } else if (linkedAppId) {
      navigate(`/student/applications/${linkedAppId}`);
    } else {
      navigate('/student/applications');
    }
    if (onClose) onClose();
  };

  const handleEnrollFoundation = () => {
    if (recommendedCourse?._id || recommendedCourse?.id) {
      navigate(`/student/courses/${recommendedCourse._id || recommendedCourse.id}`);
    } else {
      navigate('/student/courses');
    }
    if (onClose) onClose();
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1065 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div
          className="modal-content shadow-lg border-0"
          style={{ borderRadius: '14px', overflow: 'hidden' }}
        >
          {/* Header */}
          <div
            className="modal-header border-0 px-4 py-3 text-white"
            style={{ backgroundColor: passed ? '#1E7C85' : '#3A6985' }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className={`fa-solid ${passed ? 'fa-circle-check' : 'fa-chart-pie'} fa-lg`} />
              <div>
                <h6 className="modal-title fw-bold mb-0 text-white">
                  {passed ? 'Technical Readiness Evaluation — Cleared' : 'Technical Readiness Evaluation — Advisory'}
                </h6>
                <small className="text-white-50" style={{ fontSize: '0.74rem' }}>
                  {course?.title || 'Course Diagnostic Engine'}
                </small>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            )}
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4 p-md-5" style={{ backgroundColor: '#FFFFFF' }}>
            {/* Score Banner */}
            <div className="text-center mb-4">
              <div
                className="d-inline-flex flex-column align-items-center justify-content-center shadow-sm mb-3"
                style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '50%',
                  backgroundColor: passed ? '#1E7C85' : '#D4B87C',
                  color: passed ? '#FFFFFF' : '#1E293B',
                  border: `4px solid ${passed ? '#155B62' : '#B89B5F'}`,
                }}
              >
                <span className="display-5 fw-bold lh-1">{score}%</span>
                <span
                  className="text-uppercase fw-bold mt-1"
                  style={{ fontSize: '0.65rem', letterSpacing: '0.08em' }}
                >
                  {passed ? 'Passed' : 'Needs Review'}
                </span>
              </div>

              <div>
                <span
                  className="badge px-3 py-2 fw-bold text-uppercase fs-6 shadow-sm"
                  style={{
                    backgroundColor: passed ? '#1E7C85' : '#D4B87C',
                    color: passed ? '#FFFFFF' : '#1E293B',
                  }}
                >
                  <i className={`fa-solid ${passed ? 'fa-check-circle' : 'fa-triangle-exclamation'} me-1.5`} />
                  Outcome: {passed ? 'Ready for Admissions' : 'Foundation Course Required'}
                </span>
              </div>

              <p className="text-muted small mt-2 mb-0 mx-auto" style={{ maxWidth: '480px' }}>
                {result.rationale ||
                  (passed
                    ? 'Congratulations! You demonstrated strong technical competency across required spaceflight domains.'
                    : 'Your score indicates technical competency gaps in one or more core domains. Foundational coursework is advised.')}
              </p>
            </div>

            {/* Topic Gap Breakdown with High-Contrast Progress Bars */}
            {topicBreakdown.length > 0 && (
              <div className="p-3 p-md-4 rounded border mb-4" style={{ backgroundColor: '#F8FAFC' }}>
                <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                  <i className="fa-solid fa-layer-group text-primary-egsa" style={{ color: '#1E7C85' }} />
                  Technical Domain Competency Breakdown
                </h6>
                <div className="d-flex flex-column gap-3">
                  {topicBreakdown.map((t, idx) => {
                    const tScore = t.score ?? 0;
                    const tPassed = t.passed ?? tScore >= 70;
                    return (
                      <div key={idx}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold text-dark small">
                            {t.topic}
                            {tPassed ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle ms-2 py-0.5 px-1.5" style={{ fontSize: '0.66rem' }}>
                                Mastered
                              </span>
                            ) : (
                              <span className="badge bg-warning-subtle text-dark border border-warning-subtle ms-2 py-0.5 px-1.5" style={{ fontSize: '0.66rem' }}>
                                Competency Gap
                              </span>
                            )}
                          </span>
                          <span className="fw-bold mono small" style={{ color: tPassed ? '#1E7C85' : '#D97706' }}>
                            {t.correctQuestions}/{t.totalQuestions} ({tScore}%)
                          </span>
                        </div>
                        <div className="progress" style={{ height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px' }}>
                          <div
                            className="progress-bar transition-all"
                            role="progressbar"
                            style={{
                              width: `${Math.min(100, Math.max(5, tScore))}%`,
                              backgroundColor: tPassed ? '#1E7C85' : '#D4B87C',
                            }}
                            aria-valuenow={tScore}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Guidance & Next Steps */}
            {passed ? (
              <div className="p-3 p-md-4 rounded border border-success-subtle bg-success-subtle d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                <div>
                  <h6 className="fw-bold text-success-emphasis mb-1">
                    <i className="fa-solid fa-ticket me-1.5" />
                    Seat Reservation & Invoicing Ready
                  </h6>
                  <p className="text-muted small mb-0">
                    Your readiness requirement is satisfied. Proceed immediately to lock in your seat and review tuition invoicing.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm px-4 py-2 fw-bold text-white shadow-sm flex-shrink-0"
                  style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
                  onClick={handleProceedToPayment}
                >
                  Proceed to Seat Reservation & Invoicing <i className="fa-solid fa-arrow-right ms-1" />
                </button>
              </div>
            ) : (
              <div className="p-3 p-md-4 rounded border border-warning-subtle bg-warning-subtle d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                <div>
                  <h6 className="fw-bold text-dark mb-1">
                    <i className="fa-solid fa-graduation-cap me-1.5 text-warning" />
                    Recommended Foundation Curriculum
                  </h6>
                  <p className="text-muted small mb-0">
                    {recommendedCourse
                      ? `Bridge your technical gap with: "${recommendedCourse.title}". Completing this preparatory track guarantees admission clearance.`
                      : 'Enroll in foundational space systems coursework to strengthen your core technical competencies before advancing.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm px-4 py-2 fw-bold text-dark shadow-sm flex-shrink-0"
                  style={{ backgroundColor: '#D4B87C', borderColor: '#C4A86C' }}
                  onClick={handleEnrollFoundation}
                >
                  Enroll in Recommended Foundation Course <i className="fa-solid fa-arrow-right ms-1" />
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer px-4 py-3 bg-light border-top d-flex justify-content-between">
            <Link to="/student/programs" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              <i className="fa-solid fa-compass me-1" /> Explore All Programs
            </Link>
            {onClose && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Close Modal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

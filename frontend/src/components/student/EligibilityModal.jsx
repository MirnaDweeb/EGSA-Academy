import React from 'react';
import styles from './EligibilityModal.module.css';

export default function EligibilityModal({
  isOpen,
  onClose,
  course,
  eligibilityData,
  loading = false,
  onProceedToReadiness,
  onEnrollFoundation,
  onSubmitForReview,
}) {
  if (!isOpen) return null;

  const status = eligibilityData?.status || (eligibilityData?.isEligible ? 'Eligible' : 'Manual Review');
  const isEligible = status === 'Eligible';
  const isFoundation = status === 'Foundation Required';
  const isManualReview = status === 'Manual Review';

  const missingRequirements = eligibilityData?.missingRequirements || [];
  const recommendedCourse = eligibilityData?.recommendedCourse || null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h5 className={styles.headerTitle}>
            <i className="fa-solid fa-satellite-dish me-1"></i>
            Admissions Eligibility Evaluation
          </h5>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-3 text-muted fw-semibold">
                Verifying academic prerequisites and student division against EgSA specifications...
              </p>
            </div>
          ) : (
            <>
              {/* Target Course Summary */}
              <div className={styles.infoSection}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Target Course:</span>
                  <span className={styles.infoValue}>{course?.title || 'Selected Program'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Academic Division:</span>
                  <span className={styles.infoValue}>
                    {course?.division === 'PRE_UNIVERSITY' ? 'Pre-University Division' : 'University Division'}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Course Level:</span>
                  <span className={styles.infoValue}>{course?.level || 'Training'}</span>
                </div>
                {course?.price != null && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Tuition Fee:</span>
                    <span className={styles.infoValue}>
                      {Number(course.price).toLocaleString()} {course.currency || 'EGP'}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Banner 1: Eligible */}
              {isEligible && (
                <div className={styles.bannerEligible}>
                  <i className={`fa-solid fa-circle-check ${styles.bannerIcon}`}></i>
                  <div>
                    <h6 className={styles.bannerTitle}>Candidate Verified as Eligible</h6>
                    <p className={styles.bannerDesc}>
                      You have satisfied all division requirements, academic level requirements, and prerequisite courses.
                      You are cleared to advance to the Readiness Assessment and Cohort Seat Reservation.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Banner 2: Foundation Required */}
              {isFoundation && (
                <div>
                  <div className={styles.bannerFoundation}>
                    <i className={`fa-solid fa-triangle-exclamation ${styles.bannerIcon}`}></i>
                    <div>
                      <h6 className={styles.bannerTitle}>Foundation Course Required</h6>
                      <p className={styles.bannerDesc}>
                        This course requires completed prerequisite knowledge before enrollment can be authorized.
                      </p>
                    </div>
                  </div>

                  {missingRequirements.length > 0 && (
                    <div className="mb-3 p-3 bg-light rounded border border-warning-subtle">
                      <div className="fw-bold text-dark small mb-1">
                        <i className="fa-solid fa-list-check me-1 text-warning"></i>
                        Missing Prerequisite Requirements:
                      </div>
                      <ul className={styles.requirementsList}>
                        {missingRequirements.map((req, idx) => (
                          <li key={idx} className="text-danger fw-semibold">
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recommendedCourse && (
                    <div className="p-3 bg-white rounded border border-2 border-primary-subtle mb-3">
                      <small className="text-uppercase text-muted fw-bold d-block mb-1">
                        Recommended Pathway Foundation Course
                      </small>
                      <h6 className="fw-bold text-primary mb-1">{recommendedCourse.title}</h6>
                      <div className="small text-muted mb-2">
                        Level: <span className="fw-semibold text-dark">{recommendedCourse.level || 'Foundation'}</span> ·
                        Division: <span className="fw-semibold text-dark">{recommendedCourse.division || 'PRE_UNIVERSITY'}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.btnWarning}
                        onClick={() => onEnrollFoundation && onEnrollFoundation(recommendedCourse)}
                      >
                        <i className="fa-solid fa-arrow-right me-1"></i>
                        Enroll in Foundation Course: {recommendedCourse.title}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status Banner 3: Manual Review */}
              {isManualReview && (
                <div>
                  <div className={styles.bannerManualReview}>
                    <i className={`fa-solid fa-circle-info ${styles.bannerIcon}`}></i>
                    <div>
                      <h6 className={styles.bannerTitle}>Queued for Academic Affairs Manual Review</h6>
                      <p className={styles.bannerDesc}>
                        Your application requires manual review and endorsement by the Academic Affairs committee before admission can proceed.
                      </p>
                    </div>
                  </div>

                  {missingRequirements.length > 0 && (
                    <div className="mb-3 p-3 bg-light rounded border">
                      <div className="fw-bold text-dark small mb-1">
                        <i className="fa-solid fa-clipboard-question me-1 text-primary"></i>
                        Review Reason & Verification Criteria:
                      </div>
                      <ul className={styles.requirementsList}>
                        {missingRequirements.map((req, idx) => (
                          <li key={idx} className="text-secondary fw-semibold">
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="small text-muted mb-0">
                    <i className="fa-solid fa-clock me-1"></i>
                    Applications under manual review are evaluated by Division Administrators within 2-3 business days. You will receive an official notification once reviewed.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Close
          </button>

          {isEligible && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onProceedToReadiness}
            >
              <i className="fa-solid fa-circle-arrow-right"></i>
              Proceed to Readiness Assessment
            </button>
          )}

          {isManualReview && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onSubmitForReview}
            >
              <i className="fa-solid fa-paper-plane"></i>
              Submit Application for Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import styles from './AssessmentComponents.module.css';
import AssessmentStatusBadge from './AssessmentStatusBadge';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentCard({
  assessment,
  onView,
  language = 'en',
}) {
  if (!assessment) return null;
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const dueDate = assessment.deadline || assessment.dueDate || assessment.assessmentDate;
  const formattedDeadline = dueDate
    ? new Date(dueDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const isGraded = assessment.status === 'Graded' || assessment.evaluationStatus === 'Evaluated';
  const isSubmitted = assessment.status === 'Pending Review' || assessment.status === 'Submitted Late' || assessment.submissionStatus === 'Submitted';
  const isQuiz = assessment.type === 'Quiz';

  let actionLabel = t.viewAssessment;
  let actionIcon = 'fa-arrow-right';
  if (isGraded) {
    actionLabel = isAr ? 'عرض النتيجة والتقييم' : 'View Grade';
    actionIcon = 'fa-award';
  } else if (isSubmitted) {
    actionLabel = isAr ? 'عرض التسليم' : 'View Submission';
    actionIcon = 'fa-file-circle-check';
  } else if (isQuiz) {
    actionLabel = isAr ? 'بدء الاختبار' : 'Take Quiz';
    actionIcon = 'fa-play';
  } else {
    actionLabel = isAr ? 'تسليم التكليف' : 'Submit Lab';
    actionIcon = 'fa-upload';
  }

  return (
    <div className={styles.assessmentCard}>
      <div className={styles.assessmentCardHeader}>
        <div className="flex-grow-1 overflow-hidden">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span
              className={`badge fw-bold text-uppercase border ${
                isQuiz
                  ? 'bg-info-subtle text-info border-info-subtle'
                  : 'bg-primary-subtle text-primary border-primary-subtle'
              }`}
              style={{ fontSize: '0.75rem' }}
            >
              {assessment.type || 'Technical Assessment'}
            </span>
            {assessment.weight != null && (
              <span className="badge bg-light text-muted border" style={{ fontSize: '0.72rem' }}>
                {t.weight}: {assessment.weight}%
              </span>
            )}
            <AssessmentStatusBadge
              status={assessment.status}
              submissionStatus={assessment.submissionStatus || (assessment.isSubmitted ? 'Submitted' : 'Not Submitted')}
              evaluationStatus={assessment.evaluationStatus || (isGraded ? 'Evaluated' : 'Scheduled')}
              isLate={assessment.isLate}
              resultLabel={assessment.resultLabel}
              language={language}
            />
          </div>

          <h5 className="fw-bold text-dark mb-1 text-truncate" title={assessment.title}>
            {assessment.title}
          </h5>

          <div className="text-secondary small d-flex flex-wrap align-items-center gap-2">
            <span>
              <i className="fa-solid fa-graduation-cap me-1 text-primary"></i>
              <strong>{t.course}:</strong> {assessment.courseTitle || 'EGSA Course'}
            </span>
            {assessment.cohortName && (
              <span className="border-start ps-2">
                <i className="fa-solid fa-users me-1 text-secondary"></i>
                <strong>{t.cohort}:</strong> {assessment.cohortName}
              </span>
            )}
          </div>
        </div>

        {/* View Action CTA */}
        <div className="flex-shrink-0 text-end">
          <button
            type="button"
            className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-2 shadow-sm px-3"
            onClick={() => onView(assessment)}
          >
            <span>{actionLabel}</span>
            <i className={`fa-solid ${actionIcon} fs-8`}></i>
          </button>
        </div>
      </div>

      {/* Meta Row: Instructor, Deadline, Max Score */}
      <div className={styles.cardMetaRow}>
        <span className={styles.cardMetaItem}>
          <i className="fa-solid fa-user-tie text-primary"></i>
          <span>{t.instructor}: <strong>{assessment.instructorName || 'EGSA Faculty'}</strong></span>
        </span>

        <span className={styles.cardMetaItem}>
          <i className="fa-regular fa-clock text-warning"></i>
          <span>{t.deadline}: <strong>{formattedDeadline}</strong></span>
        </span>

        {assessment.maxScore != null && (
          <span className={styles.cardMetaItem}>
            <i className="fa-solid fa-bullseye text-info"></i>
            <span>{t.maxScore}: <strong>{assessment.maxScore}</strong></span>
          </span>
        )}

        {isGraded && assessment.score != null && (
          <span className={styles.cardMetaItem}>
            <i className="fa-solid fa-award text-teal" style={{ color: '#1E7C85' }}></i>
            <span className="fw-bold" style={{ color: '#1E7C85' }}>
              {t.score}: {assessment.score} / {assessment.maxScore} ({assessment.percentage}%)
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

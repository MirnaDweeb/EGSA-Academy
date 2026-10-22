import React from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentStatusBadge({
  status = null,
  submissionStatus = 'Not Submitted',
  evaluationStatus = 'Scheduled',
  isLate = false,
  resultLabel = null,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const rawStatus = (status || '').toLowerCase().replace(/_/g, ' ');
  const isGraded =
    rawStatus === 'graded' ||
    rawStatus === 'evaluated' ||
    evaluationStatus === 'Evaluated' ||
    evaluationStatus === 'Graded' ||
    Boolean(resultLabel);

  const isLateSubmission = Boolean(
    isLate || rawStatus === 'submitted late' || rawStatus === 'late'
  );

  const isPending =
    !isGraded &&
    (rawStatus === 'pending review' ||
      rawStatus === 'pending evaluation' ||
      rawStatus === 'submitted' ||
      submissionStatus === 'Submitted' ||
      evaluationStatus === 'Pending' ||
      isLateSubmission);

  return (
    <div className={styles.badgeStrip}>
      {isGraded ? (
        <span className={styles.badgeGraded}>
          <i className="fa-solid fa-circle-check"></i>
          {isAr ? 'تم التصحيح' : 'Graded'}
          {resultLabel ? ` (${resultLabel === 'Passed' ? (isAr ? 'ناجح' : 'Passed') : (isAr ? 'راسب' : 'Failed')})` : ''}
        </span>
      ) : isPending ? (
        <span className={styles.badgePendingReview}>
          <i className="fa-solid fa-hourglass-half"></i>
          {isAr ? 'قيد المراجعة' : 'Pending Review'}
        </span>
      ) : (
        <span className={styles.badgeUpcoming}>
          <i className="fa-solid fa-calendar-day"></i>
          {isAr ? 'قادم' : 'Upcoming'}
        </span>
      )}

      {isLateSubmission && (
        <span className={styles.badgeSubmittedLate}>
          <i className="fa-solid fa-triangle-exclamation"></i>
          {isAr ? 'متأخر' : 'Submitted Late'}
        </span>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';
import AssessmentSubmission from './AssessmentSubmission';

export default function SubmissionStatus({
  assessment,
  submission,
  onResubmitSuccess,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const isAr = language === 'ar';
  const [isResubmitting, setIsResubmitting] = useState(false);

  if (!submission) return null;

  const isQuiz = assessment?.type === 'Quiz';
  const allowResubmission = Boolean(assessment?.allowResubmission);
  const submittedDate = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const downloadFileUrl = submission.file?.downloadUrl || (submission.file?.fileUrl ? `${submission.file.fileUrl}?download=true` : '#');
  const viewFileUrl = submission.file?.viewUrl || submission.file?.fileUrl || downloadFileUrl;

  const isLate = Boolean(submission.isLate);
  const isGraded = submission.status === 'Graded';
  const score = submission.score;
  const maxScore = submission.maxScore || assessment?.maxScore || 100;
  const percentage = maxScore > 0 && score != null ? Math.round((score / maxScore) * 100) : null;
  const passed = percentage != null ? percentage >= (assessment?.passingScore || 70) : null;

  return (
    <div className="d-flex flex-column gap-3">
      {/* 1. Status / Graded Banner */}
      {isGraded ? (
        <div
          className="p-3 rounded-3 border d-flex align-items-center justify-content-between shadow-sm"
          style={{
            backgroundColor: passed ? 'rgba(30, 124, 133, 0.08)' : 'rgba(223, 79, 76, 0.08)',
            borderColor: passed ? '#1E7C85' : '#DF4F4C',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: passed ? '#1E7C85' : '#DF4F4C',
                color: '#ffffff',
              }}
            >
              <i className={`fa-solid ${passed ? 'fa-award' : 'fa-circle-xmark'} fa-lg`}></i>
            </div>
            <div>
              <h6 className="fw-bold mb-0" style={{ color: passed ? '#1E7C85' : '#DF4F4C' }}>
                {isQuiz
                  ? isAr ? 'تم تصحيح الاختبار التقني تلقائياً' : 'Quiz Auto-Graded Successfully'
                  : isAr ? 'تم تقييم التكليف من قبل المحاضر' : 'Submission Evaluated by Faculty'}
              </h6>
              <span className="text-secondary small">
                {isAr
                  ? `النتيجة النهائية: ${score} من ${maxScore} (${percentage}٪) • ${passed ? 'ناجح' : 'غير مجتاز'}`
                  : `Score: ${score} / ${maxScore} (${percentage}%) • Status: ${passed ? 'Passed' : 'Failed'}`}
              </span>
            </div>
          </div>
          <span
            className="badge px-3 py-2 fw-bold text-uppercase"
            style={{
              backgroundColor: passed ? '#1E7C85' : '#DF4F4C',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            {passed ? (isAr ? 'ناجح' : 'PASSED') : (isAr ? 'راسب' : 'FAILED')}
          </span>
        </div>
      ) : (
        <div
          className="p-3 rounded-3 border d-flex align-items-center justify-content-between shadow-sm"
          style={{
            backgroundColor: isLate ? 'rgba(223, 79, 76, 0.06)' : 'rgba(212, 184, 124, 0.08)',
            borderColor: isLate ? '#DF4F4C' : '#D4B87C',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
              style={{
                width: '42px',
                height: '42px',
                backgroundColor: isLate ? '#DF4F4C' : '#D4B87C',
                color: '#ffffff',
              }}
            >
              <i className={`fa-solid ${isLate ? 'fa-triangle-exclamation' : 'fa-hourglass-half'} fa-lg`}></i>
            </div>
            <div>
              <h6 className="fw-bold mb-0" style={{ color: isLate ? '#DF4F4C' : '#927027' }}>
                {isLate
                  ? isAr ? 'تم التسليم متأخراً (فترة السماح)' : 'Submitted Late (Grace Period)'
                  : isAr ? 'تم استلام التكليف بنجاح' : 'Submission Received Successfully'}
              </h6>
              <span className="text-secondary small">
                {isLate && submission.minutesLate
                  ? isAr ? `متأخر بمقدار ${submission.minutesLate} دقيقة عن الموعد المحدد` : `${submission.minutesLate} minute(s) past deadline`
                  : isAr ? 'قيد المراجعة الأكاديمية والتقييم' : 'Pending review and qualitative grading by instructor'}
              </span>
            </div>
          </div>
          <span
            className="badge px-3 py-2 fw-bold"
            style={{
              backgroundColor: isLate ? '#DF4F4C' : '#D4B87C',
              color: '#ffffff',
              fontSize: '0.78rem',
            }}
          >
            {isLate ? (isAr ? 'تسليم متأخر' : 'Submitted Late') : (isAr ? 'قيد المراجعة' : 'Pending Review')}
          </span>
        </div>
      )}

      {/* 2. Submission Details Card */}
      <div className={styles.submittedCard || 'bg-white p-3 rounded-3 border'}>
        <div className="d-flex justify-content-between align-items-start gap-2 border-bottom pb-2 mb-3">
          <div>
            <span className="text-uppercase text-muted fw-bold small" style={{ fontSize: '0.72rem' }}>
              {t.mySubmission} &bull; {assessment?.type || 'Assessment'}
            </span>
            <div className="d-flex align-items-center gap-2 mt-1">
              {isGraded ? (
                <span className="badge" style={{ backgroundColor: 'rgba(30, 124, 133, 0.12)', color: '#1E7C85', border: '1px solid #1E7C85' }}>
                  <i className="fa-solid fa-circle-check me-1"></i>
                  {isAr ? 'تم التصحيح' : 'Graded'}
                </span>
              ) : (
                <span className="badge" style={{ backgroundColor: 'rgba(212, 184, 124, 0.15)', color: '#B38F3F', border: '1px solid #D4B87C' }}>
                  <i className="fa-solid fa-hourglass-half me-1"></i>
                  {isAr ? 'قيد المراجعة' : 'Pending Review'}
                </span>
              )}
              {isLate && (
                <span className="badge" style={{ backgroundColor: 'rgba(223, 79, 76, 0.15)', color: '#DF4F4C', border: '1px solid #DF4F4C' }}>
                  <i className="fa-solid fa-triangle-exclamation me-1"></i>
                  {isAr ? 'متأخر' : 'Submitted Late'}
                </span>
              )}
            </div>
          </div>

          <div className="text-end text-muted small">
            <span className="d-block" style={{ fontSize: '0.75rem' }}>{t.submittedDate}:</span>
            <strong className="text-dark">{submittedDate}</strong>
          </div>
        </div>

        {/* Deliverable URL (if present) */}
        {submission.submissionUrl && (
          <div className="mb-3">
            <span className="text-muted fw-semibold small d-block mb-1">
              <i className="fa-solid fa-link text-primary me-1"></i>
              {isAr ? 'رابط المشروع / المستودع' : 'Deliverable / Repository URL'}
            </span>
            <div className="p-2 px-3 bg-light rounded-3 border d-flex align-items-center justify-content-between">
              <span className="text-dark font-monospace small text-truncate me-2" title={submission.submissionUrl}>
                {submission.submissionUrl}
              </span>
              <a
                href={submission.submissionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-outline-primary flex-shrink-0"
                style={{ fontSize: '0.75rem' }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
                {isAr ? 'فتح الرابط' : 'Open Link'}
              </a>
            </div>
          </div>
        )}

        {/* Notes / Text Answer (if present) */}
        {(submission.notes || submission.textAnswer) && (
          <div className="mb-3">
            <span className="text-muted fw-semibold small d-block mb-1">
              <i className="fa-solid fa-align-left text-primary me-1"></i>
              {isAr ? 'الملاحظات والملخص الفني' : 'Cadet Submission Notes'}
            </span>
            <div className="p-3 bg-light rounded-3 border text-dark small" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {submission.notes || submission.textAnswer}
            </div>
          </div>
        )}

        {/* Uploaded File (if present) */}
        {submission.file?.originalName && (
          <div className="mb-3">
            <span className="text-muted fw-semibold small d-block mb-1">{t.submittedFileLabel}</span>
            <div className="p-2 px-3 bg-light rounded-3 border d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                <i className="fa-solid fa-file-lines text-primary flex-shrink-0"></i>
                <span className="text-dark fw-semibold small text-truncate" title={submission.file.originalName}>
                  {submission.file.originalName}
                </span>
              </div>
              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                {viewFileUrl && (
                  <a
                    href={viewFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-xs btn-outline-secondary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    <i className="fa-solid fa-eye me-1"></i>
                    {t.viewFile}
                  </a>
                )}
                {downloadFileUrl && (
                  <a
                    href={downloadFileUrl}
                    download={submission.file.originalName}
                    className="btn btn-xs btn-outline-primary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    <i className="fa-solid fa-download me-1"></i>
                    {t.downloadFile}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructor Feedback (if graded) */}
        {isGraded && (submission.feedback || submission.notesFeedback) && (
          <div className="p-3 rounded-3 border mb-3" style={{ backgroundColor: 'rgba(30, 124, 133, 0.05)', borderColor: '#1E7C85' }}>
            <span className="fw-bold small d-block mb-1" style={{ color: '#1E7C85' }}>
              <i className="fa-solid fa-comment-dots me-2"></i>
              {isAr ? 'ملاحظات المحاضر وتوجيهات التطوير' : 'Faculty Feedback & Evaluation Notes'}
            </span>
            <p className="text-dark small mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {submission.feedback || submission.notesFeedback}
            </p>
          </div>
        )}

        {/* Quiz Questions Breakdown (if quiz and graded) */}
        {isQuiz && submission.answers && submission.answers.length > 0 && assessment?.questions && (
          <div className="mt-3">
            <h6 className="fw-bold text-dark small text-uppercase mb-2">
              <i className="fa-solid fa-list-check text-info me-2"></i>
              {isAr ? 'مراجعة إجابات الاختبار' : 'Question Breakdown & Solutions'}
            </h6>
            <div className="d-flex flex-column gap-2">
              {assessment.questions.map((q, idx) => {
                const ans = submission.answers.find((a) => a.questionIndex === idx) || {};
                const isCorrect = Boolean(ans.isCorrect);
                const selectedOptText = q.options?.[ans.selectedOption] || (isAr ? 'لم تتم الإجابة' : 'Not answered');
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-3 border"
                    style={{
                      backgroundColor: isCorrect ? 'rgba(30, 124, 133, 0.04)' : 'rgba(223, 79, 76, 0.04)',
                      borderColor: isCorrect ? '#1E7C85' : '#DF4F4C',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold small text-dark">
                        {idx + 1}. {q.questionText}
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: isCorrect ? '#1E7C85' : '#DF4F4C',
                          color: '#ffffff',
                        }}
                      >
                        {isCorrect ? `+${ans.pointsAwarded || q.points || 0} pts` : '0 pts'}
                      </span>
                    </div>
                    <div className="small text-secondary">
                      <strong>{isAr ? 'إجابتك:' : 'Your answer:'}</strong> {selectedOptText}
                    </div>
                    {q.explanation && (
                      <div className="small text-muted mt-1 fst-italic">
                        <strong>{isAr ? 'التوضيح العلمي:' : 'Explanation:'}</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resubmission Controls */}
        {allowResubmission && !isResubmitting && (
          <div className="pt-2 border-top d-flex justify-content-between align-items-center mt-3">
            <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
              <i className="fa-solid fa-circle-info text-primary me-1"></i>
              {t.resubmitInfo}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary fw-semibold"
              onClick={() => setIsResubmitting(true)}
            >
              <i className="fa-solid fa-arrows-rotate me-1"></i>
              {t.resubmit}
            </button>
          </div>
        )}

        {allowResubmission && isResubmitting && (
          <div className="pt-3 border-top mt-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <i className="fa-solid fa-arrows-rotate text-primary"></i>
                {t.resubmit}
              </h6>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setIsResubmitting(false)}
              >
                {t.cancelResubmit}
              </button>
            </div>
            <AssessmentSubmission
              assessment={assessment}
              language={language}
              onSuccess={(updatedSub) => {
                setIsResubmitting(false);
                if (onResubmitSuccess) onResubmitSuccess(updatedSub);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

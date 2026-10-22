import React, { useState, useRef } from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';
import { assessmentService } from '../../services/cycleServices';

export default function AssessmentSubmission({
  assessment,
  onSuccess,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const isAr = language === 'ar';
  const fileInputRef = useRef(null);

  const isQuiz = assessment?.type === 'Quiz';
  const dueDate = assessment?.deadline || assessment?.dueDate || assessment?.assessmentDate;
  const isDeadlinePassed = dueDate ? new Date() > new Date(dueDate) : false;
  const minutesPassed = dueDate && isDeadlinePassed
    ? Math.round((new Date() - new Date(dueDate)) / 60000)
    : 0;

  // Quiz state
  const questions = assessment?.questions || [];
  const [selectedAnswers, setSelectedAnswers] = useState({});

  // Assignment state
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Common submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState('');

  // -------------------------------------------------------------
  // File Validation
  // -------------------------------------------------------------
  const FORBIDDEN_EXTS = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.bin', '.js', '.vbs', '.php', '.jar'];
  const validateFile = (file) => {
    if (!file) return null;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (FORBIDDEN_EXTS.includes(ext)) {
      return isAr ? 'نوع الملف غير مسموح به لأسباب أمنية.' : 'File type is forbidden for security compliance.';
    }
    if (file.size > 25 * 1024 * 1024) {
      return isAr ? 'حجم الملف يتجاوز الحد الأقصى (25 ميجابايت).' : 'File size exceeds institutional limit (25 MB).';
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setClientError('');
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setClientError(err);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setClientError('');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setClientError(err);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  // -------------------------------------------------------------
  // Quiz Submission Handler
  // -------------------------------------------------------------
  const handleQuizSubmit = async (e) => {
    e.preventDefault();
    setClientError('');

    if (questions.length > 0 && Object.keys(selectedAnswers).length < questions.length) {
      setClientError(
        isAr
          ? `يرجى الإجابة على جميع الأسئلة قبل التسليم (${Object.keys(selectedAnswers).length} من ${questions.length} تمت الإجابة عليها).`
          : `Please answer all questions before submitting (${Object.keys(selectedAnswers).length} of ${questions.length} answered).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const answersArray = questions.map((_, idx) => ({
        questionIndex: idx,
        selectedOption: selectedAnswers[idx] ?? -1,
      }));

      const res = await assessmentService.submitQuiz(
        assessment.id || assessment._id,
        answersArray
      );

      if (onSuccess) {
        onSuccess(res.data || res);
      }
    } catch (err) {
      setClientError(
        err.response?.data?.message || err.message || (isAr ? 'فشل تسليم الاختبار.' : 'Failed to submit quiz.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Assignment Submission Handler
  // -------------------------------------------------------------
  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    setClientError('');

    if (!submissionUrl.trim() && !notes.trim() && !selectedFile) {
      setClientError(
        isAr
          ? 'يرجى تقديم رابط المشروع/المستودع، ملخص فني، أو رفع ملف التقرير.'
          : 'Please provide a repository/document URL, notes summary, or upload your deliverable file.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (submissionUrl.trim()) formData.append('submissionUrl', submissionUrl.trim());
        if (notes.trim()) {
          formData.append('notes', notes.trim());
          formData.append('textAnswer', notes.trim());
        }
        res = await assessmentService.submitAssignment(
          assessment.id || assessment._id,
          formData
        );
      } else {
        res = await assessmentService.submitAssignment(
          assessment.id || assessment._id,
          {
            submissionUrl: submissionUrl.trim(),
            notes: notes.trim(),
            textAnswer: notes.trim(),
          }
        );
      }

      if (onSuccess) {
        onSuccess(res.data || res);
      }
    } catch (err) {
      setClientError(
        err.response?.data?.message || err.message || (isAr ? 'فشل تسليم التكليف.' : 'Failed to submit assignment.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      {/* Client Error Banner */}
      {clientError && (
        <div className="alert alert-danger p-3 rounded-3 border-0 small d-flex align-items-center gap-2 mb-0 shadow-sm">
          <i className="fa-solid fa-circle-exclamation text-danger fs-6 flex-shrink-0"></i>
          <span>{clientError}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* QUIZ INTERACTION FORM                                     */}
      {/* ========================================================= */}
      {isQuiz ? (
        <form onSubmit={handleQuizSubmit} className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded-3 border mb-2">
            <div>
              <span className="fw-bold text-dark d-block">
                <i className="fa-solid fa-list-check text-info me-2"></i>
                {isAr ? 'اختبار تقني متعدد الأسئلة' : 'Multi-Question Technical Quiz'}
              </span>
              <span className="text-muted small" style={{ fontSize: '0.78rem' }}>
                {isAr
                  ? `إجمالي الأسئلة: ${questions.length} • حساب التقييم فوري وتلقائي عند التسليم`
                  : `Total Questions: ${questions.length} • Automated instant grading upon submission`}
              </span>
            </div>
            <div className="text-end">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-semibold">
                {Object.keys(selectedAnswers).length} / {questions.length} {isAr ? 'مُجاب' : 'Answered'}
              </span>
            </div>
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className={styles.quizQuestionCard}>
              <div className={styles.quizQuestionHeader}>
                <span className="badge bg-secondary-subtle text-dark border fw-bold">
                  {isAr ? `السؤال ${qIdx + 1}` : `Question ${qIdx + 1}`}
                </span>
                <span className="text-muted small fw-semibold">
                  <i className="fa-solid fa-star text-warning me-1"></i>
                  {q.points || Math.round((assessment.maxScore || 100) / (questions.length || 1))} {isAr ? 'درجات' : 'pts'}
                </span>
              </div>

              <h6 className="fw-bold text-dark mb-3" style={{ lineHeight: '1.5' }}>
                {q.questionText}
              </h6>

              <div className="d-flex flex-column">
                {(q.options || []).map((opt, optIdx) => {
                  const isSelected = selectedAnswers[qIdx] === optIdx;
                  return (
                    <div
                      key={optIdx}
                      className={`${styles.quizOptionCard} ${isSelected ? styles.quizOptionCardSelected : ''}`}
                      onClick={() =>
                        setSelectedAnswers((prev) => ({
                          ...prev,
                          [qIdx]: optIdx,
                        }))
                      }
                    >
                      <input
                        type="radio"
                        id={`q_${qIdx}_opt_${optIdx}`}
                        name={`question_${qIdx}`}
                        checked={isSelected}
                        onChange={() =>
                          setSelectedAnswers((prev) => ({
                            ...prev,
                            [qIdx]: optIdx,
                          }))
                        }
                        className="form-check-input mt-0 cursor-pointer flex-shrink-0"
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <label
                        htmlFor={`q_${qIdx}_opt_${optIdx}`}
                        className="form-check-label text-dark small w-100 mb-0 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                      >
                        {opt}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Submit Quiz CTA */}
          <div className="d-flex justify-content-between align-items-center mt-2 p-3 bg-white border rounded-3 shadow-sm">
            <span className="text-muted small">
              <i className="fa-solid fa-shield-halved text-primary me-1"></i>
              {isAr ? 'سيتم تسجيل نتيجتك الأكاديمية فوراً' : 'Your score will be committed immediately to academic records'}
            </span>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary fw-bold px-4 py-2 d-inline-flex align-items-center gap-2 shadow-sm"
              style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>{isAr ? 'جاري التصحيح الفوري…' : 'Evaluating Quiz…'}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>{isAr ? 'تسليم الاختبار وتصحيحه' : 'Submit & Auto-Grade'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* ========================================================= */
        /* LAB ASSIGNMENT & CAPSTONE SUBMISSION DRAWER               */
        /* ========================================================= */
        <form onSubmit={handleAssignmentSubmit} className="d-flex flex-column gap-3">
          {/* Deadline & Grace Status Indicator */}
          {isDeadlinePassed ? (
            <div className={`${styles.lateGraceBanner} d-flex align-items-start gap-3 shadow-sm`}>
              <i className="fa-solid fa-triangle-exclamation fa-lg mt-1" style={{ color: '#DF4F4C' }}></i>
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span
                    className="badge text-uppercase fw-bold"
                    style={{ backgroundColor: '#DF4F4C', color: '#ffffff', fontSize: '0.72rem' }}
                  >
                    {isAr ? 'تجاوز الموعد المحدد' : 'Past Deadline'}
                  </span>
                  <span className="fw-bold small text-danger">
                    {minutesPassed} {isAr ? 'دقيقة متأخر' : 'minutes late'}
                  </span>
                </div>
                <p className="small mb-0" style={{ color: '#881337', lineHeight: '1.45' }}>
                  {isAr
                    ? `تنبيه فترة السماح: تجاوز هذا التسليم الموعد النهائي. سيتم وسم التسليم بحالة "متأخر" (Submitted Late) وتطبيق غرامة التأخير المحددة (${assessment.latePenaltyPercent || 10}٪).`
                    : `Late Grace Period: This submission is past the deadline. It will be flagged as isLate: true (Red-Coral badge) with a ${assessment.latePenaltyPercent || 10}% configured late penalty applied.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-3 border d-flex align-items-center justify-content-between bg-light">
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-circle-check text-success"></i>
                <span className="fw-semibold text-dark small">
                  {isAr ? 'الحالة: ضمن الموعد النهائي' : 'Status: On Track (Within Deadline)'}
                </span>
              </div>
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                {dueDate ? new Date(dueDate).toLocaleString(isAr ? 'ar-EG' : 'en-US') : 'Open'}
              </span>
            </div>
          )}

          {/* 1. Project / Deliverable URL Input */}
          <div className="d-flex flex-column gap-1">
            <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-1">
              <span>
                <i className="fa-brands fa-github text-primary me-2"></i>
                {isAr ? 'رابط المستودع أو المشروع (GitHub / Drive / Docs)' : 'Deliverable / Repository URL (GitHub, Drive, Docs)'}
              </span>
              <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
                {isAr ? 'موصى به للتكليفات الفنية' : 'Recommended for code labs'}
              </span>
            </label>
            <div className="input-group">
              <span className="input-group-text bg-light text-muted">
                <i className="fa-solid fa-link"></i>
              </span>
              <input
                type="url"
                className="form-control"
                placeholder="https://github.com/cadet/cubesat-telemetry-engine"
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* 2. Text Summary & Implementation Notes */}
          <div className="d-flex flex-column gap-1">
            <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-1">
              <span>
                <i className="fa-solid fa-align-left text-primary me-2"></i>
                {isAr ? 'الملخص التنفيذي وملاحظات التنفيذ' : 'Executive Summary & Methodology Notes'}
              </span>
              <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
                {isAr ? 'مطلوب للمراجعة الأكاديمية' : 'For instructor evaluation'}
              </span>
            </label>
            <textarea
              className="form-control"
              rows="4"
              placeholder={
                isAr
                  ? 'اكتب ملخصاً تقنياً لخطوات التجربة، التحديات التي واجهتها، ونتائج القياسات الفضائية...'
                  : 'Outline your technical implementation, simulation methodology, telemetry verification results, and any relevant engineering notes...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: '0.88rem', lineHeight: '1.5' }}
            ></textarea>
          </div>

          {/* 3. Deliverable Document File Upload */}
          <div className="d-flex flex-column gap-1">
            <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-1">
              <span>
                <i className="fa-solid fa-cloud-arrow-up text-primary me-2"></i>
                {isAr ? 'تقرير المختبر المكتبي أو ملف الأرشفة (اختياري)' : 'Lab Report Document / Archive File (Optional)'}
              </span>
              <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
                PDF, ZIP, DOCX (Max 25MB)
              </span>
            </label>

            {!selectedFile ? (
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="d-none"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.tar,.gz,.csv,.txt"
                />
                <i className="fa-solid fa-file-arrow-up fa-2x text-primary mb-2 d-block"></i>
                <strong className="text-dark d-block small mb-1">
                  {isAr ? 'اضغط لاختيار ملف التقرير أو اسحبه هنا' : 'Click to select report document or drag here'}
                </strong>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  PDF, DOCX, ZIP files up to 25 MB
                </span>
              </div>
            ) : (
              <div className={styles.selectedFileInfo}>
                <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                  <i className="fa-solid fa-file-circle-check fa-lg text-primary flex-shrink-0"></i>
                  <div className="overflow-hidden">
                    <strong className="d-block text-truncate small">{selectedFile.name}</strong>
                    <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger py-1 px-2 flex-shrink-0"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <i className="fa-solid fa-trash me-1"></i> {isAr ? 'إزالة' : 'Remove'}
                </button>
              </div>
            )}
          </div>

          {/* Submit Action Button */}
          <div className="d-flex justify-content-end mt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary fw-bold px-4 py-2 d-inline-flex align-items-center gap-2 shadow-sm"
              style={{
                backgroundColor: isDeadlinePassed ? '#DF4F4C' : '#0B192C',
                borderColor: isDeadlinePassed ? '#DF4F4C' : '#0B192C',
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>{isAr ? 'جاري الإرسال…' : 'Submitting Lab…'}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>
                    {isDeadlinePassed
                      ? isAr
                        ? 'تسليم متأخر (Late Submission)'
                        : 'Submit Late Assignment'
                      : isAr
                      ? 'تسليم التكليف الفني'
                      : 'Submit Lab Assignment'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

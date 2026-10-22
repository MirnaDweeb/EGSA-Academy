import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { admissionsService, paymentService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';
import styles from './ApplicationWizardPage.module.css';

export default function ApplicationWizardPage() {
  const { courseId: paramCourseId, id: paramId } = useParams();
  const targetCourseId = paramCourseId || paramId;
  const navigate = useNavigate();
  const { user } = useAuth();

  // Wizard Navigation: 1 (Eligibility), 2 (Readiness Assessment), 3 (Competency Review), 4 (Seat Reservation & Invoice)
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  // Flow State
  const [flowData, setFlowData] = useState(null);
  const [activeCourseId, setActiveCourseId] = useState(targetCourseId);

  // Assessment Answers state: { [questionId]: optionIndex }
  const [answers, setAnswers] = useState({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  // Result from Step 2 -> Step 3
  const [assessmentResult, setAssessmentResult] = useState(null);

  // Step 4 Invoice & Countdown
  const [invoice, setInvoice] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(72 * 3600);
  const [paymentMethod, setPaymentMethod] = useState('instapay'); // 'instapay' | 'vodafone_cash' | 'credit_card'
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState(null);

  // Load initial flow data in a single round-trip
  const initFlow = async (courseToLoadId) => {
    const cid = courseToLoadId || activeCourseId;
    if (!cid) return;

    setLoading(true);
    setError('');
    try {
      const res = await admissionsService.startFlow({ courseId: cid });
      const data = res.data;
      setFlowData(data);
      setActiveCourseId(cid);

      // Check if invoice already exists
      if (data.invoice) {
        setInvoice(data.invoice);
        setRemainingSeconds(data.invoice.remainingSeconds || 72 * 3600);
      }

      // If already accepted/invoiced, allow jumping to step 4 or staying on step 1
      if (data.application?.status === 'Accepted' && data.invoice) {
        setCurrentStep(4);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to initialize application workflow.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initFlow(targetCourseId);
  }, [targetCourseId]);

  // 72-Hour Timer Countdown Hook
  useEffect(() => {
    if (currentStep !== 4 || !invoice || paymentSuccess) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, invoice, paymentSuccess]);

  // Format Remaining Seconds to DD:HH:MM:SS
  const countdownFormatted = useMemo(() => {
    const sec = Math.max(0, remainingSeconds);
    const days = Math.floor(sec / (3600 * 24));
    const hours = Math.floor((sec % (3600 * 24)) / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return { days, hours, minutes, seconds };
  }, [remainingSeconds]);

  // Answer selection handler
  const handleSelectOption = (questionId, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  // Submit Assessment handler
  const handleSubmitAssessment = async () => {
    if (!flowData?.readiness?.questions?.length) return;
    setSubmittingAssessment(true);
    setError('');

    const formattedAnswers = Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({
      questionId,
      selectedOptionIndex,
    }));

    try {
      const res = await admissionsService.completeAssessment({
        courseId: flowData.course?.id || activeCourseId,
        attemptId: flowData.readiness?.attemptId,
        applicationId: flowData.application?.id,
        answers: formattedAnswers,
      });

      const resData = res.data;
      setAssessmentResult(resData);

      if (resData.invoice) {
        setInvoice(resData.invoice);
        setRemainingSeconds(resData.invoice.remainingSeconds || 72 * 3600);
      }

      // Smoothly advance to Step 3 (Decision & Diagnostics)
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit assessment.');
    } finally {
      setSubmittingAssessment(false);
    }
  };

  // Payment handler
  const handlePayInvoice = async () => {
    if (!invoice?.id) return;
    setPaying(true);
    setError('');

    try {
      const res = await paymentService.pay(invoice.id, {
        method: paymentMethod,
        transactionReference: `EGSA-TX-${Date.now().toString().slice(-6)}`,
      });
      setPaymentSuccess(true);
      setPaymentReceipt(res.data?.payment || res.data || {});
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Payment processing failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  // Switch to foundation course
  const handleSwitchToFoundation = (foundationCourse) => {
    if (!foundationCourse?.id && !foundationCourse?._id) return;
    const nextId = foundationCourse.id || foundationCourse._id;
    setCurrentStep(1);
    setAnswers({});
    setAssessmentResult(null);
    initFlow(nextId);
  };

  if (loading) return <LoadingState label="Initializing guided application journey…" />;
  if (error && !flowData) return <ErrorState message={error} onRetry={() => initFlow(activeCourseId)} />;
  if (!flowData) return null;

  const { course, eligibility, readiness } = flowData;
  const questions = readiness?.questions || [];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.wizardContainer}>
        {/* Navigation Breadcrumb / Return */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link to="/student/courses" className="btn btn-sm btn-link text-decoration-none text-muted p-0">
            <i className="fa-solid fa-arrow-left me-1"></i> Return to Course Catalog
          </Link>
          <span className="badge bg-light text-dark border px-3 py-1 font-monospace">
            ID: {course.code || 'EGSA-CRS'}
          </span>
        </div>

        {/* Unified Stepper Progress Bar */}
        <div className={styles.stepperHeader}>
          {/* Step 1 */}
          <div className={styles.stepItem}>
            <div
              className={`${styles.stepBadge} ${
                currentStep > 1
                  ? styles.stepBadgeCompleted
                  : currentStep === 1
                  ? styles.stepBadgeActive
                  : styles.stepBadgeUpcoming
              }`}
            >
              {currentStep > 1 ? <i className="fa-solid fa-check"></i> : '1'}
            </div>
            <div className={styles.stepText}>
              <span
                className={`${styles.stepTitle} ${
                  currentStep > 1
                    ? styles.stepTitleCompleted
                    : currentStep === 1
                    ? styles.stepTitleActive
                    : styles.stepTitleUpcoming
                }`}
              >
                Eligibility
              </span>
              <span className={styles.stepSub}>Prerequisites Check</span>
            </div>
          </div>

          <div
            className={`${styles.stepDivider} ${currentStep > 1 ? styles.stepDividerActive : ''}`}
          ></div>

          {/* Step 2 */}
          <div className={styles.stepItem}>
            <div
              className={`${styles.stepBadge} ${
                currentStep > 2
                  ? styles.stepBadgeCompleted
                  : currentStep === 2
                  ? styles.stepBadgeActive
                  : styles.stepBadgeUpcoming
              }`}
            >
              {currentStep > 2 ? <i className="fa-solid fa-check"></i> : '2'}
            </div>
            <div className={styles.stepText}>
              <span
                className={`${styles.stepTitle} ${
                  currentStep > 2
                    ? styles.stepTitleCompleted
                    : currentStep === 2
                    ? styles.stepTitleActive
                    : styles.stepTitleUpcoming
                }`}
              >
                AI Readiness
              </span>
              <span className={styles.stepSub}>Embedded Exam</span>
            </div>
          </div>

          <div
            className={`${styles.stepDivider} ${currentStep > 2 ? styles.stepDividerActive : ''}`}
          ></div>

          {/* Step 3 */}
          <div className={styles.stepItem}>
            <div
              className={`${styles.stepBadge} ${
                currentStep > 3
                  ? styles.stepBadgeCompleted
                  : currentStep === 3
                  ? styles.stepBadgeActive
                  : styles.stepBadgeUpcoming
              }`}
            >
              {currentStep > 3 ? <i className="fa-solid fa-check"></i> : '3'}
            </div>
            <div className={styles.stepText}>
              <span
                className={`${styles.stepTitle} ${
                  currentStep > 3
                    ? styles.stepTitleCompleted
                    : currentStep === 3
                    ? styles.stepTitleActive
                    : styles.stepTitleUpcoming
                }`}
              >
                Diagnostic
              </span>
              <span className={styles.stepSub}>Outcome & Path</span>
            </div>
          </div>

          <div
            className={`${styles.stepDivider} ${currentStep > 3 ? styles.stepDividerActive : ''}`}
          ></div>

          {/* Step 4 */}
          <div className={styles.stepItem}>
            <div
              className={`${styles.stepBadge} ${
                currentStep === 4 ? styles.stepBadgeActive : styles.stepBadgeUpcoming
              }`}
            >
              {paymentSuccess ? <i className="fa-solid fa-check"></i> : '4'}
            </div>
            <div className={styles.stepText}>
              <span
                className={`${styles.stepTitle} ${
                  currentStep === 4 ? styles.stepTitleActive : styles.stepTitleUpcoming
                }`}
              >
                Reservation
              </span>
              <span className={styles.stepSub}>T-72h Invoice</span>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
            <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
            <button type="button" className="btn-close" onClick={() => setError('')}></button>
          </div>
        )}

        {/* Main Wizard Card Container */}
        <div className={styles.wizardCard}>
          {/* Target Course Summary Bar */}
          <div className={styles.courseSummaryBar}>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-info-subtle text-info border px-2 py-1 small">
                  {course.level} Level
                </span>
                <span className="badge bg-secondary-subtle text-white border px-2 py-1 small">
                  {course.division === 'PRE_UNIVERSITY' ? 'Pre-University Cadet' : 'University Engineering'}
                </span>
              </div>
              <h4 className="fw-bold mb-0 text-white">{course.title}</h4>
            </div>
            <div className="text-end">
              <span className="text-light small d-block opacity-75">Tuition Fee</span>
              <span className="fs-5 fw-bold text-white">
                {course.price ? `${course.price.toLocaleString()} ${course.currency || 'EGP'}` : 'Sponsored / 0 EGP'}
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* STEP 1: ELIGIBILITY & PREREQUISITES REVIEW                                */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div>
              <h4 className="fw-bold text-dark mb-2">Step 1: Prerequisites & Academic Verification</h4>
              <p className="text-muted small mb-4">
                The Academy admissions engine compares your profile division and completed foundational courses against target requirements.
              </p>

              {/* Status Outcome Banner */}
              {eligibility.status === 'Eligible' && (
                <div className={styles.bannerSuccess}>
                  <div className="d-flex align-items-center gap-3">
                    <i className="fa-solid fa-circle-check fs-2 text-success"></i>
                    <div>
                      <h6 className="fw-bold text-success mb-1">Eligibility Criteria Satisfied!</h6>
                      <p className="small text-muted mb-0">
                        You meet all academic track prerequisites. You are cleared to begin the embedded AI Readiness Assessment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {eligibility.status === 'Foundation Required' && (
                <div className={styles.bannerWarning}>
                  <div className="d-flex align-items-center gap-3">
                    <i className="fa-solid fa-triangle-exclamation fs-2 text-warning"></i>
                    <div>
                      <h6 className="fw-bold text-warning-emphasis mb-1">Prerequisite Foundation Course Required</h6>
                      <p className="small text-muted mb-0">
                        This advanced curriculum requires mastery of foundational space concepts before admission.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {eligibility.status === 'Manual Review' && (
                <div className={styles.bannerDanger}>
                  <div className="d-flex align-items-center gap-3">
                    <i className="fa-solid fa-user-shield fs-2 text-danger"></i>
                    <div>
                      <h6 className="fw-bold text-danger mb-1">Academic Affairs Review Required</h6>
                      <p className="small text-muted mb-0">
                        Cross-division application detected. Pre-University Cadets applying for University courses require committee waiver.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Requirements Comparison Grid */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="p-3 bg-light rounded border h-100">
                    <h6 className="fw-bold text-dark mb-2 small text-uppercase">
                      <i className="fa-solid fa-list-check me-2 text-primary"></i> Course Requirements
                    </h6>
                    <div className="small">
                      <div className="mb-2">
                        <span className="text-muted">Target Division:</span>{' '}
                        <strong>{course.division === 'PRE_UNIVERSITY' ? 'Pre-University Cadets' : 'University Students'}</strong>
                      </div>
                      <div className="mb-2">
                        <span className="text-muted">Prerequisites:</span>{' '}
                        {course.prerequisites?.length > 0 ? (
                          <span className="fw-bold text-dark">
                            {course.prerequisites.map((p) => p.title || p).join(', ')}
                          </span>
                        ) : (
                          <span className="text-success fw-bold">Open Admission (No Prerequisites)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted">Readiness Passing Score:</span>{' '}
                        <strong>{course.readinessThreshold || 70}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 bg-light rounded border h-100">
                    <h6 className="fw-bold text-dark mb-2 small text-uppercase">
                      <i className="fa-solid fa-user-graduate me-2 text-primary"></i> Student Profile Match
                    </h6>
                    <div className="small">
                      <div className="mb-2">
                        <span className="text-muted">Logged Student:</span> <strong>{user?.fullName}</strong>
                      </div>
                      <div className="mb-2">
                        <span className="text-muted">Current Division:</span>{' '}
                        <span className="badge bg-secondary-subtle text-dark border">
                          {eligibility.studentDivision || user?.division || 'UNIVERSITY'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">Missing Items:</span>{' '}
                        {eligibility.missingRequirements?.length > 0 ? (
                          <ul className="text-danger ps-3 mb-0 mt-1">
                            {eligibility.missingRequirements.map((m, idx) => (
                              <li key={idx}>{m}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-success fw-bold">None (100% Qualified)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Step 1 */}
              <div className="d-flex flex-wrap justify-content-between align-items-center pt-3 border-top gap-2">
                <Link to="/student/courses" className={styles.btnSecondaryAction}>
                  <i className="fa-solid fa-arrow-left"></i> Back to Catalog
                </Link>

                {eligibility.isEligible ? (
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => {
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <span>Begin AI Readiness Assessment</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                ) : eligibility.recommendedCourse ? (
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => handleSwitchToFoundation(eligibility.recommendedCourse)}
                  >
                    <i className="fa-solid fa-arrow-right-arrow-left"></i>
                    <span>Apply to Foundation: {eligibility.recommendedCourse.title}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => {
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <span>Proceed to Assessment Anyway</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: EMBEDDED AI READINESS ASSESSMENT                                  */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="fw-bold text-dark mb-0">Step 2: AI Readiness Assessment</h4>
                <span className="badge bg-primary px-3 py-2">
                  <i className="fa-solid fa-clock me-1"></i> 15:00 Time Allowance
                </span>
              </div>
              <p className="text-muted small mb-4">
                Embedded diagnostic test measuring baseline aerospace physics, telemetry systems, and engineering math.
              </p>

              {/* Question Navigation Tracker */}
              <div className="p-3 bg-light rounded border mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2 small">
                  <span>
                    Answered <strong>{answeredCount}</strong> of <strong>{totalQuestions}</strong> questions
                  </span>
                  <span className="fw-bold text-primary">
                    {Math.round((answeredCount / (totalQuestions || 1)) * 100)}% Complete
                  </span>
                </div>
                <div className="progress" style={{ height: '6px' }}>
                  <div
                    className="progress-bar bg-success"
                    style={{ width: `${(answeredCount / (totalQuestions || 1)) * 100}%` }}
                  ></div>
                </div>

                {/* Quick Question Pills */}
                <div className="d-flex flex-wrap gap-1 mt-3">
                  {questions.map((q, idx) => {
                    const isAnswered = answers[q.id || q.questionId] !== undefined;
                    const isCurrent = idx === currentQuestionIdx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`btn btn-sm ${
                          isCurrent
                            ? 'btn-dark'
                            : isAnswered
                            ? 'btn-success'
                            : 'btn-outline-secondary'
                        }`}
                        style={{ width: '32px', height: '32px', padding: 0 }}
                        onClick={() => setCurrentQuestionIdx(idx)}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Question Box */}
              {currentQuestion ? (
                <div className={styles.questionBox}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="badge bg-secondary text-white small px-2 py-1">
                      Question {currentQuestionIdx + 1} of {totalQuestions}
                    </span>
                    <span className="badge bg-light text-muted border small">
                      Topic: {currentQuestion.topic || 'Aerospace Core'}
                    </span>
                  </div>

                  <h5 className="fw-bold text-dark mb-3 mt-2">
                    {currentQuestion.questionText || currentQuestion.question}
                  </h5>

                  {/* Options */}
                  <div className="mt-3">
                    {currentQuestion.options?.map((opt, optIdx) => {
                      const qKey = currentQuestion.id || currentQuestion.questionId;
                      const isSelected = answers[qKey] === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`${styles.optionCard} ${isSelected ? styles.optionCardSelected : ''}`}
                          onClick={() => handleSelectOption(qKey, optIdx)}
                        >
                          <input
                            type="radio"
                            name={`q_${qKey}`}
                            className={styles.optionRadio}
                            checked={isSelected}
                            onChange={() => handleSelectOption(qKey, optIdx)}
                          />
                          <span className="fw-bold me-2" style={{ color: isSelected ? '#1E7C85' : '#475569' }}>
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span className="text-dark">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Question Prev / Next Controls */}
                  <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary px-3"
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                    >
                      <i className="fa-solid fa-chevron-left me-1"></i> Previous
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary px-3"
                      disabled={currentQuestionIdx === totalQuestions - 1}
                      onClick={() => setCurrentQuestionIdx((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    >
                      Next <i className="fa-solid fa-chevron-right ms-1"></i>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted">Loading question pool...</p>
                </div>
              )}

              {/* Assessment Submit Footer */}
              <div className="d-flex flex-wrap justify-content-between align-items-center pt-3 border-top gap-2">
                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  onClick={() => setCurrentStep(1)}
                >
                  <i className="fa-solid fa-arrow-left"></i> Previous Step
                </button>

                <button
                  type="button"
                  className={styles.btnPrimaryAction}
                  disabled={submittingAssessment || answeredCount === 0}
                  onClick={handleSubmitAssessment}
                >
                  {submittingAssessment ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Analyzing Competencies…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>Submit & Analyze Readiness ({answeredCount}/{totalQuestions})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: COMPETENCY REVIEW & DECISION                                      */}
          {/* ========================================================================= */}
          {currentStep === 3 && assessmentResult && (
            <div>
              <h4 className="fw-bold text-dark mb-2">Step 3: Diagnostic Gap Analysis & Recommendation</h4>
              <p className="text-muted small mb-4">
                Automated evaluation based on cognitive weights and prerequisite competencies.
              </p>

              {/* Score Header Card */}
              <div
                className="p-4 rounded-3 text-center mb-4 border"
                style={{
                  backgroundColor: assessmentResult.passed ? '#F0FDF4' : '#FFFBEB',
                  borderColor: assessmentResult.passed ? '#1E7C85' : '#F59E0B',
                }}
              >
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center text-white mb-2 shadow-sm"
                  style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: assessmentResult.passed ? '#1E7C85' : '#F59E0B',
                  }}
                >
                  <i className={`fa-solid ${assessmentResult.passed ? 'fa-check fs-3' : 'fa-triangle-exclamation fs-3'}`}></i>
                </div>
                <h3 className="fw-bold mb-1" style={{ color: assessmentResult.passed ? '#065F46' : '#92400E' }}>
                  Readiness Score: {assessmentResult.score}%
                </h3>
                <span className="badge px-3 py-1 mb-2" style={{ backgroundColor: assessmentResult.passed ? '#1E7C85' : '#F59E0B' }}>
                  {assessmentResult.passed ? 'PASSED & QUALIFIED' : 'FOUNDATION REQUIRED'}
                </span>
                <p className="small text-muted mb-0">
                  Passing Threshold: <strong>{assessmentResult.threshold || 70}%</strong>
                </p>
              </div>

              {/* Topic Breakdown Progress */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark mb-3">
                  <i className="fa-solid fa-chart-pie me-2 text-primary"></i> Topic-Level Competency Breakdown
                </h6>
                <div className="p-3 bg-light rounded border">
                  {assessmentResult.topicBreakdown?.length > 0 ? (
                    assessmentResult.topicBreakdown.map((t, idx) => (
                      <div key={idx} className={styles.topicRow}>
                        <div className="d-flex justify-content-between align-items-center small">
                          <span className="fw-bold text-dark">
                            {t.topic} {t.passed ? <i className="fa-solid fa-circle-check text-success ms-1"></i> : <i className="fa-solid fa-circle-xmark text-danger ms-1"></i>}
                          </span>
                          <span className={t.passed ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                            {t.score}% ({t.correctQuestions}/{t.totalQuestions})
                          </span>
                        </div>
                        <div className={styles.topicBarContainer}>
                          <div
                            className={styles.topicBarFill}
                            style={{
                              width: `${t.score}%`,
                              backgroundColor: t.passed ? '#1E7C85' : '#EF4444',
                            }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted small mb-0">Topic breakdown completed across core aerospace modules.</p>
                  )}
                </div>
              </div>

              {/* Action Buttons for Step 3 */}
              <div className="d-flex flex-wrap justify-content-between align-items-center pt-3 border-top gap-2">
                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  onClick={() => setCurrentStep(2)}
                >
                  <i className="fa-solid fa-rotate-left"></i> Review Questions
                </button>

                {assessmentResult.passed ? (
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => {
                      setCurrentStep(4);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <span>Proceed to Seat Reservation & Invoicing</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                ) : assessmentResult.recommendedCourse ? (
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => handleSwitchToFoundation(assessmentResult.recommendedCourse)}
                  >
                    <i className="fa-solid fa-arrow-right-arrow-left"></i>
                    <span>Switch Application to: {assessmentResult.recommendedCourse.title}</span>
                  </button>
                ) : (
                  <Link to="/student/courses" className={styles.btnPrimaryAction}>
                    <i className="fa-solid fa-compass"></i> Explore Foundation Courses
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SEAT RESERVATION & COMMERCIAL INVOICE                             */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="fw-bold text-dark mb-0">Step 4: Seat Reservation & Commercial Invoice</h4>
                <span className="badge bg-success-subtle text-success border border-success px-3 py-1">
                  <i className="fa-solid fa-circle-check me-1"></i> Seat Reserved
                </span>
              </div>
              <p className="text-muted small mb-4">
                Your provisional seat hold is active in the upcoming academic cohort. Complete payment within 72 hours to secure placement.
              </p>

              {/* 72-Hour Countdown Widget */}
              <div className={styles.countdownWidget}>
                <div className="small text-uppercase tracking-wider text-light opacity-75 mb-2">
                  <i className="fa-solid fa-hourglass-half me-1"></i> 72-Hour Seat Reservation Countdown
                </div>
                <div className="d-flex justify-content-center align-items-center gap-2">
                  <div className={styles.timeSegment}>
                    <span className={styles.timeNumber}>{String(countdownFormatted.days).padStart(2, '0')}</span>
                    <span className={styles.timeLabel}>Days</span>
                  </div>
                  <span className="fs-3 fw-bold text-light">:</span>
                  <div className={styles.timeSegment}>
                    <span className={styles.timeNumber}>{String(countdownFormatted.hours).padStart(2, '0')}</span>
                    <span className={styles.timeLabel}>Hours</span>
                  </div>
                  <span className="fs-3 fw-bold text-light">:</span>
                  <div className={styles.timeSegment}>
                    <span className={styles.timeNumber}>{String(countdownFormatted.minutes).padStart(2, '0')}</span>
                    <span className={styles.timeLabel}>Minutes</span>
                  </div>
                  <span className="fs-3 fw-bold text-light">:</span>
                  <div className={styles.timeSegment}>
                    <span className={styles.timeNumber}>{String(countdownFormatted.seconds).padStart(2, '0')}</span>
                    <span className={styles.timeLabel}>Seconds</span>
                  </div>
                </div>
                <small className="text-light opacity-75 d-block mt-2">
                  Unpaid reservations are automatically released to the FIFO waitlist after expiration.
                </small>
              </div>

              {/* Payment Success View */}
              {paymentSuccess ? (
                <div className="p-4 rounded-3 text-center mb-4 bg-success-subtle border border-success">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center text-white mb-2 shadow-sm"
                    style={{ width: '56px', height: '56px', backgroundColor: '#1E7C85' }}
                  >
                    <i className="fa-solid fa-check fs-3"></i>
                  </div>
                  <h4 className="fw-bold text-success mb-1">Tuition Settled & Seat Officially Confirmed!</h4>
                  <p className="small text-muted mb-3">
                    Receipt Ref: <strong>{paymentReceipt?.transactionReference || 'EGSA-PAY-CONFIRMED'}</strong>
                  </p>
                  <div className="d-flex justify-content-center gap-2">
                    <Link to="/student/dashboard" className="btn btn-sm btn-primary" style={{ backgroundColor: '#1E7C85' }}>
                      <i className="fa-solid fa-gauge me-1"></i> Go to Student Dashboard
                    </Link>
                    <Link to="/student/invoices" className="btn btn-sm btn-outline-secondary">
                      <i className="fa-solid fa-receipt me-1"></i> View Official Receipt
                    </Link>
                  </div>
                </div>
              ) : (
                /* Invoice & Payment Selection */
                <div>
                  <div className="p-3 bg-light rounded border mb-4">
                    <div className="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom">
                      <div>
                        <h6 className="fw-bold mb-0 text-dark">Invoice Details</h6>
                        <span className="text-muted small">
                          Invoice #{invoice?.invoiceNumber || 'INV-2026-PENDING'}
                        </span>
                      </div>
                      <span className="badge bg-warning-subtle text-warning-emphasis border border-warning px-3 py-1">
                        Unpaid (Active Hold)
                      </span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center small py-1">
                      <span>Curriculum Tuition ({course.title})</span>
                      <strong>{invoice?.amount ? `${invoice.amount.toLocaleString()} ${invoice.currency || 'EGP'}` : 'Sponsored (0 EGP)'}</strong>
                    </div>
                    <div className="d-flex justify-content-between align-items-center small py-1">
                      <span>Lab Infrastructure & Materials</span>
                      <span className="text-success fw-bold">Included</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center small pt-2 border-top mt-1 fs-6">
                      <span className="fw-bold">Total Payable</span>
                      <span className="fw-bold text-primary">
                        {invoice?.amount ? `${invoice.amount.toLocaleString()} ${invoice.currency || 'EGP'}` : '0 EGP'}
                      </span>
                    </div>
                  </div>

                  {/* Payment Channel Selector */}
                  <h6 className="fw-bold text-dark mb-2">Select Preferred Payment Method</h6>
                  <div className="row g-2 mb-4">
                    <div className="col-md-4">
                      <div
                        className={`p-3 rounded border text-center cursor-pointer ${
                          paymentMethod === 'instapay' ? 'border-primary bg-primary-subtle' : 'bg-light'
                        }`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setPaymentMethod('instapay')}
                      >
                        <i className="fa-solid fa-building-columns fs-4 text-primary mb-2 d-block"></i>
                        <strong className="d-block small">InstaPay / Bank</strong>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Instant National Transfer</small>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div
                        className={`p-3 rounded border text-center cursor-pointer ${
                          paymentMethod === 'vodafone_cash' ? 'border-primary bg-primary-subtle' : 'bg-light'
                        }`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setPaymentMethod('vodafone_cash')}
                      >
                        <i className="fa-solid fa-mobile-screen fs-4 text-danger mb-2 d-block"></i>
                        <strong className="d-block small">Vodafone Cash</strong>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Mobile Wallet</small>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div
                        className={`p-3 rounded border text-center cursor-pointer ${
                          paymentMethod === 'credit_card' ? 'border-primary bg-primary-subtle' : 'bg-light'
                        }`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setPaymentMethod('credit_card')}
                      >
                        <i className="fa-regular fa-credit-card fs-4 text-dark mb-2 d-block"></i>
                        <strong className="d-block small">Credit / Debit Card</strong>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Visa / MasterCard</small>
                      </div>
                    </div>
                  </div>

                  {/* Settle Action Button */}
                  <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                    <button
                      type="button"
                      className={styles.btnSecondaryAction}
                      onClick={() => setCurrentStep(3)}
                    >
                      <i className="fa-solid fa-arrow-left"></i> Diagnostic Summary
                    </button>

                    <button
                      type="button"
                      className={styles.btnPrimaryAction}
                      disabled={paying}
                      onClick={handlePayInvoice}
                    >
                      {paying ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Processing Payment…
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-shield-check"></i>
                          <span>Confirm & Pay Tuition ({invoice?.amount || 0} EGP)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

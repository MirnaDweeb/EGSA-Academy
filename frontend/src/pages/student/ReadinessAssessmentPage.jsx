import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { readinessService } from '../../services/cycleServices';
import { ErrorState, ProgressBar, LoadingState } from '../../components/StateComponents.jsx';
import ReadinessResultModal from '../../components/ReadinessResultModal.jsx';

export default function ReadinessAssessmentPage() {
  const { attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  const courseIdParam = searchParams.get('courseId');

  const [questions, setQuestions] = useState([]);
  const [course, setCourse] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // 15-minute countdown timer
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      setError('');

      // 1. Check sessionStorage first for fast rendering
      const stored = sessionStorage.getItem(`egsa_attempt_${attemptId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuestions(parsed);
          }
        } catch (_) {}
      }

      // 2. Query server for attempt details, questions, course metadata & saved answers
      try {
        if (attemptId && attemptId !== 'undefined') {
          const res = await readinessService.getAttempt(attemptId);
          if (!isMounted) return;

          if (res.data?.status === 'Submitted') {
            navigate(`/student/readiness/${attemptId}/result`);
            return;
          }

          if (res.data?.course) {
            setCourse(res.data.course);
          }

          if (Array.isArray(res.data?.questions) && res.data.questions.length > 0) {
            setQuestions(res.data.questions);
            sessionStorage.setItem(`egsa_attempt_${attemptId}`, JSON.stringify(res.data.questions));
          }

          if (Array.isArray(res.data?.answers) && res.data.answers.length > 0) {
            const restored = {};
            res.data.answers.forEach((ans) => {
              const qId = ans.question?._id || ans.question;
              if (qId && typeof ans.selectedIndex === 'number' && ans.selectedIndex >= 0) {
                restored[qId] = ans.selectedIndex;
              }
            });
            setAnswers((prev) => ({ ...restored, ...prev }));
          }
        } else if (courseIdParam) {
          // If loaded via /student/readiness?courseId=...
          const cRes = await readinessService.getCourseQuestions(courseIdParam);
          if (isMounted) {
            setQuestions(cRes.data || []);
            setCourse(cRes.course || null);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        if (!stored) {
          setError(
            err.response?.data?.message ||
              'Assessment session expired or not found. Please restart from the course page.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [attemptId, courseIdParam, navigate]);

  // Timer interval countdown
  useEffect(() => {
    if (loading || submitting || showResultModal) return;
    const interval = setInterval(() => {
      setSecondsLeft((sec) => {
        if (sec <= 1) {
          clearInterval(interval);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, submitting, showResultModal]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="row justify-content-center my-5">
        <div className="col-lg-7">
          <div className="egsa-card p-5 text-center shadow-sm">
            <i className="fa-solid fa-triangle-exclamation fa-3x text-warning mb-3"></i>
            <h5 className="fw-bold text-dark mb-2">Readiness Session Notice</h5>
            <p className="text-muted small mx-auto mb-4" style={{ maxWidth: '460px' }}>
              {error}
            </p>
            <div className="d-flex justify-content-center gap-2">
              <Link to="/student/readiness/start" className="btn btn-primary btn-sm">
                <i className="fa-solid fa-rotate-right me-1"></i> Restart Assessment
              </Link>
              <Link to="/student/programs" className="btn btn-outline-secondary btn-sm">
                Explore Programs
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || questions.length === 0) {
    return <LoadingState label="Loading readiness question bank…" />;
  }

  const q = questions[current];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);
  const isTimeCritical = secondsLeft < 120; // less than 2 minutes

  const selectAnswer = (optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [q.id || q.questionId]: optionIndex,
    }));
  };

  const handlePrev = () => {
    if (current > 0) {
      setCurrent((c) => c - 1);
    }
  };

  const handleNext = () => {
    if (current < totalQuestions - 1) {
      setCurrent((c) => c + 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const payloadAnswers = questions.map((item) => {
        const qId = item.id || item.questionId;
        return {
          questionId: qId,
          selectedIndex: answers[qId] !== undefined ? answers[qId] : -1,
        };
      });

      let res;
      if (applicationId) {
        res = await readinessService.submitEngine({
          applicationId,
          attemptId,
          answers: payloadAnswers,
        });
      } else {
        res = await readinessService.submit(attemptId, payloadAnswers);
      }

      sessionStorage.removeItem(`egsa_attempt_${attemptId}`);
      setShowConfirmModal(false);

      if (res?.data) {
        setSubmissionResult(res.data);
        setShowResultModal(true);
      } else {
        navigate(`/student/readiness/${res.data?.attemptId || attemptId}/result`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit readiness assessment. Please check your network and try again.');
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="row justify-content-center my-2 my-md-4">
      <div className="col-lg-9 col-xl-8">
        {/* Header Ribbon & Timer */}
        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body p-3 p-md-4">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span className="badge px-2 py-1 text-white" style={{ backgroundColor: '#1E7C85' }}>
                    {course?.category || 'Space Technologies'}
                  </span>
                  <span className="badge bg-light text-dark border px-2 py-1">
                    {course?.level || 'Academic Readiness'}
                  </span>
                </div>
                <h5 className="fw-bold text-dark mb-0">
                  {course?.title ? `${course.title} — Technical Readiness Assessment` : 'Technical Readiness Assessment'}
                </h5>
              </div>

              {/* Countdown Timer */}
              <div
                className={`d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill border fw-bold mono ${
                  isTimeCritical ? 'border-danger bg-danger-subtle text-danger' : 'border-secondary-subtle bg-light text-dark'
                }`}
                style={{ fontSize: '0.9rem' }}
                title="Time remaining"
              >
                <i className={`fa-regular fa-clock ${isTimeCritical ? 'fa-beat text-danger' : 'text-primary-egsa'}`} />
                <span>{formatTimer(secondsLeft)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress & Question Info Strip */}
        <div className="d-flex justify-content-between align-items-center mb-2 px-1">
          <div className="d-flex align-items-center gap-2">
            <span className="badge text-white px-2.5 py-1.5 fw-bold" style={{ backgroundColor: '#1E7C85', fontSize: '0.78rem' }}>
              Question {current + 1} of {totalQuestions}
            </span>
            <span className="badge bg-light text-dark border px-2.5 py-1.5 fw-semibold" style={{ fontSize: '0.78rem' }}>
              <i className="fa-solid fa-tag me-1 text-primary-egsa" style={{ color: '#1E7C85' }} />
              {q.topic}
            </span>
          </div>
          <div className="text-muted small fw-semibold">
            {answeredCount}/{totalQuestions} Answered ({progressPercent}%)
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar percent={progressPercent} />

        {/* Question Selector Jump Pills */}
        <div className="d-flex flex-wrap gap-1.5 my-3 py-2 px-2 bg-light rounded border">
          {questions.map((item, idx) => {
            const qId = item.id || item.questionId;
            const isAnswered = answers[qId] !== undefined;
            const isCurrent = idx === current;
            return (
              <button
                key={qId}
                type="button"
                className={`btn btn-sm rounded-circle p-0 transition-all ${
                  isCurrent
                    ? 'fw-bold text-white shadow-sm'
                    : isAnswered
                    ? 'text-white'
                    : 'btn-outline-secondary'
                }`}
                style={{
                  width: '32px',
                  height: '32px',
                  fontSize: '12px',
                  backgroundColor: isCurrent ? '#D4B87C' : isAnswered ? '#1E7C85' : 'transparent',
                  borderColor: isCurrent ? '#B89B5F' : isAnswered ? '#1E7C85' : '#CBD5E1',
                  color: isCurrent ? '#1E293B' : isAnswered ? '#FFFFFF' : '#475569',
                }}
                onClick={() => setCurrent(idx)}
                title={`Jump to Question ${idx + 1}: ${item.topic}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Question Card */}
        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body p-4 p-md-5">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <span
                className="text-uppercase fw-bold tracking-wide"
                style={{ fontSize: '0.75rem', color: '#1E7C85' }}
              >
                Technical Domain: {q.topic}
              </span>
              <span className="badge bg-light text-secondary border small">
                {q.difficulty || 'Fundamentals'}
              </span>
            </div>

            <h5 className="fw-bold text-dark mb-4 lh-base" style={{ fontSize: '1.15rem' }}>
              {current + 1}. {q.questionText || q.question}
            </h5>

            {/* Single Choice Radio Options */}
            <div className="d-flex flex-column gap-2.5 mb-4" role="radiogroup" aria-labelledby="question-text">
              {q.options.map((opt, idx) => {
                const qId = q.id || q.questionId;
                const isSelected = answers[qId] === idx;
                return (
                  <label
                    key={idx}
                    className={`d-flex align-items-center gap-3 p-3 rounded border text-start cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-light shadow-sm'
                        : 'border-secondary-subtle bg-white text-dark hover-bg-light'
                    }`}
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected ? '#1E7C85' : '#E2E8F0',
                      borderWidth: isSelected ? '2px' : '1px',
                    }}
                    onClick={() => selectAnswer(idx)}
                  >
                    <input
                      type="radio"
                      name={`q_${qId}`}
                      value={idx}
                      checked={isSelected}
                      onChange={() => selectAnswer(idx)}
                      className="form-check-input mt-0 fs-5 flex-shrink-0"
                      style={{
                        accentColor: '#1E7C85',
                      }}
                      aria-label={opt}
                    />
                    <div className="flex-grow-1 lh-sm">
                      <span className="me-2 text-muted fw-semibold">{String.fromCharCode(65 + idx)}.</span>
                      <span className={isSelected ? 'fw-bold text-dark' : 'text-dark'}>{opt}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Navigation Controls */}
            <div className="d-flex justify-content-between align-items-center pt-3 border-top">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                onClick={handlePrev}
                disabled={current === 0 || submitting}
              >
                <i className="fa-solid fa-arrow-left me-1"></i> Previous
              </button>

              <div className="d-flex gap-2">
                {current < totalQuestions - 1 ? (
                  <button
                    type="button"
                    className="btn btn-sm px-4 text-white fw-semibold"
                    style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
                    onClick={handleNext}
                  >
                    Next <i className="fa-solid fa-arrow-right ms-1"></i>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm px-4 fw-bold shadow-sm"
                    style={{ backgroundColor: '#D4B87C', borderColor: '#C4A86C', color: '#1E293B' }}
                    onClick={() => setShowConfirmModal(true)}
                    disabled={submitting}
                  >
                    Review & Submit <i className="fa-solid fa-check ms-1"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Review / Submit Strip */}
        <div className="d-flex justify-content-between align-items-center px-2 text-muted small">
          <span>
            <i className="fa-solid fa-circle-info text-primary-egsa me-1" style={{ color: '#1E7C85' }}></i>
            Minimum 70% composite score required for immediate eligibility clearance.
          </span>
          {answeredCount === totalQuestions && (
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none fw-bold"
              style={{ color: '#1E7C85' }}
              onClick={() => setShowConfirmModal(true)}
            >
              Ready to submit? Click here.
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
            <div className="modal-content shadow border-0" style={{ borderRadius: '12px' }}>
              <div className="modal-header bg-light">
                <h6 className="modal-title fw-bold text-dark">
                  <i className="fa-solid fa-shield-check me-2" style={{ color: '#1E7C85' }}></i>
                  Confirm Readiness Assessment Submission
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="text-center mb-3">
                  <div className="display-6 fw-bold" style={{ color: '#1E7C85' }}>
                    {answeredCount} / {totalQuestions}
                  </div>
                  <div className="text-muted small">Questions Answered</div>
                </div>

                {answeredCount < totalQuestions ? (
                  <div className="alert alert-warning small mb-3">
                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                    You have <strong>{totalQuestions - answeredCount} unanswered questions</strong>.
                    Unanswered questions will be scored as incorrect.
                  </div>
                ) : (
                  <p className="text-muted small mb-3 text-center">
                    You have answered all {totalQuestions} questions. Once submitted, your responses will be evaluated
                    by the admissions readiness engine.
                  </p>
                )}

                <div className="p-3 bg-light rounded small text-muted">
                  <strong>Evaluation standard:</strong> Scores &ge; 70% clear the prerequisite readiness check and advance your application to <em>Eligible - Payment Pending</em>. Scores &lt; 70% automatically route to preparatory foundation coursework.
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                >
                  Return to Questions
                </button>
                <button
                  type="button"
                  className="btn btn-sm px-4 fw-bold shadow-sm"
                  style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85', color: '#FFFFFF' }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Evaluating & Submitting…
                    </>
                  ) : (
                    'Confirm & Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Readiness Result Modal (Immediately displayed on submission) */}
      <ReadinessResultModal
        show={showResultModal}
        onClose={() => {
          setShowResultModal(false);
          if (submissionResult?.attemptId) {
            navigate(`/student/readiness/${submissionResult.attemptId}/result`);
          }
        }}
        result={submissionResult}
        course={course}
        applicationId={applicationId}
      />
    </div>
  );
}

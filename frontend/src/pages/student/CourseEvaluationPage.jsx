import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { evaluationService, enrollmentService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

const RATING_LABELS = {
  5: '5 - Outstanding',
  4: '4 - Very Good',
  3: '3 - Satisfactory',
  2: '2 - Needs Improvement',
  1: '1 - Unsatisfactory',
};

const CRITERIA = [
  {
    key: 'contentRating',
    label: 'Content Quality & Scientific Depth',
    description: 'Syllabus rigour, orbital mechanics relevance, and aerospace engineering theory.',
  },
  {
    key: 'instructorRating',
    label: 'Instructor Pedagogical & Practical Delivery',
    description: 'Lecturer technical mastery, interactive mentoring, and flight hardware guidance.',
  },
  {
    key: 'facilitiesRating',
    label: 'Lab Equipment, Simulators & Facilities',
    description: 'Clean room standards, CubeSat telemetry benches, hardware-in-the-loop simulators.',
  },
  {
    key: 'organizationRating',
    label: 'Platform & Administrative Coordination',
    description: 'Session scheduling, communication speed, platform usability, and support responsiveness.',
  },
];

export default function CourseEvaluationPage() {
  const navigate = useNavigate();
  const { cohortId: paramCohortId } = useParams();
  const [searchParams] = useSearchParams();
  const targetId = paramCohortId || searchParams.get('cohortId') || searchParams.get('courseId');

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [existingEvaluation, setExistingEvaluation] = useState(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // Form states
  const [ratings, setRatings] = useState({
    contentRating: 5,
    instructorRating: 5,
    facilitiesRating: 5,
    organizationRating: 5,
  });
  const [comments, setComments] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Load enrollment and evaluation status
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    async function loadData() {
      try {
        const enrRes = await enrollmentService.my();
        const enrollments = enrRes.data || [];

        let currentEnr = null;
        if (targetId) {
          currentEnr = enrollments.find(
            (e) =>
              String(e.cohort?._id || e.cohort) === String(targetId) ||
              String(e.course?._id || e.course) === String(targetId) ||
              String(e._id) === String(targetId)
          );
        }

        // Fallback to first active/completed enrollment if no specific target requested
        if (!currentEnr && enrollments.length > 0) {
          currentEnr =
            enrollments.find((e) => ['Completed', 'Active', 'Confirmed'].includes(e.status)) ||
            enrollments[0];
        }

        if (!isMounted) return;
        setEnrollment(currentEnr);

        if (currentEnr) {
          const cohortOrCourseId =
            currentEnr.cohort?._id ||
            currentEnr.cohort ||
            currentEnr.course?._id ||
            currentEnr.course;

          try {
            const checkRes = await evaluationService.check(cohortOrCourseId);
            if (checkRes.evaluationCompleted || checkRes.data?.evaluationCompleted) {
              setAlreadyCompleted(true);
              setExistingEvaluation(checkRes.data?.evaluation);
            }
          } catch (_) {}
        }
      } catch (err) {
        if (isMounted) setError(err.response?.data?.message || err.message || 'Failed to initialize evaluation.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [targetId]);

  const handleRatingChange = (key, val) => {
    setRatings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!enrollment) {
      setError('No valid enrollment found to evaluate.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        cohortId: enrollment.cohort?._id || enrollment.cohort,
        courseId: enrollment.course?._id || enrollment.course,
        ratings: {
          content: ratings.contentRating,
          instructor: ratings.instructorRating,
          facilities: ratings.facilitiesRating,
          organization: ratings.organizationRating,
        },
        comments,
        isAnonymous,
      };

      await evaluationService.submit(payload);
      setSubmissionSuccess(true);
      setAlreadyCompleted(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to submit evaluation. Duplicate evaluations are strictly blocked.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const courseTitle =
    enrollment?.course?.title || enrollment?.cohort?.name || 'Aerospace Program';

  return (
    <div style={{ backgroundColor: '#EEF2F6', minHeight: '100vh', padding: '1.5rem' }}>
      <PageHeader
        title="Quality Assurance & Course Evaluation"
        subtitle="Mandatory EgSA Section 4 quality review gate for official certificate issuance and pedagogical accreditation."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Evaluations', to: '/student/evaluation' },
          { label: 'Course Evaluation' },
        ]}
      />

      {loading && <LoadingState label="Verifying enrollment evaluation gate..." />}
      {!loading && error && !submitting && <ErrorState message={error} />}

      {!loading && !enrollment && !error && (
        <div
          className="p-4 text-center bg-white rounded shadow-sm border mx-auto mt-4"
          style={{ maxWidth: 640, borderColor: '#CBD5E1' }}
        >
          <div
            className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
            style={{ backgroundColor: 'rgba(212, 184, 124, 0.15)', color: '#D4B87C' }}
          >
            <i className="fa-solid fa-graduation-cap fa-2x"></i>
          </div>
          <h4 className="fw-bold text-dark">No Eligible Course Enrollment Found</h4>
          <p className="text-muted small mb-4">
            You must have an active, confirmed, or completed course enrollment to submit an EgSA
            quality evaluation survey.
          </p>
          <Link to="/student/catalog" className="btn btn-primary fw-bold px-4 py-2" style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}>
            Browse Course Catalog
          </Link>
        </div>
      )}

      {/* Post-Submission Instant Success Banner */}
      {submissionSuccess && (
        <div
          className="card shadow-sm border-0 mb-4 mx-auto animate__animated animate__fadeIn"
          style={{
            maxWidth: 780,
            borderRadius: 12,
            backgroundColor: '#1E7C85',
            color: '#FFFFFF',
          }}
        >
          <div className="card-body p-4 text-center">
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 56, height: 56, backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <i className="fa-solid fa-award fa-2x text-white"></i>
            </div>
            <h4 className="fw-bold mb-2">
              Quality Evaluation Submitted Successfully — Certificate Gate Unlocked!
            </h4>
            <p className="small mb-4 text-white-50" style={{ maxWidth: 580, margin: '0 auto' }}>
              Your feedback has been anonymized and synchronized with the Egyptian Space Academy Quality
              Assurance oversight office. Your certificate request has been unlocked.
            </p>
            <div className="d-flex justify-content-center gap-3 flex-wrap">
              <Link
                to="/student/certificates"
                className="btn btn-light fw-bold px-4 py-2 shadow-sm text-dark"
                style={{ backgroundColor: '#FFFFFF', color: '#1E7C85' }}
              >
                <i className="fa-solid fa-certificate me-2 text-primary-egsa"></i>
                Go to My Certificates
              </Link>
              <Link
                to="/student/training"
                className="btn btn-outline-light fw-semibold px-4 py-2"
              >
                Back to Training Hub
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Survey Card */}
      {!loading && enrollment && !submissionSuccess && (
        <div
          className="egsa-card p-4 p-md-5 mx-auto shadow-sm"
          style={{
            maxWidth: 780,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #CBD5E1',
          }}
        >
          {/* Header & Target Course Metadata */}
          <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-4 flex-wrap gap-2">
            <div>
              <span
                className="badge rounded-pill fw-bold mb-2"
                style={{ backgroundColor: 'rgba(30, 124, 133, 0.12)', color: '#1E7C85' }}
              >
                Quality Assurance Engine · EgSA Sec. 4
              </span>
              <h3 className="fw-bold text-dark mb-1">{courseTitle}</h3>
              <p className="text-muted small mb-0">
                {enrollment.cohort?.name ? `Cohort: ${enrollment.cohort.name} · ` : ''}
                {enrollment.course?.code ? `Code: ${enrollment.course.code}` : ''}
              </p>
            </div>

            {alreadyCompleted && (
              <span className="badge bg-success p-2 px-3 fw-semibold">
                <i className="fa-solid fa-check-circle me-1"></i> Already Completed
              </span>
            )}
          </div>

          {alreadyCompleted && !submissionSuccess ? (
            <div className="text-center py-4">
              <div
                className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
                style={{ backgroundColor: 'rgba(30, 124, 133, 0.15)', color: '#1E7C85' }}
              >
                <i className="fa-solid fa-circle-check fa-3x"></i>
              </div>
              <h5 className="fw-bold text-dark mb-2">Quality Review Already Submitted</h5>
              <p className="text-muted small mb-4" style={{ maxWidth: 520, margin: '0 auto' }}>
                You have already submitted an official course and instructor evaluation for this
                program. Your certificate gate is unlocked.
              </p>
              <Link
                to="/student/certificates"
                className="btn btn-primary fw-bold px-4 py-2 shadow-sm"
                style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
              >
                <i className="fa-solid fa-award me-2"></i>
                View Certificates
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* 4 Rating Criteria */}
              <div className="mb-4 d-flex flex-column gap-4">
                {CRITERIA.map((crit, idx) => {
                  const currentScore = ratings[crit.key];
                  return (
                    <div
                      key={crit.key}
                      className="p-3 rounded border"
                      style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-2">
                        <div>
                          <span className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>
                            {idx + 1}. {crit.label}
                          </span>
                          <p className="text-muted small mb-0 lh-sm" style={{ fontSize: '0.78rem' }}>
                            {crit.description}
                          </p>
                        </div>
                        <span
                          className="badge fw-bold"
                          style={{
                            backgroundColor: 'rgba(212, 184, 124, 0.25)',
                            color: '#7A622A',
                            fontSize: '0.75rem',
                          }}
                        >
                          {RATING_LABELS[currentScore]}
                        </span>
                      </div>

                      {/* Interactive Stars Widget */}
                      <div className="d-flex align-items-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isActive = star <= currentScore;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleRatingChange(crit.key, star)}
                              className="btn btn-link p-1 text-decoration-none"
                              style={{ lineHeight: 1 }}
                              title={`${star} Star${star > 1 ? 's' : ''}`}
                            >
                              <i
                                className={`fa-star ${isActive ? 'fa-solid' : 'fa-regular'}`}
                                style={{
                                  fontSize: '1.45rem',
                                  color: isActive ? '#D4B87C' : '#CBD5E1',
                                  transition: 'transform 0.1s ease',
                                }}
                              ></i>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Qualitative Comments */}
              <div className="mb-4">
                <label className="form-label fw-bold text-dark small mb-1">
                  Space Engineering Qualitative Feedback & Suggestions:
                </label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Provide constructive space engineering feedback on lecture delivery, telemetry simulation fidelity, clean-room labs, or orbital flight dynamics coursework..."
                  style={{ borderColor: '#CBD5E1', fontSize: '0.88rem' }}
                />
                <span className="form-text text-muted small" style={{ fontSize: '0.75rem' }}>
                  Actionable observations help our academic board refine space hardware laboratories
                  and instructor training standards.
                </span>
              </div>

              {/* Privacy Mode: isAnonymous Toggle */}
              <div
                className="p-3 mb-4 rounded border d-flex align-items-center justify-content-between gap-3"
                style={{
                  backgroundColor: isAnonymous ? 'rgba(30, 124, 133, 0.05)' : '#FFFFFF',
                  borderColor: isAnonymous ? '#1E7C85' : '#CBD5E1',
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: isAnonymous ? '#1E7C85' : '#E2E8F0',
                      color: isAnonymous ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    <i className="fa-solid fa-user-shield"></i>
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.88rem' }}>
                      Anonymous Submission Mode
                    </div>
                    <p className="text-muted small mb-0 lh-sm" style={{ fontSize: '0.75rem' }}>
                      {isAnonymous
                        ? '🔒 Identity Protected: Your instructor receives aggregated metrics and comments with your identity completely withheld.'
                        : 'Public Attribution: Your name and national credentials will be visible to the instructor and division lead.'}
                    </p>
                  </div>
                </div>

                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="anonymousToggle"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="d-flex justify-content-end gap-2">
                <Link to="/student/training" className="btn btn-outline-secondary px-3 fw-semibold">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary px-4 fw-bold shadow-sm"
                  style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Submitting Evaluation...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane me-2"></i>
                      Submit Quality Evaluation & Unlock Certificate
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

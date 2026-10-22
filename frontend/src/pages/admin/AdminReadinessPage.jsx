import React, { useEffect, useState, useMemo } from 'react';
import { readinessService } from '../../services/cycleServices';
import { PageHeader, LoadingState, ErrorState } from '../../components/StateComponents.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminReadinessPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');

  // Override Modal State
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const loadAttempts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await readinessService.adminAttempts();
      setAttempts(res.data || []);
      setSummary(res.summary || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load readiness attempts ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttempts();
  }, []);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((att) => {
      const sName = att.student?.fullName || att.student?.name || '';
      const sEmail = att.student?.email || '';
      const cTitle = att.course?.title || '';
      const matchesSearch =
        sName.toLowerCase().includes(search.toLowerCase()) ||
        sEmail.toLowerCase().includes(search.toLowerCase()) ||
        cTitle.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (outcomeFilter === 'ALL') return true;
      if (outcomeFilter === 'READY') {
        return ['Ready', 'READY', 'ELIGIBLE'].includes(att.outcome);
      }
      if (outcomeFilter === 'FOUNDATION') {
        return ['Foundation Required', 'FOUNDATION_REQUIRED', 'FOUNDATION_RECOMMENDED'].includes(att.outcome);
      }
      if (outcomeFilter === 'OVERRIDDEN') {
        return att.adminOverride?.applied === true;
      }
      return true;
    });
  }, [attempts, search, outcomeFilter]);

  const handleOpenOverride = (attempt) => {
    setSelectedAttempt(attempt);
    setOverrideReason('');
    setOverrideError('');
  };

  const handleConfirmOverride = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setOverrideError('A detailed reason is mandatory for an administrative readiness override.');
      return;
    }

    setOverriding(true);
    setOverrideError('');
    try {
      await readinessService.adminOverride(selectedAttempt._id, overrideReason.trim());
      setSuccessToast(`Successfully applied administrative override for ${selectedAttempt.student?.fullName || 'student'}. Application status upgraded.`);
      setSelectedAttempt(null);
      setOverrideReason('');
      loadAttempts();
      setTimeout(() => setSuccessToast(''), 6000);
    } catch (err) {
      setOverrideError(err.response?.data?.message || 'Failed to apply admin override. Please try again.');
    } finally {
      setOverriding(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Flight Readiness Assessment Oversight"
        subtitle="Cohort-wide diagnostic tracking, knowledge gap analysis, and admissions readiness clearance ledger."
        breadcrumbs={[
          { label: 'Admin Command', to: '/admin/dashboard' },
          { label: 'Readiness Oversight' },
        ]}
      />

      {successToast && (
        <div className="alert alert-success d-flex align-items-center justify-content-between shadow-sm mb-4" role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className="fa-solid fa-circle-check fa-lg text-success"></i>
            <span>{successToast}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setSuccessToast('')}></button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={loadAttempts} />}

      {/* Metric Cards Summary */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-bold mono small" style={{ fontSize: '0.72rem' }}>Total Attempts</span>
                <h3 className="fw-bold text-dark mt-1 mb-0">{summary?.totalAttempts ?? attempts.length}</h3>
                <small className="text-muted">Recorded across cohorts</small>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{ width: '48px', height: '48px', backgroundColor: '#3A6985' }}
              >
                <i className="fa-solid fa-list-check fa-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-bold mono small" style={{ fontSize: '0.72rem' }}>Readiness Cleared</span>
                <h3 className="fw-bold mt-1 mb-0" style={{ color: '#1E7C85' }}>
                  {summary?.passedCount ?? attempts.filter(a => ['Ready', 'READY', 'ELIGIBLE'].includes(a.outcome)).length}
                </h3>
                <small className="text-muted">Score &ge; 70% threshold</small>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{ width: '48px', height: '48px', backgroundColor: '#1E7C85' }}
              >
                <i className="fa-solid fa-check-double fa-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-bold mono small" style={{ fontSize: '0.72rem' }}>Foundation Advised</span>
                <h3 className="fw-bold mt-1 mb-0" style={{ color: '#D4B87C' }}>
                  {summary?.failedCount ?? attempts.filter(a => ['Foundation Required', 'FOUNDATION_REQUIRED'].includes(a.outcome)).length}
                </h3>
                <small className="text-muted">Technical gaps identified</small>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-dark"
                style={{ width: '48px', height: '48px', backgroundColor: '#D4B87C' }}
              >
                <i className="fa-solid fa-graduation-cap fa-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-bold mono small" style={{ fontSize: '0.72rem' }}>Manual Overrides</span>
                <h3 className="fw-bold text-dark mt-1 mb-0">
                  {summary?.overrideCount ?? attempts.filter(a => a.adminOverride?.applied).length}
                </h3>
                <small className="text-muted">With logged justification</small>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center bg-light text-secondary border"
                style={{ width: '48px', height: '48px' }}
              >
                <i className="fa-solid fa-user-shield fa-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body p-3 p-md-4">
          <div className="row g-3 align-items-center">
            <div className="col-md-6 col-lg-5">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="fa-solid fa-magnifying-glass text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search by student name, email, or course..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="col-md-6 col-lg-4">
              <div className="d-flex align-items-center gap-2">
                <label className="small fw-semibold text-muted text-nowrap mb-0">Filter Outcome:</label>
                <select
                  className="form-select form-select-sm"
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                >
                  <option value="ALL">All Outcomes ({attempts.length})</option>
                  <option value="READY">Ready / Cleared</option>
                  <option value="FOUNDATION">Foundation Required</option>
                  <option value="OVERRIDDEN">Admin Overridden</option>
                </select>
              </div>
            </div>

            <div className="col-lg-3 text-lg-end">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary px-3"
                onClick={loadAttempts}
                disabled={loading}
              >
                <i className={`fa-solid fa-rotate me-1 ${loading ? 'fa-spin' : ''}`} />
                Refresh Ledger
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attempts Ledger Table */}
      <div className="card shadow-sm border-0" style={{ borderRadius: '12px' }}>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-5">
              <LoadingState label="Loading readiness attempts and score distributions…" />
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="text-center p-5 text-muted">
              <i className="fa-solid fa-clipboard-question fa-3x mb-3 text-secondary-subtle" />
              <h6 className="fw-bold text-dark">No Readiness Attempts Found</h6>
              <p className="small mb-0">No student assessments match the selected search and filter criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                <thead className="table-light text-uppercase mono fw-semibold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  <tr>
                    <th className="ps-4 py-3">Student Name & Account</th>
                    <th className="py-3">Course / Track</th>
                    <th className="py-3 text-center">Score</th>
                    <th className="py-3">Outcome</th>
                    <th className="py-3">Failed Topics / Gaps</th>
                    <th className="py-3">Attempt Date</th>
                    <th className="py-3 text-end pe-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="border-top-0">
                  {filteredAttempts.map((att) => {
                    const score = att.scorePercentage ?? att.score ?? 0;
                    const isPassed = ['Ready', 'READY', 'ELIGIBLE'].includes(att.outcome);
                    const isOverridden = att.adminOverride?.applied === true;
                    const gaps = att.knowledgeGaps || [];

                    return (
                      <tr key={att._id}>
                        {/* Student Info */}
                        <td className="ps-4 py-3">
                          <div className="d-flex align-items-center gap-2.5">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm flex-shrink-0"
                              style={{ width: 34, height: 34, backgroundColor: isPassed ? '#1E7C85' : '#D4B87C', fontSize: '0.84rem' }}
                            >
                              {(att.student?.fullName || att.student?.name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div className="d-flex flex-column lh-sm">
                              <span className="fw-bold text-dark">{att.student?.fullName || att.student?.name || 'Cadet'}</span>
                              <span className="text-muted small">{att.student?.email || 'N/A'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Course Info */}
                        <td className="py-3">
                          <div className="d-flex flex-column lh-sm">
                            <span className="fw-semibold text-dark">{att.course?.title || 'Course'}</span>
                            <div className="d-flex align-items-center gap-1.5 mt-0.5">
                              <span className="badge bg-light text-dark border px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                                {att.course?.division || 'UNIVERSITY'}
                              </span>
                              <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                Threshold: {att.course?.readinessThreshold || 70}%
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Score Badge */}
                        <td className="py-3 text-center">
                          <span
                            className="badge px-2.5 py-1.5 fw-bold mono"
                            style={{
                              backgroundColor: isPassed ? '#1E7C85' : '#D4B87C',
                              color: isPassed ? '#FFFFFF' : '#1E293B',
                              fontSize: '0.85rem',
                            }}
                          >
                            {score}%
                          </span>
                        </td>

                        {/* Outcome Badge */}
                        <td className="py-3">
                          <div className="d-flex flex-column gap-1">
                            {isPassed ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2 text-start" style={{ width: 'fit-content' }}>
                                <i className="fa-solid fa-check me-1" /> Ready
                              </span>
                            ) : (
                              <span className="badge bg-warning-subtle text-dark border border-warning-subtle py-1 px-2 text-start" style={{ width: 'fit-content' }}>
                                <i className="fa-solid fa-triangle-exclamation me-1" /> Foundation Required
                              </span>
                            )}
                            {isOverridden && (
                              <span
                                className="badge bg-info-subtle text-info-emphasis border border-info-subtle py-0.5 px-1.5 text-start"
                                style={{ width: 'fit-content', fontSize: '0.65rem' }}
                                title={`Overridden by admin: ${att.adminOverride?.reason || ''}`}
                              >
                                <i className="fa-solid fa-user-shield me-1" /> Overridden
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Failed Topics / Gaps */}
                        <td className="py-3">
                          {gaps.length === 0 ? (
                            <span className="text-muted small">None (All Passed)</span>
                          ) : (
                            <div className="d-flex flex-wrap gap-1">
                              {gaps.map((g, gIdx) => (
                                <span
                                  key={gIdx}
                                  className="badge bg-light text-dark border px-2 py-1 small fw-normal"
                                  style={{ fontSize: '0.72rem' }}
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Attempt Date */}
                        <td className="py-3 text-muted small">
                          {new Date(att.submittedAt || att.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 text-end pe-4">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary px-2.5 py-1"
                            style={{ fontSize: '0.78rem' }}
                            onClick={() => handleOpenOverride(att)}
                            title="Override readiness result"
                          >
                            <i className="fa-solid fa-wrench me-1" />
                            {isOverridden ? 'Update Override' : 'Override Result'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Override Result Modal */}
      {selectedAttempt && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '12px' }}>
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-user-shield text-primary-egsa fa-lg" style={{ color: '#1E7C85' }} />
                  <h6 className="modal-title fw-bold text-dark mb-0">Override Readiness Result</h6>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedAttempt(null)}
                  disabled={overriding}
                />
              </div>

              <form onSubmit={handleConfirmOverride}>
                <div className="modal-body p-4">
                  {overrideError && (
                    <div className="alert alert-danger small py-2 px-3 mb-3">
                      <i className="fa-solid fa-triangle-exclamation me-1" /> {overrideError}
                    </div>
                  )}

                  {/* Cadet & Attempt Card Summary */}
                  <div className="p-3 rounded border mb-3 bg-light">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="small text-muted text-uppercase fw-semibold mono">Student & Target Course</span>
                      <span className="badge px-2 py-1 fw-bold text-dark" style={{ backgroundColor: '#D4B87C' }}>
                        Current Score: {selectedAttempt.scorePercentage ?? selectedAttempt.score}%
                      </span>
                    </div>
                    <div className="fw-bold text-dark">{selectedAttempt.student?.fullName || 'Cadet'}</div>
                    <div className="small text-muted">{selectedAttempt.course?.title || 'Course'}</div>
                    {selectedAttempt.knowledgeGaps?.length > 0 && (
                      <div className="small text-danger mt-1">
                        Flagged gaps: {selectedAttempt.knowledgeGaps.join(', ')}
                      </div>
                    )}
                  </div>

                  <p className="text-muted small mb-3">
                    Overriding this result will upgrade the attempt to <strong className="text-dark">Ready</strong> and set the linked application to <strong className="text-success">Eligible - Payment Pending</strong>, authorizing immediate seat allocation and tuition invoicing.
                  </p>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-dark small">
                      Mandatory Justification / Review Reason <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="e.g., Equivalent industrial coursework verified, aerospace lab portfolio demonstrated, or committee clearance granted."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      required
                      disabled={overriding}
                      style={{ fontSize: '0.85rem' }}
                    />
                    <div className="form-text small">
                      This reason is permanently recorded in the institutional audit log with your admin identity.
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light px-4 py-3 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setSelectedAttempt(null)}
                    disabled={overriding}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm px-4 fw-bold text-white shadow-sm"
                    style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
                    disabled={overriding || !overrideReason.trim()}
                  >
                    {overriding ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                        Logging Override…
                      </>
                    ) : (
                      'Apply Override & Upgrade'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

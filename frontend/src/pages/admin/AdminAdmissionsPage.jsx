import React, { useEffect, useState } from 'react';
import { admissionsService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import StatusPill from '../../components/common/StatusPill.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import styles from './AdminAdmissionsPage.module.css';

const PRESET_REQUIREMENTS = [
  'Official Academic Transcript',
  'National ID / Registration Scan',
  'Prerequisite Course Certificate',
  'High School STEM / Secondary Certificate',
  'Division Head Clearance Waiver',
  'Other Specific Clarification / Document',
];

export default function AdminAdmissionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [divisionScope, setDivisionScope] = useState('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState('all');

  // Modal states for action controls
  const [overrideModalApp, setOverrideModalApp] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  const [infoModalApp, setInfoModalApp] = useState(null);
  const [selectedReqItem, setSelectedReqItem] = useState(PRESET_REQUIREMENTS[0]);
  const [customInfoDetails, setCustomInfoDetails] = useState('');
  const [isSubmittingInfo, setIsSubmittingInfo] = useState(false);

  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  const isSuperAdmin = ['SUPER_ADMIN', 'ADMIN'].includes((user?.role || '').toUpperCase()) && !user?.division;

  const load = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (isSuperAdmin && selectedDivisionFilter !== 'all') {
      params.division = selectedDivisionFilter;
    }

    admissionsService
      .adminApplications(params)
      .then((res) => {
        setApplications(res.data || []);
        setDivisionScope(res.scopeDivision || user?.division || 'all');
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load division admissions queue.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedDivisionFilter]);

  // Helper for instant optimistic UI reflection
  const updateLocalApp = (appId, updates) => {
    setApplications((prev) =>
      prev.map((app) => (app._id === appId ? { ...app, ...updates } : app))
    );
  };

  // Handler: Approve Override
  const handleApproveOverride = async (e) => {
    e.preventDefault();
    if (!overrideModalApp) return;
    const cleanReason = overrideReason.trim();

    if (cleanReason.length < 10) {
      toast.error('Override justification reason must be at least 10 characters.');
      return;
    }

    setIsSubmittingOverride(true);
    try {
      await admissionsService.approveOverride(overrideModalApp._id, cleanReason);
      
      // Optimistic update
      updateLocalApp(overrideModalApp._id, {
        status: 'Eligible',
        eligibilityStatus: 'Eligible',
        adminOverride: {
          applied: true,
          reason: cleanReason,
          adminId: user?._id,
          overriddenAt: new Date().toISOString(),
        },
      });

      toast.success(
        `Administrative override stamped for ${overrideModalApp.student?.fullName || 'Candidate'}. Application status marked as Eligible.`
      );
      setOverrideModalApp(null);
      setOverrideReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve administrative override.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Handler: Request More Info
  const handleRequestMoreInfo = async (e) => {
    e.preventDefault();
    if (!infoModalApp) return;

    let finalItem = selectedReqItem;
    if (customInfoDetails.trim()) {
      finalItem = `${selectedReqItem} - ${customInfoDetails.trim()}`;
    }

    setIsSubmittingInfo(true);
    try {
      await admissionsService.requestInfo(infoModalApp._id, finalItem);

      // Optimistic update
      updateLocalApp(infoModalApp._id, {
        status: 'Needs Information',
        missingRequirements: [finalItem],
      });

      toast.info(`Information request dispatched to ${infoModalApp.student?.fullName || 'Candidate'}.`);
      setInfoModalApp(null);
      setSelectedReqItem(PRESET_REQUIREMENTS[0]);
      setCustomInfoDetails('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request additional information.');
    } finally {
      setIsSubmittingInfo(false);
    }
  };

  // Handler: Reject
  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectModalApp || !rejectReason.trim()) return;

    setIsSubmittingReject(true);
    try {
      await admissionsService.reject(rejectModalApp._id, rejectReason.trim());

      // Optimistic update
      updateLocalApp(rejectModalApp._id, {
        status: 'Rejected',
      });

      toast.error(`Application for ${rejectModalApp.student?.fullName || 'Candidate'} has been rejected.`);
      setRejectModalApp(null);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject application.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // KPI Calculations
  const pendingCount = applications.filter((a) =>
    ['Submitted', 'Pending', 'Under Review', 'Manual Review'].includes(a.status)
  ).length;

  const eligibleCount = applications.filter(
    (a) => (a.status === 'Eligible' || a.eligibilityStatus === 'Eligible') && !a.adminOverride?.applied
  ).length;

  const manualReviewCount = applications.filter(
    (a) => a.status === 'Manual Review' || a.eligibilityStatus === 'Manual Review'
  ).length;

  const overridesCount = applications.filter((a) => Boolean(a.adminOverride?.applied)).length;

  // Active Scope Tokens
  const isUnivScope = divisionScope === 'UNIVERSITY';
  const isPreUnivScope = divisionScope === 'PRE_UNIVERSITY';
  const scopeBgColor = isUnivScope ? '#1E7C85' : isPreUnivScope ? '#3A6985' : '#2D3748';
  const scopeTitle = isUnivScope
    ? 'University Division'
    : isPreUnivScope
    ? 'Pre-University Cadets'
    : 'All Academy Divisions (Super Admin)';

  return (
    <div className={styles.container}>
      <PageHeader
        title="Admissions"
        subtitle="Candidate applications & eligibility review"
        breadcrumbs={[
          { label: 'Admin Portal', to: '/admin' },
          { label: 'Admissions' },
        ]}
        actions={
          <div className="d-flex align-items-center gap-2">
            {isSuperAdmin && (
              <select
                className="form-select form-select-sm"
                value={selectedDivisionFilter}
                onChange={(e) => setSelectedDivisionFilter(e.target.value)}
                style={{ width: '220px' }}
              >
                <option value="all">Scope: All Divisions</option>
                <option value="PRE_UNIVERSITY">Scope: Pre-University</option>
                <option value="UNIVERSITY">Scope: University</option>
              </select>
            )}
            <button className="btn btn-sm btn-outline-secondary" onClick={load}>
              <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
            </button>
          </div>
        }
      />

      {/* 1. Division Scope Banner */}
      <div className={styles.scopeBanner}>
        <div className="d-flex align-items-center gap-3">
          <div className={styles.scopeBadge} style={{ backgroundColor: scopeBgColor }}>
            <i
              className={`fa-solid ${
                isPreUnivScope ? 'fa-school' : isUnivScope ? 'fa-graduation-cap' : 'fa-building-columns'
              }`}
            ></i>
            <span>Active Scope: {scopeTitle}</span>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-light text-secondary border small">
            <i className="fa-solid fa-shield-halved me-1 text-primary"></i> Isolated Scope
          </span>
        </div>
      </div>

      {/* 2. KPI Bar */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Pending Review
            </div>
            <h3 className="fw-bold mb-0 text-dark">{pendingCount}</h3>
            <small className="text-muted">Awaiting administrative action</small>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Automatically Eligible
            </div>
            <h3 className="fw-bold mb-0 text-success">{eligibleCount}</h3>
            <small className="text-muted">Cleared system prerequisites</small>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Manual Review Required
            </div>
            <h3 className="fw-bold mb-0 text-warning">{manualReviewCount}</h3>
            <small className="text-muted">Prerequisite or clearance gaps</small>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Overrides Applied
            </div>
            <h3 className="fw-bold mb-0" style={{ color: '#1E7C85' }}>{overridesCount}</h3>
            <small className="text-muted">Stamped with Admin ID</small>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#f0fdfa', color: '#1E7C85' }}>
            <i className="fa-solid fa-stamp"></i>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* 3. Interactive Applications Ledger */}
      <div className={styles.card}>
        {loading ? (
          <LoadingState label="Loading division admissions ledger..." />
        ) : applications.length === 0 ? (
          <EmptyState
            title="Admissions queue is empty"
            message="No candidate applications are currently awaiting review in your division scope."
          />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className={styles.tableHeader}>
                <tr>
                  <th style={{ width: '20%' }}>Applicant Name</th>
                  <th style={{ width: '15%' }}>National ID / Reg No</th>
                  <th style={{ width: '22%' }}>Course Title</th>
                  <th style={{ width: '15%' }}>Level & Division</th>
                  <th style={{ width: '13%' }}>Automated Status</th>
                  <th style={{ width: '15%' }}>Override Stamp</th>
                  <th style={{ width: '15%' }} className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const student = app.student || {};
                  const course = app.course || {};
                  const isPreUniv = course.division === 'PRE_UNIVERSITY';
                  const nationalIdOrReg = student.nationalId || student.registrationNumber || 'Pending';
                  const isOverridden = Boolean(app.adminOverride?.applied);

                  return (
                    <tr key={app._id}>
                      {/* 1. Applicant Name */}
                      <td>
                        <div className="fw-bold text-dark">{student.fullName || 'Cadet'}</div>
                        <div className="text-muted small">{student.email}</div>
                      </td>

                      {/* 2. National ID / Reg No */}
                      <td>
                        <span className="font-monospace small fw-bold text-secondary bg-light px-2 py-1 rounded border">
                          {nationalIdOrReg}
                        </span>
                      </td>

                      {/* 3. Course Title */}
                      <td>
                        <div className="fw-bold text-dark">{course.title || 'Course'}</div>
                        <div className="text-muted small" style={{ fontSize: '0.785rem' }}>
                          {course.category || 'Space Academy Program'}
                        </div>
                      </td>

                      {/* 4. Level & Division */}
                      <td>
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          <span
                            className="badge fw-semibold"
                            style={{
                              backgroundColor: isPreUniv ? '#3A6985' : '#1E7C85',
                              color: '#FFFFFF',
                              fontSize: '0.72rem',
                            }}
                          >
                            {isPreUniv ? 'Pre-University' : 'University'}
                          </span>
                          <span className="badge bg-light text-secondary border small" style={{ fontSize: '0.72rem' }}>
                            {course.level || 'Program'}
                          </span>
                        </div>
                      </td>

                      {/* 5. Automated Status Pill */}
                      <td>
                        <StatusPill status={app.status || app.eligibilityStatus} />
                        {app.missingRequirements && app.missingRequirements.length > 0 && (
                          <div className="text-danger small mt-1" style={{ fontSize: '0.725rem' }}>
                            <i className="fa-solid fa-circle-exclamation me-1"></i>
                            {app.missingRequirements[0]}
                          </div>
                        )}
                      </td>

                      {/* 6. Override Stamp */}
                      <td>
                        {isOverridden ? (
                          <div
                            className={styles.overridePill}
                            title={`Reason: ${app.adminOverride.reason}\nAdmin ID: ${app.adminOverride.adminId || 'Admin'}`}
                          >
                            <i className="fa-solid fa-stamp"></i> Overridden
                          </div>
                        ) : (
                          <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                            Standard Flow
                          </span>
                        )}
                      </td>

                      {/* 7. Actions */}
                      <td className="text-end pe-3">
                        <div className="d-flex flex-column gap-1 align-items-end">
                          <button
                            type="button"
                            className={styles.btnOverride}
                            onClick={() => {
                              setOverrideModalApp(app);
                              setOverrideReason('');
                            }}
                            title="Approve administrative exception and mark Eligible"
                          >
                            <i className="fa-solid fa-stamp"></i> Approve Override
                          </button>

                          <button
                            type="button"
                            className={styles.btnWarningOutline}
                            onClick={() => {
                              setInfoModalApp(app);
                              setSelectedReqItem(PRESET_REQUIREMENTS[0]);
                              setCustomInfoDetails('');
                            }}
                            title="Request specific document or clarification from student"
                          >
                            <i className="fa-solid fa-circle-question"></i> Request Document/Info
                          </button>

                          <button
                            type="button"
                            className={styles.btnDangerOutline}
                            onClick={() => {
                              setRejectModalApp(app);
                              setRejectReason('');
                            }}
                            title="Reject candidate application"
                          >
                            <i className="fa-solid fa-ban"></i> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Approve Override */}
      {overrideModalApp && (
        <div className={styles.modalOverlay} onClick={() => setOverrideModalApp(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ backgroundColor: '#1E7C85' }}>
              <h6 className="m-0 fw-bold">
                <i className="fa-solid fa-stamp me-2"></i> Approve Administrative Override
              </h6>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setOverrideModalApp(null)}
              ></button>
            </div>
            <form onSubmit={handleApproveOverride} className="p-4">
              <div className="mb-3 p-3 bg-light rounded border">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <label className="form-label small text-muted text-uppercase fw-bold mb-0">Candidate</label>
                    <div className="fw-bold text-dark">{overrideModalApp.student?.fullName}</div>
                    <div className="small text-muted">{overrideModalApp.student?.email}</div>
                  </div>
                  <span className="badge bg-secondary">
                    {overrideModalApp.student?.nationalId || overrideModalApp.student?.registrationNumber}
                  </span>
                </div>
                <div>
                  <label className="form-label small text-muted text-uppercase fw-bold mb-0">Target Course</label>
                  <div className="fw-bold" style={{ color: '#1E7C85' }}>
                    {overrideModalApp.course?.title}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className={styles.confirmBadge}>
                  <i className="fa-solid fa-shield-halved fs-5"></i>
                  <div>
                    <div className="fw-bold">Authorizing Official Institutional Override</div>
                    <div className="small text-muted">
                      This action bypasses prerequisite rules and is immutably recorded in the Academy Audit Trail.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-bold text-dark mb-0">
                    Override Justification Reason <span className="text-danger">*</span>
                  </label>
                  <span
                    className={styles.charCounter}
                    style={{
                      color: overrideReason.trim().length >= 10 ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {overrideReason.trim().length} / 10 min characters
                  </span>
                </div>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="State the institutional justification for overriding prerequisite/division requirements (minimum 10 characters)..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
                <small className="text-muted d-block mt-1">
                  Reason must be at least 10 characters long to fulfill audit compliance requirements.
                </small>
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setOverrideModalApp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm text-white fw-bold"
                  style={{ backgroundColor: '#1E7C85' }}
                  disabled={isSubmittingOverride || overrideReason.trim().length < 10}
                >
                  {isSubmittingOverride ? 'Stamping Override...' : 'Confirm & Stamp Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Request Document/Info */}
      {infoModalApp && (
        <div className={styles.modalOverlay} onClick={() => setInfoModalApp(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ backgroundColor: '#D4B87C', color: '#1E1703' }}>
              <h6 className="m-0 fw-bold">
                <i className="fa-solid fa-circle-question me-2"></i> Request Missing Document / Info
              </h6>
              <button
                type="button"
                className="btn-close"
                onClick={() => setInfoModalApp(null)}
              ></button>
            </div>
            <form onSubmit={handleRequestMoreInfo} className="p-4">
              <div className="mb-3 p-3 bg-light rounded border">
                <label className="form-label small text-muted text-uppercase fw-bold mb-0">Candidate</label>
                <div className="fw-bold text-dark">{infoModalApp.student?.fullName}</div>
                <div className="small text-muted">{infoModalApp.student?.email}</div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-dark">
                  Required Requirement / Document Type <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={selectedReqItem}
                  onChange={(e) => setSelectedReqItem(e.target.value)}
                >
                  {PRESET_REQUIREMENTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-dark">
                  Additional Instructions / Clarification Note
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Provide specific directions for the cadet (e.g. Upload official stamped transcript from university registrar)..."
                  value={customInfoDetails}
                  onChange={(e) => setCustomInfoDetails(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setInfoModalApp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm fw-bold text-dark"
                  style={{ backgroundColor: '#D4B87C' }}
                  disabled={isSubmittingInfo}
                >
                  {isSubmittingInfo ? 'Dispatching...' : 'Dispatch Request to Cadet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Formal Rejection */}
      {rejectModalApp && (
        <div className={styles.modalOverlay} onClick={() => setRejectModalApp(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ backgroundColor: '#DF4F4C' }}>
              <h6 className="m-0 fw-bold">
                <i className="fa-solid fa-ban me-2"></i> Formal Application Rejection
              </h6>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setRejectModalApp(null)}
              ></button>
            </div>
            <form onSubmit={handleReject} className="p-4">
              <div className="mb-3 p-3 bg-light rounded border">
                <label className="form-label small text-muted text-uppercase fw-bold mb-0">Candidate</label>
                <div className="fw-bold text-dark">{rejectModalApp.student?.fullName}</div>
                <div className="small text-muted">{rejectModalApp.student?.email}</div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-dark">
                  Formal Rejection Justification <span className="text-danger">*</span>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Specify the academic or administrative justification for rejecting this application (logged into Audit Trail)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setRejectModalApp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-danger fw-bold"
                  disabled={isSubmittingReject || !rejectReason.trim()}
                >
                  {isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

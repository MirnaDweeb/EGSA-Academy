import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { financeService } from '../../services/cycleServices.js';
import { LoadingState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import styles from './AdminFinancePage.module.css';

export default function AdminFinancePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    pendingReceivables: 0,
    waivedAmount: 0,
    refundedAmount: 0,
    seatUtilizationRate: 0,
    totalCapacity: 0,
    confirmedSeats: 0,
  });

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL, PAID, PENDING, WAIVED, EXPIRED, REFUNDED
  const [search, setSearch] = useState('');

  // Sponsor Waiver Modal State
  const [waiverModalInvoice, setWaiverModalInvoice] = useState(null);
  const [waiverType, setWaiverType] = useState('Full');
  const [waiverPercent, setWaiverPercent] = useState(100);
  const [sponsorName, setSponsorName] = useState('Egyptian Space Agency Scholarship');
  const [waiverReason, setWaiverReason] = useState('');
  const [isSubmittingWaiver, setIsSubmittingWaiver] = useState(false);

  // Refund Modal State
  const [refundModalInvoice, setRefundModalInvoice] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // 72h Automated Sweep State
  const [isSweeping, setIsSweeping] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, ledgerRes] = await Promise.all([
        financeService.overview(),
        financeService.invoices(),
      ]);

      if (overviewRes?.success) {
        setMetrics(overviewRes.data || {});
      }
      if (ledgerRes?.success) {
        setInvoices(ledgerRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve authoritative financial records from EGSA servers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Optimistic helper
  const updateLocalInvoice = (id, updates) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv._id === id ? { ...inv, ...updates } : inv))
    );
  };

  // 1. Manual 72h Sweep Action
  const handleExecuteSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await financeService.sweep();
      const { expiredCount = 0, promotedCount = 0 } = res?.data || {};
      toast.info(
        `72-Hour Sweep Completed: ${expiredCount} expired provisional seat(s) released, ${promotedCount} candidate(s) promoted from waitlist.`
      );
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to execute 72-hour seat release sweep.');
    } finally {
      setIsSweeping(false);
    }
  };

  // 2. Apply Sponsor Waiver
  const handleApplyWaiver = async (e) => {
    e.preventDefault();
    if (!waiverModalInvoice) return;

    const cleanSponsor = sponsorName.trim();
    const cleanReason = waiverReason.trim();

    if (!cleanSponsor) {
      toast.error('Sponsor organization name is required.');
      return;
    }
    if (cleanReason.length < 10) {
      toast.error('Waiver justification reason must be at least 10 characters.');
      return;
    }

    setIsSubmittingWaiver(true);
    try {
      const pct = waiverType === 'Full' ? 100 : Number(waiverPercent);
      const res = await financeService.waive(waiverModalInvoice._id, {
        waiverType,
        waiverPercent: pct,
        sponsorName: cleanSponsor,
        reason: cleanReason,
      });

      // Optimistic state update
      const newStatus = pct === 100 ? 'Waived' : 'Partially_Waived';
      updateLocalInvoice(waiverModalInvoice._id, {
        status: newStatus,
        sponsorWaiver: {
          applied: true,
          waiverType: pct === 100 ? 'Full' : 'Partial',
          waiverPercent: pct,
          sponsorName: cleanSponsor,
          reason: cleanReason,
        },
      });

      toast.success(
        res?.message || `Sponsor waiver (${pct}%) granted by ${cleanSponsor}. Seat confirmed & locked.`
      );
      setWaiverModalInvoice(null);
      setWaiverReason('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply tuition waiver.');
    } finally {
      setIsSubmittingWaiver(false);
    }
  };

  // 3. Process Refund
  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!refundModalInvoice) return;

    setIsSubmittingRefund(true);
    try {
      await financeService.refund(refundModalInvoice._id, {
        refundReason: refundReason.trim() || 'Administrative tuition refund processed',
      });

      // Optimistic update
      updateLocalInvoice(refundModalInvoice._id, {
        status: 'Refunded',
        refundStatus: 'Refunded',
      });

      toast.success(
        `Refund of ${refundModalInvoice.amount} EGP processed. Trainee marked as Withdrawn and seat returned to pool.`
      );
      setRefundModalInvoice(null);
      setRefundReason('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process refund.');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Filter & Search Logic
  const filteredInvoices = invoices.filter((inv) => {
    const status = inv.status;

    if (filter === 'PAID' && !['Paid', 'PAID'].includes(status)) return false;
    if (filter === 'PENDING' && !['Pending', 'Invoice Issued', 'Payment Initiated', 'Partially_Waived'].includes(status)) return false;
    if (filter === 'WAIVED' && status !== 'Waived') return false;
    if (filter === 'EXPIRED' && !['Expired', 'EXPIRED', 'Overdue'].includes(status) && !inv.countdown?.isOverdue) return false;
    if (filter === 'REFUNDED' && status !== 'Refunded') return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const invNum = (inv.invoiceNumber || '').toLowerCase();
    const sName = (inv.student?.fullName || '').toLowerCase();
    const sEmail = (inv.student?.email || '').toLowerCase();
    const cTitle = (inv.course?.title || '').toLowerCase();
    const regNo = (inv.student?.registrationNumber || inv.student?.nationalId || '').toLowerCase();

    return invNum.includes(q) || sName.includes(q) || sEmail.includes(q) || cTitle.includes(q) || regNo.includes(q);
  });

  return (
    <div className={styles.container}>
      <PageHeader
        title="Commercial Ledger"
        subtitle="Invoices, payments & settlement records"
        breadcrumbs={[
          { label: 'Admin Portal', to: '/admin' },
          { label: 'Commercial Ledger' },
        ]}
        actions={
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={styles.btnSweep}
              onClick={handleExecuteSweep}
              disabled={isSweeping}
              title="Execute 72-Hour Seat Release & Waitlist Sweep"
            >
              <i className={`fa-solid fa-stopwatch me-1 ${isSweeping ? 'fa-spin' : ''}`}></i>
              {isSweeping ? 'Sweeping...' : 'Run 72h Auto-Sweep'}
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={loadData}>
              <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* 1. FINANCIAL METRICS HEADER BAR (4 High-Contrast Cards) */}
      <div className={styles.kpiGrid}>
        {/* Card 1: Collected Revenue */}
        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Collected Revenue
            </div>
            <h3 className="fw-bold mb-0 text-dark">
              {(metrics.totalRevenue || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#64748B' }}>EGP</span>
            </h3>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#1E7C8515', color: '#1E7C85' }}>
            <i className="fa-solid fa-vault"></i>
          </div>
        </div>

        {/* Card 2: Outstanding Receivables */}
        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Outstanding Receivables
            </div>
            <h3 className="fw-bold mb-0 text-dark">
              {(metrics.pendingReceivables || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#64748B' }}>EGP</span>
            </h3>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#D4B87C20', color: '#8C6D23' }}>
            <i className="fa-solid fa-hourglass-half"></i>
          </div>
        </div>

        {/* Card 3: Sponsored Waivers */}
        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Sponsored Waivers
            </div>
            <h3 className="fw-bold mb-0 text-dark">
              {(metrics.waivedAmount || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#64748B' }}>EGP</span>
            </h3>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>
            <i className="fa-solid fa-award"></i>
          </div>
        </div>

        {/* Card 4: Capacity Utilization Rate */}
        <div className={styles.kpiCard}>
          <div>
            <div className="text-muted text-uppercase fw-bold small mb-1" style={{ fontSize: '0.75rem' }}>
              Capacity Utilization
            </div>
            <h3 className="fw-bold mb-0 text-dark">
              {metrics.seatUtilizationRate || 0}%
            </h3>
          </div>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>
            <i className="fa-solid fa-chart-pie"></i>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE COMMERCIAL LEDGER */}
      <div className={styles.ledgerCard}>
        {/* Toolbar & Filter Bar */}
        <div className="p-3 border-bottom d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <h6 className="fw-bold mb-0 text-dark">Invoices</h6>
            <span className="badge bg-light text-secondary border small">
              {filteredInvoices.length}
            </span>
          </div>

          <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
            {/* Search Input */}
            <div className="input-group input-group-sm" style={{ width: '260px' }}>
              <span className="input-group-text bg-light border-end-0">
                <i className="fa-solid fa-magnifying-glass text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search invoice, cadet, or program..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Pills */}
            <div className="d-flex align-items-center gap-1 flex-wrap">
              {[
                { label: 'All', val: 'ALL' },
                { label: 'Paid', val: 'PAID' },
                { label: 'Pending (Hold)', val: 'PENDING' },
                { label: 'Waived', val: 'WAIVED' },
                { label: 'Expired', val: 'EXPIRED' },
                { label: 'Refunded', val: 'REFUNDED' },
              ].map((f) => (
                <button
                  key={f.val}
                  type="button"
                  className={`btn btn-sm ${
                    filter === f.val ? 'btn-primary' : 'btn-outline-secondary'
                  } rounded-pill px-3 fw-semibold`}
                  style={
                    filter === f.val
                      ? { backgroundColor: '#1E7C85', borderColor: '#1E7C85', color: '#FFFFFF' }
                      : { borderColor: '#CBD5E1' }
                  }
                  onClick={() => setFilter(f.val)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <LoadingState label="Loading authoritative commercial invoices ledger..." />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            title="No invoices found"
            message="No invoices match the current search or division filter criteria."
          />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className={styles.tableHeader}>
                <tr>
                  <th style={{ width: '16%' }}>Invoice Number</th>
                  <th style={{ width: '20%' }}>Student Trainee</th>
                  <th style={{ width: '22%' }}>Course / Cohort</th>
                  <th style={{ width: '12%' }}>Amount (EGP)</th>
                  <th style={{ width: '16%' }}>Due Date / Countdown</th>
                  <th style={{ width: '14%' }}>Payment Status</th>
                  <th style={{ width: '15%' }} className="text-end pe-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const student = inv.student || {};
                  const course = inv.course || {};
                  const cohort = inv.cohort || {};
                  const isPaid = ['Paid', 'PAID'].includes(inv.status);
                  const isWaived = inv.status === 'Waived';
                  const isExpired = ['Expired', 'EXPIRED', 'Overdue'].includes(inv.status) || inv.countdown?.isOverdue;
                  const isRefunded = inv.status === 'Refunded';

                  return (
                    <tr key={inv._id}>
                      {/* 1. Invoice Number */}
                      <td>
                        <div className="fw-bold text-dark">{inv.invoiceNumber}</div>
                        <div className="text-muted small font-monospace" style={{ fontSize: '0.725rem' }}>
                          Ref: {inv.application?.referenceNumber || 'N/A'}
                        </div>
                      </td>

                      {/* 2. Student Trainee */}
                      <td>
                        <div className="fw-bold text-dark">{student.fullName || 'Cadet'}</div>
                        <div className="text-muted small">{student.email}</div>
                        <div className="text-muted font-monospace small" style={{ fontSize: '0.72rem' }}>
                          ID: {student.nationalId || student.registrationNumber || 'Pending'}
                        </div>
                      </td>

                      {/* 3. Course / Cohort */}
                      <td>
                        <div className="fw-bold text-dark">{course.title || 'Course'}</div>
                        <div className="text-muted small" style={{ fontSize: '0.785rem' }}>
                          {cohort.name || 'Upcoming Cohort'}
                        </div>
                        {course.division && (
                          <span
                            className="badge fw-semibold mt-1"
                            style={{
                              backgroundColor: course.division === 'PRE_UNIVERSITY' ? '#3A6985' : '#1E7C85',
                              color: '#FFFFFF',
                              fontSize: '0.68rem',
                            }}
                          >
                            {course.division === 'PRE_UNIVERSITY' ? 'Pre-University' : 'University'}
                          </span>
                        )}
                      </td>

                      {/* 4. Amount (EGP) */}
                      <td>
                        <div className="fw-bold text-dark">{inv.amount} EGP</div>
                        <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                          {isPaid || isWaived
                            ? '0 EGP Due'
                            : `Due: ${inv.balanceDue != null ? inv.balanceDue : inv.amount} EGP`}
                        </div>
                      </td>

                      {/* 5. Due Date / Countdown */}
                      <td>
                        {isPaid ? (
                          <span className="text-success small fw-semibold">
                            <i className="fa-solid fa-circle-check me-1"></i> Paid in Full
                          </span>
                        ) : isWaived ? (
                          <span className="small fw-semibold" style={{ color: '#7C3AED' }}>
                            <i className="fa-solid fa-award me-1"></i> 100% Sponsored
                          </span>
                        ) : isRefunded ? (
                          <span className="text-muted small fw-semibold">
                            <i className="fa-solid fa-rotate-left me-1"></i> Refunded
                          </span>
                        ) : isExpired ? (
                          <div className={`${styles.countdownBadge} ${styles.countdownExpired}`}>
                            <i className="fa-solid fa-clock-rotate-left"></i>
                            <span>Expired (Released)</span>
                          </div>
                        ) : (
                          <div
                            className={`${styles.countdownBadge} ${
                              inv.countdown?.isUrgent ? styles.countdownUrgent : styles.countdownNormal
                            }`}
                          >
                            <i className="fa-regular fa-clock"></i>
                            <span>{inv.countdown?.remainingHours || 72}h Remaining</span>
                          </div>
                        )}
                      </td>

                      {/* 6. Payment Status Pill */}
                      <td>
                        {isPaid && (
                          <div className={styles.statusPillPaid}>
                            <i className="fa-solid fa-circle-check"></i> Paid
                          </div>
                        )}
                        {!isPaid && !isWaived && !isExpired && !isRefunded && (
                          <div className={styles.statusPillPending}>
                            <i className="fa-solid fa-hourglass-half"></i> Pending (72h Hold)
                          </div>
                        )}
                        {isWaived && (
                          <div className={styles.statusPillWaived} title={`Sponsor: ${inv.sponsorWaiver?.sponsorName || 'EgSA Grant'}`}>
                            <i className="fa-solid fa-award"></i> Waived (Sponsored)
                          </div>
                        )}
                        {isExpired && (
                          <div className={styles.statusPillExpired}>
                            <i className="fa-solid fa-ban"></i> Expired
                          </div>
                        )}
                        {isRefunded && (
                          <div className={styles.statusPillRefunded}>
                            <i className="fa-solid fa-rotate-left"></i> Refunded
                          </div>
                        )}
                      </td>

                      {/* 7. Action */}
                      <td className="text-end pe-3">
                        <div className="d-flex justify-content-end gap-1 flex-wrap">
                          {!isPaid && !isWaived && !isRefunded && (
                            <button
                              type="button"
                              className={styles.btnWaiverAction}
                              onClick={() => {
                                setWaiverModalInvoice(inv);
                                setWaiverType('Full');
                                setWaiverPercent(100);
                                setSponsorName('Egyptian Space Agency Scholarship');
                                setWaiverReason('');
                              }}
                              title="Apply Official Sponsorship Waiver"
                            >
                              <i className="fa-solid fa-award"></i> Apply Waiver
                            </button>
                          )}

                          {isPaid && (
                            <button
                              type="button"
                              className={styles.btnRefundAction}
                              onClick={() => {
                                setRefundModalInvoice(inv);
                                setRefundReason('');
                              }}
                              title="Process Refund & Release Seat"
                            >
                              <i className="fa-solid fa-rotate-left"></i> Refund
                            </button>
                          )}

                          {isWaived && (
                            <span className="text-muted small fw-semibold" style={{ fontSize: '0.72rem' }}>
                              <i className="fa-solid fa-shield-halved me-1 text-success"></i> Audited
                            </span>
                          )}
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

      {/* Modal 1: Apply Sponsor Waiver */}
      {waiverModalInvoice && (
        <div className={styles.modalOverlay} onClick={() => setWaiverModalInvoice(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ backgroundColor: '#7C3AED', color: '#FFFFFF' }}>
              <h6 className="m-0 fw-bold">
                <i className="fa-solid fa-award me-2"></i> Apply Sponsorship / Tuition Waiver
              </h6>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setWaiverModalInvoice(null)}
              ></button>
            </div>
            <form onSubmit={handleApplyWaiver} className="p-4">
              <div className="mb-3 p-3 bg-light rounded border">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <label className="form-label small text-muted text-uppercase fw-bold mb-0">Candidate</label>
                    <div className="fw-bold text-dark">{waiverModalInvoice.student?.fullName}</div>
                    <div className="small text-muted">{waiverModalInvoice.student?.email}</div>
                  </div>
                  <span className="badge bg-secondary">
                    {waiverModalInvoice.invoiceNumber}
                  </span>
                </div>
                <div>
                  <label className="form-label small text-muted text-uppercase fw-bold mb-0">Course & Total Tuition</label>
                  <div className="fw-bold text-primary">
                    {waiverModalInvoice.course?.title} — {waiverModalInvoice.amount} EGP
                  </div>
                </div>
              </div>

              {/* Sponsor Name Input */}
              <div className="mb-3">
                <label className="form-label fw-bold text-dark">
                  Sponsor Organization Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="E.g. Ministry of Higher Education, EgSA Space Cadets Fund, or Corporate Partner"
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                />
              </div>

              {/* Waiver Percentage */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-bold text-dark mb-0">Waiver Coverage Percentage</label>
                  <span className="fw-bold" style={{ color: '#7C3AED' }}>
                    {waiverType === 'Full' ? 100 : waiverPercent}%
                  </span>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="waiverTypeRadio"
                      id="waiverFull"
                      checked={waiverType === 'Full'}
                      onChange={() => {
                        setWaiverType('Full');
                        setWaiverPercent(100);
                      }}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="waiverFull">
                      Full 100% Waiver (Confirms & Locks Seat)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="waiverTypeRadio"
                      id="waiverPartial"
                      checked={waiverType === 'Partial'}
                      onChange={() => setWaiverType('Partial')}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="waiverPartial">
                      Partial Waiver
                    </label>
                  </div>
                </div>

                {waiverType === 'Partial' && (
                  <div className="mt-3">
                    <input
                      type="range"
                      className="form-range"
                      min={10}
                      max={90}
                      step={5}
                      value={waiverPercent}
                      onChange={(e) => setWaiverPercent(Number(e.target.value))}
                    />
                    <div className="d-flex justify-content-between small text-muted">
                      <span>10%</span>
                      <span>50%</span>
                      <span>90%</span>
                    </div>
                  </div>
                )}

                {/* Calculation preview */}
                <div className="p-2 bg-light rounded border mt-2 small d-flex justify-content-between">
                  <span>
                    Waived Amount: <strong>{Math.round((waiverModalInvoice.amount * (waiverType === 'Full' ? 100 : waiverPercent)) / 100)} EGP</strong>
                  </span>
                  <span>
                    Remaining Due: <strong>{Math.max(0, waiverModalInvoice.amount - Math.round((waiverModalInvoice.amount * (waiverType === 'Full' ? 100 : waiverPercent)) / 100))} EGP</strong>
                  </span>
                </div>
              </div>

              {/* Justification Reason */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-bold text-dark mb-0">
                    Waiver Justification Notes <span className="text-danger">*</span>
                  </label>
                  <span
                    className="small fw-semibold"
                    style={{
                      color: waiverReason.trim().length >= 10 ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {waiverReason.trim().length} / 10 min characters
                  </span>
                </div>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Detail the scholarship award, grant decree, or institutional authorization (minimum 10 characters)..."
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                />
                <small className="text-muted d-block mt-1">
                  Waiver action creates an immutable entry in the Egyptian Space Academy Audit Trail.
                </small>
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setWaiverModalInvoice(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm text-white fw-bold"
                  style={{ backgroundColor: '#7C3AED' }}
                  disabled={isSubmittingWaiver || waiverReason.trim().length < 10 || !sponsorName.trim()}
                >
                  {isSubmittingWaiver ? 'Applying Waiver...' : 'Authorize Sponsor Waiver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Refund Confirmation */}
      {refundModalInvoice && (
        <div className={styles.modalOverlay} onClick={() => setRefundModalInvoice(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ backgroundColor: '#DF4F4C', color: '#FFFFFF' }}>
              <h6 className="m-0 fw-bold">
                <i className="fa-solid fa-rotate-left me-2"></i> Process Tuition Refund
              </h6>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setRefundModalInvoice(null)}
              ></button>
            </div>
            <form onSubmit={handleProcessRefund} className="p-4">
              <div className="mb-3 p-3 bg-light rounded border">
                <label className="form-label small text-muted text-uppercase fw-bold mb-0">Candidate</label>
                <div className="fw-bold text-dark">{refundModalInvoice.student?.fullName}</div>
                <div className="small text-muted">{refundModalInvoice.student?.email}</div>
                <div className="mt-2 text-danger fw-bold">
                  Refund Amount: {refundModalInvoice.amount} EGP
                </div>
              </div>

              <div className="alert alert-warning small">
                <i className="fa-solid fa-triangle-exclamation me-1"></i>
                <strong>Seat Release Warning:</strong> Processing this refund will withdraw the trainee from the cohort and immediately release the seat back to the general capacity pool or promote a waitlisted candidate.
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-dark">
                  Refund Reason / Approval Justification <span className="text-danger">*</span>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Specify the reason for the tuition refund..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setRefundModalInvoice(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-danger fw-bold"
                  disabled={isSubmittingRefund || !refundReason.trim()}
                >
                  {isSubmittingRefund ? 'Processing...' : 'Confirm Tuition Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

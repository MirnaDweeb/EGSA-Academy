import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/cycleServices';
import styles from './SuperAdminDashboardPage.module.css';

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();

  // Active Tab: 'cockpit' | 'cross_division' | 'audit_logs' | 'governance'
  const [activeTab, setActiveTab] = useState('cockpit');

  // Strategic Overview Data
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  // Master Audit Trail State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditDivisionFilter, setAuditDivisionFilter] = useState('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Institutional Configuration State
  const [config, setConfig] = useState({
    seatReservationHours: 72,
    minimumAttendanceGate: 85,
    passingAssessmentThreshold: 70,
  });
  const [configDraft, setConfigDraft] = useState({
    seatReservationHours: 72,
    minimumAttendanceGate: 85,
    passingAssessmentThreshold: 70,
  });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Fetch Strategic Overview
  const fetchOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      setOverviewError(null);
      const res = await superAdminService.strategicOverview();
      if (res.success && res.data) {
        setOverview(res.data);
      }
    } catch (err) {
      console.error('Failed to load strategic overview:', err);
      setOverviewError(err.response?.data?.message || err.message || 'Error fetching strategic overview');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoadingAudit(true);
      const params = {};
      if (auditDivisionFilter !== 'ALL') params.division = auditDivisionFilter;
      if (auditActionFilter !== 'ALL') params.action = auditActionFilter;
      if (auditSearch.trim()) params.search = auditSearch.trim();

      const res = await superAdminService.auditLogs(params);
      if (res.success && res.data) {
        setAuditLogs(res.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [auditDivisionFilter, auditActionFilter, auditSearch]);

  // Fetch Institutional Config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await superAdminService.getConfig();
      if (res.success && res.data) {
        setConfig(res.data);
        setConfigDraft(res.data);
      }
    } catch (err) {
      console.error('Failed to load system config:', err);
    }
  }, []);

  // Save Institutional Config
  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      const res = await superAdminService.updateConfig(configDraft);
      if (res.success && res.data) {
        setConfig(res.data);
        setIsConfigModalOpen(false);
        showToast('Institutional governance parameters updated and immutably audit-logged.');
        // Refresh audit logs if active
        fetchAuditLogs();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update system config.');
    } finally {
      setSavingConfig(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchConfig();
  }, [fetchOverview, fetchConfig]);

  useEffect(() => {
    if (activeTab === 'audit_logs') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Totals & Funnel Shortcuts
  const totals = overview?.totals || {};
  const funnel = overview?.funnel || {};
  const univ = overview?.divisions?.UNIVERSITY || {};
  const preUniv = overview?.divisions?.PRE_UNIVERSITY || {};

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toast}>
          <i className="fa-solid fa-circle-check text-success" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Official Header Banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroLeft}>
          <img
            src="/esa-logo.png"
            alt="EgSA Emblem"
            className={styles.heroLogo}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h1 className={styles.heroTitle}>Super Admin Strategic Executive Suite</h1>
              <span className={styles.superBadge}>Platform Super-Administrator</span>
            </div>
            <p className={styles.heroSubtitle}>
              <i className="fa-solid fa-satellite" />
              <span>Cross-Division Intelligence, Unified Commercial Ledger & System Governance</span>
            </p>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => {
              fetchOverview();
              if (activeTab === 'audit_logs') fetchAuditLogs();
              showToast('Strategic metrics refreshed from live database.');
            }}
            title="Refresh Live Analytics"
          >
            <i className="fa-solid fa-rotate" />
            <span>Refresh Data</span>
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setIsConfigModalOpen(true)}
            title="Tune Institutional Configuration"
          >
            <i className="fa-solid fa-sliders" />
            <span>Institutional Settings</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          className={`${styles.tabItem} ${activeTab === 'cockpit' ? styles.active : ''}`}
          onClick={() => setActiveTab('cockpit')}
        >
          <i className="fa-solid fa-chart-pie" />
          <span>Executive Strategic Cockpit</span>
        </button>
        <button
          type="button"
          className={`${styles.tabItem} ${activeTab === 'cross_division' ? styles.active : ''}`}
          onClick={() => setActiveTab('cross_division')}
        >
          <i className="fa-solid fa-scale-balanced" />
          <span>Cross-Division Comparison</span>
        </button>
        <button
          type="button"
          className={`${styles.tabItem} ${activeTab === 'audit_logs' ? styles.active : ''}`}
          onClick={() => setActiveTab('audit_logs')}
        >
          <i className="fa-solid fa-shield-halved" />
          <span>Master Audit Ledger</span>
        </button>
        <button
          type="button"
          className={`${styles.tabItem} ${activeTab === 'governance' ? styles.active : ''}`}
          onClick={() => setActiveTab('governance')}
        >
          <i className="fa-solid fa-landmark" />
          <span>Institutional Governance</span>
        </button>
      </div>

      {/* TAB 1: EXECUTIVE STRATEGIC COCKPIT */}
      {activeTab === 'cockpit' && (
        <>
          {loadingOverview ? (
            <div className="p-5 text-center text-muted">
              <i className="fa-solid fa-spinner fa-spin fa-2x mb-3" />
              <p>Aggregating cross-division operational and commercial intelligence...</p>
            </div>
          ) : overviewError ? (
            <div className="alert alert-danger p-4 rounded-3">
              <h5>Failed to load strategic analytics</h5>
              <p className="mb-0">{overviewError}</p>
            </div>
          ) : (
            <>
              {/* Financial & Seat Utilization KPI Tiles */}
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <div
                    className={styles.kpiIconWrap}
                    style={{ background: 'rgba(30, 124, 133, 0.12)', color: '#1E7C85' }}
                  >
                    <i className="fa-solid fa-coins" />
                  </div>
                  <div className={styles.kpiCardContent}>
                    <div className={styles.kpiLabel}>Collected Revenue</div>
                    <div className={styles.kpiValue}>
                      {(totals.totalRevenue || 0).toLocaleString()} {totals.currency || 'EGP'}
                    </div>
                    <div className={styles.kpiMeta}>From Confirmed Commercial Invoices</div>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div
                    className={styles.kpiIconWrap}
                    style={{ background: 'rgba(58, 105, 133, 0.12)', color: '#3A6985' }}
                  >
                    <i className="fa-solid fa-clock-rotate-left" />
                  </div>
                  <div className={styles.kpiCardContent}>
                    <div className={styles.kpiLabel}>Pending Receivables</div>
                    <div className={styles.kpiValue}>
                      {(totals.pendingReceivables || 0).toLocaleString()} {totals.currency || 'EGP'}
                    </div>
                    <div className={styles.kpiMeta}>Within 72h Provisional Reservation</div>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div
                    className={styles.kpiIconWrap}
                    style={{ background: 'rgba(212, 184, 124, 0.15)', color: '#936F23' }}
                  >
                    <i className="fa-solid fa-hand-holding-dollar" />
                  </div>
                  <div className={styles.kpiCardContent}>
                    <div className={styles.kpiLabel}>Sponsored Waivers</div>
                    <div className={styles.kpiValue}>
                      {(totals.waivedAmount || 0).toLocaleString()} {totals.currency || 'EGP'}
                    </div>
                    <div className={styles.kpiMeta}>Institutional & Industrial Scholarships</div>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div
                    className={styles.kpiIconWrap}
                    style={{ background: 'rgba(223, 79, 76, 0.12)', color: '#DF4F4C' }}
                  >
                    <i className="fa-solid fa-users-viewfinder" />
                  </div>
                  <div className={styles.kpiCardContent}>
                    <div className={styles.kpiLabel}>Seat Capacity Utilization</div>
                    <div className={styles.kpiValue}>{totals.overallUtilizationRate || 0}%</div>
                    <div className={styles.kpiMeta}>
                      {totals.confirmedSeats || 0} / {totals.totalCapacity || 0} Confirmed Seats
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Funnel */}
              <div className={styles.funnelSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    <i className="fa-solid fa-filter" />
                    <span>Academy Operational Pipeline (Applied &rarr; Certified)</span>
                  </h3>
                  <span className="badge bg-light text-dark border">
                    Conversion Rate: <strong>{funnel.conversionRate || 0}%</strong>
                  </span>
                </div>

                <div className={styles.funnelStepsGrid}>
                  <div className={styles.funnelStep}>
                    <div className={styles.funnelStepNum}>Stage 1</div>
                    <div className={styles.funnelStepVal}>{funnel.applied || 0}</div>
                    <div className={styles.funnelStepName}>Applications Submitted</div>
                    <div className={styles.funnelRate}>100% Inflow</div>
                  </div>

                  <div className={styles.funnelStep}>
                    <div className={styles.funnelStepNum}>Stage 2</div>
                    <div className={styles.funnelStepVal}>{funnel.eligible || 0}</div>
                    <div className={styles.funnelStepName}>Passed Eligibility</div>
                    <div className={styles.funnelRate}>
                      {funnel.applied ? Math.round(((funnel.eligible || 0) / funnel.applied) * 100) : 0}% Eligible
                    </div>
                  </div>

                  <div className={styles.funnelStep}>
                    <div className={styles.funnelStepNum}>Stage 3</div>
                    <div className={styles.funnelStepVal}>{funnel.assessed || 0}</div>
                    <div className={styles.funnelStepName}>Readiness Assessed</div>
                    <div className={styles.funnelRate}>
                      {funnel.eligible ? Math.round(((funnel.assessed || 0) / funnel.eligible) * 100) : 0}% Assessed
                    </div>
                  </div>

                  <div className={styles.funnelStep}>
                    <div className={styles.funnelStepNum}>Stage 4</div>
                    <div className={styles.funnelStepVal}>{funnel.provisional || 0}</div>
                    <div className={styles.funnelStepName}>72h Provisional Hold</div>
                    <div className={styles.funnelRate}>
                      {funnel.assessed ? Math.round(((funnel.provisional || 0) / funnel.assessed) * 100) : 0}% Hold
                    </div>
                  </div>

                  <div className={styles.funnelStep}>
                    <div className={styles.funnelStepNum}>Stage 5</div>
                    <div className={styles.funnelStepVal}>{funnel.enrolled || 0}</div>
                    <div className={styles.funnelStepName}>Confirmed / Enrolled</div>
                    <div className={styles.funnelRate}>
                      {funnel.applied ? Math.round(((funnel.enrolled || 0) / funnel.applied) * 100) : 0}% Net Intake
                    </div>
                  </div>

                  <div className={styles.funnelStep}>
                    <div className={styles.funnelStepNum}>Stage 6</div>
                    <div className={styles.funnelStepVal}>{funnel.certified || 0}</div>
                    <div className={styles.funnelStepName}>Graduated & Certified</div>
                    <div className={styles.funnelRate}>
                      {funnel.enrolled ? Math.round(((funnel.certified || 0) / funnel.enrolled) * 100) : 0}%
                      Graduation
                    </div>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Dual-Division Intelligence Cards */}
              <div className={styles.divisionCompareGrid}>
                {/* University Division */}
                <div className={styles.divisionCard}>
                  <div className={`${styles.divisionCardHeader} ${styles.uni}`}>
                    <h4 className={styles.divisionTitle}>
                      <i className="fa-solid fa-graduation-cap text-primary" />
                      <span>{univ.displayName || 'University Academic Programs'}</span>
                    </h4>
                    <span className="badge bg-primary">Undergraduate & Graduate</span>
                  </div>
                  <div className={styles.divisionCardBody}>
                    <table className={styles.metricsTable}>
                      <tbody>
                        <tr>
                          <td>Total Applications Received</td>
                          <td>{univ.totalApplications || 0}</td>
                        </tr>
                        <tr>
                          <td>Confirmed Student Enrollments</td>
                          <td>{univ.totalEnrollments || 0}</td>
                        </tr>
                        <tr>
                          <td>Seat Capacity Utilization</td>
                          <td>
                            <span className="badge bg-teal" style={{ background: '#1E7C85', color: '#fff' }}>
                              {univ.seatUtilizationRate || 0}% ({univ.confirmedSeats || 0} / {univ.totalCapacity || 0})
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td>Collected Commercial Revenue</td>
                          <td style={{ color: '#1E7C85' }}>
                            {(univ.financials?.collectedRevenue || 0).toLocaleString()} EGP
                          </td>
                        </tr>
                        <tr>
                          <td>Sponsored Tuition Waivers</td>
                          <td style={{ color: '#936F23' }}>
                            {(univ.financials?.waivedAmount || 0).toLocaleString()} EGP
                          </td>
                        </tr>
                        <tr>
                          <td>Pending Receivables</td>
                          <td style={{ color: '#3A6985' }}>
                            {(univ.financials?.pendingReceivables || 0).toLocaleString()} EGP
                          </td>
                        </tr>
                        <tr>
                          <td>Verified Certificates Issued</td>
                          <td>{univ.totalCertificatesIssued || 0}</td>
                        </tr>
                        <tr>
                          <td>Student Quality & Evaluation Score</td>
                          <td>
                            <i className="fa-solid fa-star text-warning me-1" />
                            <strong>{univ.evaluationAverage || 4.8}</strong> / 5.0
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pre-University Division */}
                <div className={styles.divisionCard}>
                  <div className={`${styles.divisionCardHeader} ${styles.preUni}`}>
                    <h4 className={styles.divisionTitle}>
                      <i className="fa-solid fa-school text-warning" />
                      <span>{preUniv.displayName || 'Pre-University STEM Programs'}</span>
                    </h4>
                    <span className="badge bg-warning text-dark">K-12 & STEM Cadets</span>
                  </div>
                  <div className={styles.divisionCardBody}>
                    <table className={styles.metricsTable}>
                      <tbody>
                        <tr>
                          <td>Total Applications Received</td>
                          <td>{preUniv.totalApplications || 0}</td>
                        </tr>
                        <tr>
                          <td>Confirmed Cadet Enrollments</td>
                          <td>{preUniv.totalEnrollments || 0}</td>
                        </tr>
                        <tr>
                          <td>Seat Capacity Utilization</td>
                          <td>
                            <span className="badge" style={{ background: '#D4B87C', color: '#0B132B' }}>
                              {preUniv.seatUtilizationRate || 0}% ({preUniv.confirmedSeats || 0} /{' '}
                              {preUniv.totalCapacity || 0})
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td>Collected Commercial Revenue</td>
                          <td style={{ color: '#1E7C85' }}>
                            {(preUniv.financials?.collectedRevenue || 0).toLocaleString()} EGP
                          </td>
                        </tr>
                        <tr>
                          <td>Sponsored Tuition Waivers</td>
                          <td style={{ color: '#936F23' }}>
                            {(preUniv.financials?.waivedAmount || 0).toLocaleString()} EGP
                          </td>
                        </tr>
                        <tr>
                          <td>Pending Receivables</td>
                          <td style={{ color: '#3A6985' }}>
                            {(preUniv.financials?.pendingReceivables || 0).toLocaleString()} EGP
                          </td>
                        </tr>
                        <tr>
                          <td>Verified Certificates Issued</td>
                          <td>{preUniv.totalCertificatesIssued || 0}</td>
                        </tr>
                        <tr>
                          <td>Cadet Quality & Evaluation Score</td>
                          <td>
                            <i className="fa-solid fa-star text-warning me-1" />
                            <strong>{preUniv.evaluationAverage || 4.8}</strong> / 5.0
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 2: CROSS-DIVISION INTELLIGENCE */}
      {activeTab === 'cross_division' && (
        <div className={styles.divisionCard}>
          <div className={styles.divisionCardHeader}>
            <h3 className={styles.divisionTitle}>
              <i className="fa-solid fa-scale-balanced" />
              <span>Cross-Division Comparative Intelligence Matrix</span>
            </h3>
            <span className="text-muted small">EgSA Spec Section 4, 5 & 12 Compliance</span>
          </div>
          <div className={styles.divisionCardBody}>
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '30%' }}>Operational Benchmark</th>
                  <th style={{ width: '35%' }} className="text-primary">
                    <i className="fa-solid fa-graduation-cap me-1" />
                    University Division
                  </th>
                  <th style={{ width: '35%' }} className="text-warning">
                    <i className="fa-solid fa-school me-1" />
                    Pre-University Division
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Active Courses</td>
                  <td className="fw-semibold">{univ.totalCourses || 0} Courses</td>
                  <td className="fw-semibold">{preUniv.totalCourses || 0} Courses</td>
                </tr>
                <tr>
                  <td>Active Cohorts</td>
                  <td>{univ.totalCohorts || 0} Cohorts</td>
                  <td>{preUniv.totalCohorts || 0} Cohorts</td>
                </tr>
                <tr>
                  <td>Total Seat Capacity</td>
                  <td>{univ.totalCapacity || 0} Seats</td>
                  <td>{preUniv.totalCapacity || 0} Seats</td>
                </tr>
                <tr>
                  <td>Confirmed Seats Filled</td>
                  <td className="fw-bold">{univ.confirmedSeats || 0}</td>
                  <td className="fw-bold">{preUniv.confirmedSeats || 0}</td>
                </tr>
                <tr>
                  <td>Capacity Utilization Rate</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="progress flex-grow-1" style={{ height: 8 }}>
                        <div
                          className="progress-bar bg-primary"
                          style={{ width: `${Math.min(100, univ.seatUtilizationRate || 0)}%` }}
                        />
                      </div>
                      <span className="small fw-bold">{univ.seatUtilizationRate || 0}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="progress flex-grow-1" style={{ height: 8 }}>
                        <div
                          className="progress-bar bg-warning"
                          style={{ width: `${Math.min(100, preUniv.seatUtilizationRate || 0)}%` }}
                        />
                      </div>
                      <span className="small fw-bold">{preUniv.seatUtilizationRate || 0}%</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>Collected Revenue</td>
                  <td className="text-success fw-bold">
                    {(univ.financials?.collectedRevenue || 0).toLocaleString()} EGP
                  </td>
                  <td className="text-success fw-bold">
                    {(preUniv.financials?.collectedRevenue || 0).toLocaleString()} EGP
                  </td>
                </tr>
                <tr>
                  <td>Outstanding Receivables</td>
                  <td className="text-info fw-bold">
                    {(univ.financials?.pendingReceivables || 0).toLocaleString()} EGP
                  </td>
                  <td className="text-info fw-bold">
                    {(preUniv.financials?.pendingReceivables || 0).toLocaleString()} EGP
                  </td>
                </tr>
                <tr>
                  <td>Tuition Waivers Granted</td>
                  <td className="text-purple fw-bold">
                    {(univ.financials?.waivedAmount || 0).toLocaleString()} EGP
                  </td>
                  <td className="text-purple fw-bold">
                    {(preUniv.financials?.waivedAmount || 0).toLocaleString()} EGP
                  </td>
                </tr>
                <tr>
                  <td>Verified Certificates Issued</td>
                  <td>
                    <span className="badge bg-success">{univ.totalCertificatesIssued || 0} Certified</span>
                  </td>
                  <td>
                    <span className="badge bg-success">{preUniv.totalCertificatesIssued || 0} Certified</span>
                  </td>
                </tr>
                <tr>
                  <td>Quality & Evaluation Rating</td>
                  <td>
                    <span className="fw-bold text-dark">{univ.evaluationAverage || 4.8} / 5.0</span>
                  </td>
                  <td>
                    <span className="fw-bold text-dark">{preUniv.evaluationAverage || 4.8} / 5.0</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MASTER AUDIT LEDGER */}
      {activeTab === 'audit_logs' && (
        <div className={styles.auditSection}>
          <div className={styles.filterToolbar}>
            <div className={styles.searchBox}>
              <i className="fa-solid fa-magnifying-glass text-muted" />
              <input
                type="text"
                placeholder="Search actor email, entity ID, reason..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>

            <div className={styles.filterPills}>
              {/* Division filter pills */}
              <button
                type="button"
                className={`${styles.pillBtn} ${auditDivisionFilter === 'ALL' ? styles.active : ''}`}
                onClick={() => setAuditDivisionFilter('ALL')}
              >
                All Divisions
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${auditDivisionFilter === 'UNIVERSITY' ? styles.active : ''}`}
                onClick={() => setAuditDivisionFilter('UNIVERSITY')}
              >
                University
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${auditDivisionFilter === 'PRE_UNIVERSITY' ? styles.active : ''}`}
                onClick={() => setAuditDivisionFilter('PRE_UNIVERSITY')}
              >
                Pre-University
              </button>
            </div>

            <div className={styles.filterPills}>
              {/* Action filter pills */}
              <button
                type="button"
                className={`${styles.pillBtn} ${auditActionFilter === 'ALL' ? styles.active : ''}`}
                onClick={() => setAuditActionFilter('ALL')}
              >
                All Actions
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${auditActionFilter === 'ADMIN_OVERRIDE' ? styles.active : ''}`}
                onClick={() => setAuditActionFilter('ADMIN_OVERRIDE')}
              >
                Overrides
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${auditActionFilter === 'SPONSOR_WAIVER_APPLIED' ? styles.active : ''}`}
                onClick={() => setAuditActionFilter('SPONSOR_WAIVER_APPLIED')}
              >
                Waivers
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${auditActionFilter === 'WAITLIST_AUTO_PROMOTED' ? styles.active : ''}`}
                onClick={() => setAuditActionFilter('WAITLIST_AUTO_PROMOTED')}
              >
                Waitlist Sweeps
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${auditActionFilter === 'SYSTEM_CONFIG_UPDATED' ? styles.active : ''}`}
                onClick={() => setAuditActionFilter('SYSTEM_CONFIG_UPDATED')}
              >
                Config Updates
              </button>
            </div>
          </div>

          <div className={styles.auditTableWrap}>
            {loadingAudit ? (
              <div className="p-5 text-center text-muted">
                <i className="fa-solid fa-spinner fa-spin fa-2x mb-2" />
                <p>Loading platform-wide immutable audit trail...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-5 text-center text-muted">
                <i className="fa-solid fa-shield-check fa-3x mb-2 text-secondary" />
                <p>No audit trail records found for the current query parameters.</p>
              </div>
            ) : (
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor / Authority</th>
                    <th>Action</th>
                    <th>Target Entity</th>
                    <th>Division</th>
                    <th>Justification / Reason</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => {
                    const actorName =
                      log.actor?.fullName || log.user?.fullName || log.actor?.email || 'Platform System';
                    const actorRole = log.actor?.role || log.user?.role || 'SYSTEM';
                    const actionClass = log.action?.includes('OVERRIDE')
                      ? styles.override
                      : log.action?.includes('WAIVER')
                      ? styles.waiver
                      : log.action?.includes('PROMOTED')
                      ? styles.promoted
                      : log.action?.includes('CONFIG')
                      ? styles.config
                      : log.action?.includes('REFUND')
                      ? styles.refund
                      : '';

                    const divClass =
                      log.division === 'UNIVERSITY'
                        ? styles.uni
                        : log.division === 'PRE_UNIVERSITY'
                        ? styles.preUni
                        : styles.all;

                    const isExpanded = expandedLogId === log._id;

                    return (
                      <React.Fragment key={log._id}>
                        <tr>
                          <td className={styles.timestamp}>
                            {new Date(log.timestamp || log.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <div className={styles.actorTag}>
                              <i className="fa-solid fa-user-shield text-secondary" />
                              <span>{actorName}</span>
                            </div>
                            <div className="small text-muted">{actorRole}</div>
                          </td>
                          <td>
                            <span className={`${styles.actionPill} ${actionClass}`}>
                              {log.action?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>
                            <span className="mono text-muted small">{log.entity || log.resource}</span>
                            <div className="mono small text-muted">
                              {String(log.entityId || log.resourceId || '').slice(-6)}
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.divisionPill} ${divClass}`}>
                              {log.division || 'GLOBAL'}
                            </span>
                          </td>
                          <td style={{ maxWidth: 220 }}>
                            <span className="text-truncate d-inline-block" style={{ maxWidth: 220 }}>
                              {log.details?.reason || log.reason || log.details?.sponsorName || '—'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.expandBtn}
                              onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                            >
                              <i className={`fa-solid fa-${isExpanded ? 'chevron-up' : 'code'}`} />
                              <span className="ms-1">{isExpanded ? 'Hide' : 'Inspect'}</span>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7}>
                              <div className={styles.jsonDetails}>
                                <pre className="m-0">{JSON.stringify(log.details || log, null, 2)}</pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INSTITUTIONAL GOVERNANCE */}
      {activeTab === 'governance' && (
        <div className={styles.configGrid}>
          {/* Card 1: 72h Rule */}
          <div className={styles.configCard}>
            <h4 className={styles.configTitle}>
              <i className="fa-solid fa-hourglass-half text-warning" />
              <span>Tuition Reservation Auto-Sweep</span>
            </h4>
            <p className={styles.configDesc}>
              Enforces provisional hold duration before uncommitted seats are released to the waitlist pool.
            </p>
            <div className={styles.dialWrapper}>
              <div className={styles.dialHeader}>
                <span className={styles.dialLabel}>Current Window</span>
                <span className={styles.dialBadge}>{config.seatReservationHours} Hours</span>
              </div>
              <div className="text-muted small">Standard Egyptian Space Academy Rule: 72 Hours (3 Calendar Days)</div>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setIsConfigModalOpen(true)}
            >
              <i className="fa-solid fa-pen-to-square" />
              <span>Modify Threshold</span>
            </button>
          </div>

          {/* Card 2: Attendance Gate */}
          <div className={styles.configCard}>
            <h4 className={styles.configTitle}>
              <i className="fa-solid fa-user-check text-info" />
              <span>Minimum Attendance Gate</span>
            </h4>
            <p className={styles.configDesc}>
              Minimum validated physical & virtual session attendance required to qualify for academic assessments.
            </p>
            <div className={styles.dialWrapper}>
              <div className={styles.dialHeader}>
                <span className={styles.dialLabel}>Attendance Threshold</span>
                <span className={styles.dialBadge}>{config.minimumAttendanceGate}%</span>
              </div>
              <div className="text-muted small">EgSA Specification Section 10.1: 85% Mandatory Minimum</div>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setIsConfigModalOpen(true)}
            >
              <i className="fa-solid fa-pen-to-square" />
              <span>Modify Threshold</span>
            </button>
          </div>

          {/* Card 3: Passing Threshold */}
          <div className={styles.configCard}>
            <h4 className={styles.configTitle}>
              <i className="fa-solid fa-award text-success" />
              <span>Passing Assessment Grade</span>
            </h4>
            <p className={styles.configDesc}>
              Cumulative assessment score threshold required to graduate and earn an official EgSA certificate.
            </p>
            <div className={styles.dialWrapper}>
              <div className={styles.dialHeader}>
                <span className={styles.dialLabel}>Passing Grade</span>
                <span className={styles.dialBadge}>{config.passingAssessmentThreshold}%</span>
              </div>
              <div className="text-muted small">EgSA Specification Section 10.2: 70% Academic Pass Mark</div>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setIsConfigModalOpen(true)}
            >
              <i className="fa-solid fa-pen-to-square" />
              <span>Modify Threshold</span>
            </button>
          </div>
        </div>
      )}

      {/* INSTITUTIONAL CONFIGURATION MODAL */}
      {isConfigModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>
                <i className="fa-solid fa-sliders me-2 text-primary" />
                <span>Tune Institutional Governance Constants</span>
              </h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsConfigModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className="alert alert-info py-2 px-3 small mb-4">
                <i className="fa-solid fa-info-circle me-1.5" />
                All changes to institutional thresholds are committed to the immutable platform audit ledger.
              </div>

              {/* Slider 1: 72h rule */}
              <div className={styles.dialWrapper}>
                <div className={styles.dialHeader}>
                  <label htmlFor="seatReservationHoursInput" className={styles.dialLabel}>Seat Reservation Hold Window</label>
                  <span className={styles.dialBadge}>{configDraft.seatReservationHours} Hours</span>
                </div>
                <input
                  id="seatReservationHoursInput"
                  type="range"
                  className={styles.sliderInput}
                  min="12"
                  max="168"
                  step="6"
                  value={configDraft.seatReservationHours}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, seatReservationHours: Number(e.target.value) })
                  }
                />
                <div className={styles.rangeLimits}>
                  <span>12 Hours (Fast sweep)</span>
                  <span>72 Hours (Default)</span>
                  <span>168 Hours (7 Days)</span>
                </div>
              </div>

              {/* Slider 2: Attendance Gate */}
              <div className={styles.dialWrapper}>
                <div className={styles.dialHeader}>
                  <label htmlFor="minimumAttendanceGateInput" className={styles.dialLabel}>Minimum Attendance Gate Requirement</label>
                  <span className={styles.dialBadge}>{configDraft.minimumAttendanceGate}%</span>
                </div>
                <input
                  id="minimumAttendanceGateInput"
                  type="range"
                  className={styles.sliderInput}
                  min="60"
                  max="95"
                  step="1"
                  value={configDraft.minimumAttendanceGate}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, minimumAttendanceGate: Number(e.target.value) })
                  }
                />
                <div className={styles.rangeLimits}>
                  <span>60%</span>
                  <span>85% (EgSA Standard)</span>
                  <span>95%</span>
                </div>
              </div>

              {/* Slider 3: Passing Assessment Threshold */}
              <div className={styles.dialWrapper}>
                <div className={styles.dialHeader}>
                  <label htmlFor="passingAssessmentThresholdInput" className={styles.dialLabel}>Passing Assessment Grade Threshold</label>
                  <span className={styles.dialBadge}>{configDraft.passingAssessmentThreshold}%</span>
                </div>
                <input
                  id="passingAssessmentThresholdInput"
                  type="range"
                  className={styles.sliderInput}
                  min="50"
                  max="90"
                  step="1"
                  value={configDraft.passingAssessmentThreshold}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, passingAssessmentThreshold: Number(e.target.value) })
                  }
                />
                <div className={styles.rangeLimits}>
                  <span>50%</span>
                  <span>70% (EgSA Standard)</span>
                  <span>90%</span>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setIsConfigModalOpen(false)}
                disabled={savingConfig}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveConfig}
                disabled={savingConfig}
              >
                {savingConfig ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin me-1.5" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check me-1.5" />
                    <span>Apply & Log Governance Event</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

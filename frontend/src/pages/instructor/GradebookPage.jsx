import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Form,
  InputGroup,
  Badge,
  Modal,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { PageHeader, Panel, StateView } from '../../components/instructor/ui.jsx';
import { instructorApi } from '../../services/instructor.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useI18n } from '../../i18n/index.jsx';

/**
 * Academic Standing Badge with EgSA Platform Institutional Tokens
 */
export function AcademicStandingBadge({ standing }) {
  const norm = String(standing || '').toLowerCase();

  if (norm === 'distinction') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 10px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(212, 184, 124, 0.18)',
          color: '#8B6B23',
          border: '1px solid #D4B87C',
          fontWeight: 700,
          fontSize: '0.78rem',
          letterSpacing: '0.03em',
        }}
      >
        <i className="fa-solid fa-star text-warning" />
        Distinction
      </span>
    );
  }

  if (norm === 'good standing' || norm === 'good') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 10px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(30, 124, 133, 0.15)',
          color: '#1E7C85',
          border: '1px solid #1E7C85',
          fontWeight: 700,
          fontSize: '0.78rem',
          letterSpacing: '0.03em',
        }}
      >
        <i className="fa-solid fa-circle-check" />
        Good Standing
      </span>
    );
  }

  if (norm === 'academic warning' || norm === 'warning') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 10px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(223, 79, 76, 0.15)',
          color: '#DF4F4C',
          border: '1.5px solid #DF4F4C',
          fontWeight: 800,
          fontSize: '0.78rem',
          letterSpacing: '0.03em',
        }}
      >
        <i className="fa-solid fa-triangle-exclamation" />
        Academic Warning
      </span>
    );
  }

  // At Risk default fallback
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(223, 79, 76, 0.12)',
        color: '#DF4F4C',
        border: '1px solid #DF4F4C',
        fontWeight: 700,
        fontSize: '0.78rem',
        letterSpacing: '0.03em',
      }}
    >
      <i className="fa-solid fa-circle-exclamation" />
      At Risk
    </span>
  );
}

export default function GradebookPage() {
  const { cohortId: paramCohortId } = useParams();
  const toast = useToast();
  const { t } = useI18n();

  const [cohorts, setCohorts] = useState([]);
  const [selectedCohortId, setSelectedCohortId] = useState(paramCohortId || '');
  const [gradebookData, setGradebookData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search and Filtering
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, AT_RISK, COMPLETED_EVAL, DISTINCTION

  // Quick-Grade Drawer/Modal State
  const [gradeModal, setGradeModal] = useState({
    show: false,
    student: null,
    assessment: null,
    score: '',
    feedback: '',
    isSaving: false,
  });

  // Fetch Instructor's Cohorts
  useEffect(() => {
    let isMounted = true;
    instructorApi
      .cohorts()
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data?.items || data?.data || [];
        setCohorts(list);
        if (!selectedCohortId && list.length > 0) {
          setSelectedCohortId(list[0]._id);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load cohorts.');
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCohortId]);

  // Fetch Gradebook Data when selectedCohortId changes
  const fetchGradebook = async (cid) => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await instructorApi.gradebook(cid);
      const data = res?.data || res;
      setGradebookData(data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load gradebook.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCohortId) {
      fetchGradebook(selectedCohortId);
    }
  }, [selectedCohortId]);

  // Quick Grade Action
  const handleOpenQuickGrade = (student, assessment) => {
    setGradeModal({
      show: true,
      student,
      assessment,
      score: assessment.score !== null ? assessment.score : '',
      feedback: assessment.feedback || '',
      isSaving: false,
    });
  };

  const handleSaveQuickGrade = async (e) => {
    e.preventDefault();
    const { student, assessment, score, feedback } = gradeModal;
    const numScore = parseFloat(score);

    if (isNaN(numScore) || numScore < 0 || numScore > (assessment.maxScore || 100)) {
      toast.error(`Please enter a valid score between 0 and ${assessment.maxScore || 100}.`);
      return;
    }

    setGradeModal((prev) => ({ ...prev, isSaving: true }));
    try {
      await instructorApi.quickGrade(selectedCohortId, {
        submissionId: assessment.submissionId,
        studentId: student.studentId,
        assessmentId: assessment.assessmentId,
        score: numScore,
        feedback: feedback.trim(),
      });

      toast.success(`Score updated for ${student.fullName}. Real-time metrics recalculated.`);
      setGradeModal({ show: false, student: null, assessment: null, score: '', feedback: '', isSaving: false });

      // Refresh gradebook without full page reload
      await fetchGradebook(selectedCohortId);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save grade.');
      setGradeModal((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // CSV Export Trigger
  const handleExportCsv = async () => {
    if (!selectedCohortId) return;
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/instructor/cohorts/${selectedCohortId}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EgSA_Gradebook_${selectedCohortId}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Official Gradebook CSV Ledger exported successfully.');
    } catch (err) {
      toast.error('Failed to export CSV ledger.');
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!gradebookData?.students) return [];
    return gradebookData.students.filter((s) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const matchesName = (s.fullName || '').toLowerCase().includes(q);
        const matchesEmail = (s.email || '').toLowerCase().includes(q);
        const matchesId = (s.nationalId || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }

      if (statusFilter === 'AT_RISK') {
        return (
          s.attendance?.attendanceAtRisk ||
          s.academicStanding === 'At Risk' ||
          s.academicStanding === 'Academic Warning'
        );
      }
      if (statusFilter === 'COMPLETED_EVAL') {
        return Boolean(s.evaluationCompleted);
      }
      if (statusFilter === 'DISTINCTION') {
        return s.academicStanding === 'Distinction';
      }
      return true;
    });
  }, [gradebookData?.students, search, statusFilter]);

  const kpis = gradebookData?.kpis || {
    totalEnrolled: 0,
    classAverageScore: 0,
    attendanceGateHealth: 0,
    flaggedAtRiskCount: 0,
  };

  return (
    <>
      <PageHeader
        title="Gradebook"
        subtitle="Cadet scores & academic progress"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-secondary"
              className="d-inline-flex align-items-center gap-1.5"
              onClick={handleExportCsv}
              disabled={loading || !gradebookData?.students?.length}
            >
              <i className="fa-solid fa-file-csv text-success" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Cohort Selector Panel */}
      <Panel className="mb-4">
        <Row className="g-3 align-items-center">
          <Col md={6}>
            <Form.Group controlId="gradebook-cohort-select">
              <Form.Label className="small text-muted text-uppercase fw-semibold mb-1">
                Cohort
              </Form.Label>
              <Form.Select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                style={{ fontWeight: 600, borderColor: '#CBD5E1', borderRadius: '6px' }}
              >
                {cohorts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} — {c.course?.name || c.course?.title || 'EgSA Flight Program'}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6} className="text-md-end">
            <span className="small text-muted">
              Course: <strong className="text-dark">{gradebookData?.course?.title || '—'}</strong>
            </span>
          </Col>
        </Row>
      </Panel>

      {/* 1. At-Risk Cohort Overview Bar (4 High-Contrast KPI Badges) */}
      <Row className="g-3 mb-4">
        {/* KPI 1: Total Enrolled */}
        <Col sm={6} lg={3}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="small text-muted text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Total Enrolled
                </span>
                <i className="fa-solid fa-users" style={{ color: '#3A6985' }} />
              </div>
              <div className="h3 fw-bold mb-0 text-dark">
                {kpis.totalEnrolled}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* KPI 2: Class Average Cumulative Score */}
        <Col sm={6} lg={3}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="small text-muted text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Class Average
                </span>
                <i className="fa-solid fa-graduation-cap" style={{ color: '#0E7490' }} />
              </div>
              <div className="h3 fw-bold mb-0 text-dark">
                {kpis.classAverageScore}%
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* KPI 3: Attendance Gate Health (>= 85%) */}
        <Col sm={6} lg={3}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="small text-muted text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Attendance Health (≥85%)
                </span>
                <i className="fa-solid fa-user-check" style={{ color: '#047857' }} />
              </div>
              <div className="h3 fw-bold mb-0 text-dark">
                {kpis.attendanceGateHealth}
                <span className="text-muted small fw-normal ms-1" style={{ fontSize: '1rem' }}>
                  / {kpis.totalEnrolled}
                </span>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* KPI 4: Flagged At-Risk Students */}
        <Col sm={6} lg={3}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: '8px',
              border: '1px solid #FECACA',
              backgroundColor: '#FEF2F2',
            }}
          >
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="small text-uppercase fw-bold" style={{ color: '#B91C1C', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  At-Risk Cadets
                </span>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#B91C1C' }} />
              </div>
              <div className="h3 fw-bold mb-0" style={{ color: '#B91C1C' }}>
                {kpis.flaggedAtRiskCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 3. Export & Filter Toolbar */}
      <Panel className="mb-3">
        <Row className="g-2 align-items-center">
          <Col md={6} lg={5}>
            <InputGroup size="sm">
              <InputGroup.Text style={{ backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }}>
                <i className="fa-solid fa-magnifying-glass text-muted" />
              </InputGroup.Text>
              <Form.Control
                type="search"
                placeholder="Search cadet by name, email, or national ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ borderColor: '#CBD5E1' }}
              />
            </InputGroup>
          </Col>

          <Col md={6} lg={4}>
            <div className="d-flex align-items-center gap-1">
              {[
                { key: 'ALL', label: 'All Cadets' },
                { key: 'AT_RISK', label: 'At Risk / Warning' },
                { key: 'COMPLETED_EVAL', label: 'Evaluated' },
                { key: 'DISTINCTION', label: 'Distinction' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`btn btn-sm ${
                    statusFilter === f.key ? 'btn-egsa fw-bold' : 'btn-outline-secondary'
                  }`}
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Col>
        </Row>
      </Panel>

      {/* 2. Interactive Gradebook Data Table */}
      <StateView loading={loading} error={error} onRetry={() => fetchGradebook(selectedCohortId)}>
        <Card
          className="shadow-sm border-0 mb-4"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #CBD5E1',
            overflow: 'hidden',
          }}
        >
          <div className="table-responsive" style={{ maxHeight: '680px' }}>
            <Table hover className="mb-0 align-middle text-nowrap" style={{ fontSize: '0.88rem' }}>
              <thead style={{ backgroundColor: '#0E1A22', color: '#F8FAFC' }}>
                <tr>
                  <th style={{ backgroundColor: '#0E1A22', color: '#F8FAFC', padding: '12px 16px', position: 'sticky', left: 0, zIndex: 3 }}>
                    Cadet Identity
                  </th>
                  <th style={{ backgroundColor: '#0E1A22', color: '#F8FAFC', textAlign: 'center' }}>
                    Attendance Rate
                  </th>
                  {/* Dynamic Assessment Columns */}
                  {gradebookData?.assessments?.map((ass) => (
                    <th key={ass._id} style={{ backgroundColor: '#0E1A22', color: '#F8FAFC', textAlign: 'center' }}>
                      <div className="fw-bold">{ass.title}</div>
                      <div className="small text-muted" style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                        {ass.type?.toUpperCase()} · Max: {ass.maxScore}
                      </div>
                    </th>
                  ))}
                  <th style={{ backgroundColor: '#0E1A22', color: '#F8FAFC', textAlign: 'center' }}>
                    Cumulative Score
                  </th>
                  <th style={{ backgroundColor: '#0E1A22', color: '#F8FAFC', textAlign: 'center' }}>
                    Quality Survey
                  </th>
                  <th style={{ backgroundColor: '#0E1A22', color: '#F8FAFC', textAlign: 'center' }}>
                    Academic Standing
                  </th>
                  <th style={{ backgroundColor: '#0E1A22', color: '#F8FAFC', textAlign: 'end', paddingRight: '16px' }}>
                    Quick Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6 + (gradebookData?.assessments?.length || 0)} className="text-center py-5 text-muted">
                      <i className="fa-solid fa-user-slash fa-2x mb-2 d-block opacity-50" />
                      No student records found matching the active filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.studentId}>
                      {/* Sticky Cadet Name Column */}
                      <td style={{ backgroundColor: '#FFFFFF', position: 'sticky', left: 0, zIndex: 2, padding: '12px 16px', borderRight: '1px solid #E2E8F0' }}>
                        <div className="fw-bold text-dark">{s.fullName}</div>
                        <div className="small text-muted mono" style={{ fontSize: '0.75rem' }}>
                          {s.email} · ID: {s.nationalId}
                        </div>
                      </td>

                      {/* Attendance Health */}
                      <td className="text-center">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: s.attendance.attendanceAtRisk ? '#FEE2E2' : '#E6F4EA',
                            color: s.attendance.attendanceAtRisk ? '#DF4F4C' : '#1E7C85',
                            border: `1px solid ${s.attendance.attendanceAtRisk ? '#DF4F4C' : '#1E7C85'}`,
                            fontSize: '0.82rem',
                            padding: '5px 10px',
                            fontWeight: 700,
                          }}
                        >
                          {s.attendance.attendancePercentage}%
                          {s.attendance.attendanceAtRisk && (
                            <i className="fa-solid fa-triangle-exclamation ms-1" title="Attendance below 85% requirement" />
                          )}
                        </span>
                        <div className="small text-muted mono mt-0.5" style={{ fontSize: '0.7rem' }}>
                          {s.attendance.sessionsAttended} / {s.attendance.totalSessions} Sessions
                        </div>
                      </td>

                      {/* Technical Assessment Itemized Scores */}
                      {s.assessments.map((ass) => {
                        const isGraded = ass.score !== null;
                        const pct = ass.percentage;

                        return (
                          <td
                            key={ass.assessmentId}
                            className="text-center"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleOpenQuickGrade(s, ass)}
                            title="Click to quick-grade or review feedback"
                          >
                            {isGraded ? (
                              <div className="d-inline-block">
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: pct >= 85 ? 'rgba(30, 124, 133, 0.12)' : pct >= 70 ? '#FEF3C7' : '#FEE2E2',
                                    color: pct >= 85 ? '#1E7C85' : pct >= 70 ? '#B45309' : '#DF4F4C',
                                    border: `1px solid ${pct >= 85 ? '#1E7C85' : pct >= 70 ? '#F59E0B' : '#DF4F4C'}`,
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    padding: '5px 10px',
                                  }}
                                >
                                  {ass.score} / {ass.maxScore}
                                </span>
                                <div className="small text-muted" style={{ fontSize: '0.7rem' }}>
                                  {pct}% · {ass.status}
                                </div>
                              </div>
                            ) : (
                              <span
                                className="badge bg-light text-secondary border"
                                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                              >
                                {ass.status === 'Submitted' ? 'Submitted' : '— Missing'}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Cumulative Academic Score */}
                      <td className="text-center">
                        <div className="h6 fw-bold mb-0 text-dark mono">
                          {s.cumulativeScore}%
                        </div>
                        <div
                          className="progress mt-1 mx-auto"
                          style={{ height: '5px', width: '60px', backgroundColor: '#E2E8F0' }}
                        >
                          <div
                            className="progress-bar"
                            style={{
                              width: `${s.cumulativeScore}%`,
                              backgroundColor: s.cumulativeScore >= 85 ? '#1E7C85' : s.cumulativeScore >= 70 ? '#D4B87C' : '#DF4F4C',
                            }}
                          />
                        </div>
                      </td>

                      {/* Quality Evaluation Completed */}
                      <td className="text-center">
                        {s.evaluationCompleted ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.75rem' }}>
                            <i className="fa-solid fa-check me-1" />
                            Submitted
                          </span>
                        ) : (
                          <span className="badge bg-light text-muted border" style={{ fontSize: '0.75rem' }}>
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Overall Academic Standing */}
                      <td className="text-center">
                        <AcademicStandingBadge standing={s.academicStanding} />
                      </td>

                      {/* Action */}
                      <td className="text-end" style={{ paddingRight: '16px' }}>
                        <Button
                          size="sm"
                          variant="outline-dark"
                          style={{ fontSize: '0.78rem', borderColor: '#CBD5E1' }}
                          onClick={() => {
                            const firstAss = s.assessments[0];
                            if (firstAss) handleOpenQuickGrade(s, firstAss);
                          }}
                        >
                          <i className="fa-solid fa-pen-to-square me-1 text-primary" />
                          Quick-Grade
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      </StateView>

      {/* Quick-Grade Drawer / Modal */}
      <Modal
        show={gradeModal.show}
        onHide={() => setGradeModal((prev) => ({ ...prev, show: false }))}
        centered
        size="md"
      >
        <Form onSubmit={handleSaveQuickGrade}>
          <Modal.Header closeButton style={{ backgroundColor: '#0E1A22', color: '#F8FAFC' }}>
            <Modal.Title as="h3" className="h5 mb-0 d-flex align-items-center gap-2">
              <i className="fa-solid fa-file-pen text-warning" />
              <span>Quick-Grade Assessment</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <div className="mb-3 p-3" style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div className="small text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>
                Cadet
              </div>
              <div className="fw-bold text-dark">{gradeModal.student?.fullName}</div>
              <div className="small text-muted mono">{gradeModal.student?.email}</div>

              <hr className="my-2" />

              <div className="small text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>
                Assessment Deliverable
              </div>
              <div className="fw-semibold text-dark">{gradeModal.assessment?.title}</div>
              <div className="small text-muted">
                Maximum Configured Score: <strong>{gradeModal.assessment?.maxScore || 100} points</strong>
              </div>
            </div>

            <Form.Group className="mb-3" controlId="qg-score">
              <Form.Label className="fw-semibold">
                Awarded Score (0 to {gradeModal.assessment?.maxScore || 100}) *
              </Form.Label>
              <Form.Control
                type="number"
                step="0.5"
                min="0"
                max={gradeModal.assessment?.maxScore || 100}
                required
                value={gradeModal.score}
                onChange={(e) => setGradeModal({ ...gradeModal, score: e.target.value })}
                placeholder={`Enter score out of ${gradeModal.assessment?.maxScore || 100}`}
                autoFocus
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="qg-feedback">
              <Form.Label className="fw-semibold">Instructor Evaluative Feedback</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={gradeModal.feedback}
                onChange={(e) => setGradeModal({ ...gradeModal, feedback: e.target.value })}
                placeholder="Enter feedback on telemetry accuracy, formatting, or technical rigor..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setGradeModal((prev) => ({ ...prev, show: false }))}
              disabled={gradeModal.isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="btn-egsa d-inline-flex align-items-center gap-1.5"
              disabled={gradeModal.isSaving}
            >
              {gradeModal.isSaving && <Spinner size="sm" />}
              <span>Save & Recalculate Metrics</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

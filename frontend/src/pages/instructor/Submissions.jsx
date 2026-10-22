import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Avatar, ConfirmModal, FileCard, FilePreviewModal, PageHeader, Panel, StateView, StatusBadge, styles as s } from '../../components/instructor/ui.jsx';
import useFetch from '../../hooks/useFetch.js';
import { instructorApi } from '../../services/instructor.js';
import { useI18n } from '../../i18n/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { friendlyError } from '../../utils/errors.js';
import subStyles from './submissions.module.css';

export function SubmissionsPage() {
  const { t, fmtDateTime } = useI18n();
  const [sp, setSp] = useSearchParams();
  const rawStatus = sp.get('status') || '';

  const { data, loading, error, reload } = useFetch(() => instructorApi.submissions({}), []);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(rawStatus || 'all');

  useEffect(() => {
    if (rawStatus) setStatusFilter(rawStatus);
  }, [rawStatus]);

  // Calculate real metrics from submissions
  const stats = useMemo(() => {
    if (!data) return { total: 0, submitted: 0, evaluated: 0, published: 0, late: 0 };
    let total = data.length;
    let submitted = 0, evaluated = 0, published = 0, late = 0;

    data.forEach((x) => {
      if (x.status === 'submitted') submitted++;
      else if (x.status === 'evaluated') evaluated++;
      else if (x.status === 'result_published') published++;

      const isLate = x.isLate || (x.assessment?.dueDate && new Date(x.submittedAt) > new Date(x.assessment.dueDate));
      if (isLate) late++;
    });

    return { total, submitted, evaluated, published, late };
  }, [data]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    if (!data) return [];
    return data.filter((x) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const studentName = (x.student?.name || '').toLowerCase();
        const studentEmail = (x.student?.email || '').toLowerCase();
        const asmTitle = (x.assessment?.title || '').toLowerCase();
        if (!studentName.includes(q) && !studentEmail.includes(q) && !asmTitle.includes(q)) {
          return false;
        }
      }

      if (statusFilter === 'all') return true;
      if (statusFilter === 'late') {
        return x.isLate || (x.assessment?.dueDate && new Date(x.submittedAt) > new Date(x.assessment.dueDate));
      }
      return x.status === statusFilter;
    });
  }, [data, search, statusFilter]);

  const handleFilterClick = (key) => {
    setStatusFilter(key);
    if (key === 'all') setSp({});
    else setSp({ status: key });
  };

  const toast = useToast();
  const [gradingItem, setGradingItem] = useState(null);
  const [modalScore, setModalScore] = useState('');
  const [modalFeedback, setModalFeedback] = useState('');
  const [isGradingBusy, setIsGradingBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const openGradingModal = (item) => {
    setGradingItem(item);
    setModalScore(item.result?.score ?? item.score ?? '');
    setModalFeedback(item.result?.feedback || item.feedback || '');
    setModalError('');
  };

  const handleModalGradeSubmit = async (e) => {
    e.preventDefault();
    if (!gradingItem) return;

    const max = gradingItem.assessment?.gradingConfig?.maxScore || gradingItem.assessment?.maxScore || 100;
    if (modalScore === '' || isNaN(Number(modalScore))) {
      setModalError('Please enter a valid numerical score.');
      return;
    }
    const numScore = Number(modalScore);
    if (numScore < 0 || numScore > max) {
      setModalError(`Score must be between 0 and maximum possible (${max}).`);
      return;
    }

    setIsGradingBusy(true);
    setModalError('');
    try {
      await instructorApi.grade(gradingItem._id, {
        score: numScore,
        feedback: modalFeedback.trim(),
      });
      toast.success(t('sub.evalSaved') || 'Submission evaluated and score published successfully!');
      setGradingItem(null);
      reload();
    } catch (err) {
      setModalError(friendlyError(err, t));
    } finally {
      setIsGradingBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t('nav.submissions')}
        title={t('sub.title')}
        subtitle="Review submitted cadet assignments, score evaluations against grading criteria, and publish results."
      />

      {/* Metrics Overview Cards */}
      <div className={subStyles.statsGrid}>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber}>{stats.total}</span>
          <span className={subStyles.statLabel}>{t('common.total')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#d97706' }}>{stats.submitted}</span>
          <span className={subStyles.statLabel}>{t('asm.awaiting')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#0284c7' }}>{stats.evaluated}</span>
          <span className={subStyles.statLabel}>{t('asm.evaluated')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#059669' }}>{stats.published}</span>
          <span className={subStyles.statLabel}>{t('asm.resultsPublished')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#dc2626' }}>{stats.late}</span>
          <span className={subStyles.statLabel}>{t('att.late')}</span>
        </div>
      </div>

      <Panel flush>
        {/* Search and Filters Toolbar */}
        <div className={subStyles.toolbar}>
          <div className="position-relative" style={{ minWidth: 260 }}>
            <i className="fa-solid fa-magnifying-glass position-absolute text-muted" style={{ left: 10, top: 9 }} aria-hidden="true" />
            <Form.Control
              size="sm"
              type="search"
              placeholder={`${t('common.search')} cadet or assignment...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '1.9rem', borderRadius: 9999 }}
            />
          </div>

          <div className={subStyles.filterPills}>
            {[
              { key: 'all', label: t('sub.filterAll'), count: stats.total },
              { key: 'submitted', label: t('asm.awaiting'), count: stats.submitted },
              { key: 'evaluated', label: t('asm.evaluated'), count: stats.evaluated },
              { key: 'result_published', label: t('asm.resultsPublished'), count: stats.published },
              { key: 'late', label: t('att.late'), count: stats.late },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${subStyles.filterBtn} ${statusFilter === f.key ? subStyles.filterBtnActive : ''}`}
                onClick={() => handleFilterClick(f.key)}
              >
                {f.label} <span className="opacity-75">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        <StateView loading={loading} error={error} onRetry={reload} empty={data && !data.length} emptyText={t('sub.empty')} emptyIcon="fa-inbox">
          <div className={s.tableWrap}>
            <Table hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>{t('common.student')}</th>
                  <th>{t('nav.assessments')}</th>
                  <th>{t('common.submittedAt')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.score')}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((x) => {
                  const isLate = x.isLate || (x.assessment?.dueDate && new Date(x.submittedAt) > new Date(x.assessment.dueDate));
                  const max = x.assessment?.gradingConfig?.maxScore || x.assessment?.maxScore;
                  return (
                    <tr key={x._id}>
                      <td>
                        <Avatar user={x.student} size={34} />
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{x.student?.name}</div>
                        <div className="small text-muted">{x.student?.email}</div>
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{x.assessment?.title}</div>
                        <div className="small text-muted">
                          {x.assessment?.cohort?.name ? `${x.assessment.cohort.name} · ` : ''}
                          {x.assessment?.cohort?.course?.code || ''}
                        </div>
                      </td>
                      <td>
                        <div className="small mono text-dark">{fmtDateTime(x.submittedAt)}</div>
                        {isLate && (
                          <span className={subStyles.lateTag}>
                            <i className="fa-solid fa-clock me-1" aria-hidden="true" />
                            {t('att.late')}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge value={x.status} />
                      </td>
                      <td>
                        <span className="mono fw-semibold">
                          {x.result?.score != null ? x.result.score : (x.score != null ? x.score : '—')}
                          {max != null && (x.result?.score != null || x.score != null) && (
                            <span className="text-muted small fw-normal ms-1">/ {max}</span>
                          )}
                        </span>
                      </td>
                      <td className="text-end text-nowrap">
                        <Button
                          size="sm"
                          className="me-2 fw-semibold"
                          style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85', color: '#fff' }}
                          onClick={() => openGradingModal(x)}
                        >
                          <i className="fa-solid fa-pen-nib me-1" aria-hidden="true" />
                          {x.status === 'submitted' || x.status === 'Pending_Review'
                            ? t('dash.grade')
                            : (x.result?.score != null || x.score != null ? 'Re-Grade' : t('dash.grade'))}
                        </Button>
                        <Link
                          className="btn btn-sm btn-outline-secondary"
                          to={`/instructor/submissions/${x._id}`}
                        >
                          {t('common.view')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!filteredSubmissions.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      No submissions match the current filter or search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </StateView>
      </Panel>

      {/* High-Contrast Instant Grading Modal */}
      <Modal show={Boolean(gradingItem)} onHide={() => !isGradingBusy && setGradingItem(null)} centered size="lg">
        {gradingItem && (
          <Form onSubmit={handleModalGradeSubmit}>
            <Modal.Header closeButton={!isGradingBusy} style={{ backgroundColor: '#0B192C', color: '#fff' }}>
              <Modal.Title className="fs-5 fw-bold d-flex align-items-center gap-2">
                <i className="fa-solid fa-award" style={{ color: '#D4B87C' }}></i>
                <span>Evaluate Cadet Mission: {gradingItem.assessment?.title}</span>
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4 bg-light">
              {modalError && <Alert variant="danger" className="py-2 small">{modalError}</Alert>}

              {/* Cadet & Metadata Context Banner */}
              <div className="p-3 bg-white border rounded-3 mb-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <Avatar user={gradingItem.student} size={42} />
                  <div>
                    <h6 className="fw-bold mb-0 text-dark">{gradingItem.student?.name}</h6>
                    <span className="small text-muted">{gradingItem.student?.email}</span>
                  </div>
                </div>
                <div className="text-end">
                  <span className="small text-muted d-block">{t('common.submittedAt')}</span>
                  <strong className="small text-dark">{fmtDateTime(gradingItem.submittedAt)}</strong>
                  {gradingItem.isLate && (
                    <span className="badge ms-2" style={{ backgroundColor: '#DF4F4C', color: '#fff' }}>
                      Late Submission
                    </span>
                  )}
                </div>
              </div>

              {/* Deliverable Link if available */}
              {gradingItem.submissionUrl && (
                <div className="mb-3 p-3 bg-white border rounded-3">
                  <span className="small fw-semibold text-muted d-block mb-1">
                    <i className="fa-brands fa-github text-primary me-2"></i>
                    Deliverable / Project Repository:
                  </span>
                  <a
                    href={gradingItem.submissionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fw-bold text-primary text-decoration-none small d-inline-flex align-items-center gap-1"
                  >
                    <span>{gradingItem.submissionUrl}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  </a>
                </div>
              )}

              {/* Notes / Content if available */}
              {(gradingItem.notes || gradingItem.textAnswer || gradingItem.content) && (
                <div className="mb-3 p-3 bg-white border rounded-3">
                  <span className="small fw-semibold text-muted d-block mb-1">
                    <i className="fa-solid fa-align-left text-primary me-2"></i>
                    Cadet Technical Summary & Notes:
                  </span>
                  <div className="small text-dark" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {gradingItem.notes || gradingItem.textAnswer || gradingItem.content}
                  </div>
                </div>
              )}

              {/* Numerical Score Input */}
              <Form.Group className="mb-3" controlId="modal-grade-score">
                <Form.Label className="fw-bold text-dark small">
                  Numerical Score (0 - {gradingItem.assessment?.gradingConfig?.maxScore || gradingItem.assessment?.maxScore || 100})
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  max={gradingItem.assessment?.gradingConfig?.maxScore || gradingItem.assessment?.maxScore || 100}
                  step="any"
                  placeholder={`Enter score out of ${gradingItem.assessment?.gradingConfig?.maxScore || gradingItem.assessment?.maxScore || 100}`}
                  value={modalScore}
                  onChange={(e) => setModalScore(e.target.value)}
                  disabled={isGradingBusy}
                  required
                  autoFocus
                />
              </Form.Group>

              {/* Qualitative Feedback Textarea */}
              <Form.Group className="mb-2" controlId="modal-grade-feedback">
                <Form.Label className="fw-bold text-dark small">
                  Qualitative Academic & Engineering Feedback
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  placeholder="Provide constructive feedback, analysis accuracy, strengths, and recommended improvements for this mission deliverable..."
                  value={modalFeedback}
                  onChange={(e) => setModalFeedback(e.target.value)}
                  disabled={isGradingBusy}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="bg-light px-4 py-3 border-top d-flex justify-content-between">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setGradingItem(null)}
                disabled={isGradingBusy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="fw-bold d-inline-flex align-items-center gap-2"
                style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85', color: '#fff' }}
                disabled={isGradingBusy}
              >
                {isGradingBusy ? (
                  <>
                    <Spinner size="sm" />
                    <span>Committing Grade…</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane" />
                    <span>Save & Publish Grade</span>
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </>
  );
}

export function SubmissionDetail() {
  const { id } = useParams();
  const { t, fmtDateTime } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => instructorApi.submission(id), [id]);

  const [f, setF] = useState({ score: '', feedback: '', strengths: '', improvements: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    if (data) {
      setF({
        score: data.result?.score ?? '',
        feedback: data.result?.feedback || '',
        strengths: data.result?.strengths || '',
        improvements: data.result?.improvements || '',
      });
    }
  }, [data]);

  const max = data?.assessment?.gradingConfig?.maxScore;
  const locked = data?.result?.status === 'published';
  const evaluated = Boolean(data?.result) && !locked;

  // Validation: disallow negative or score > max
  const scoreBad = f.score !== '' && (Number(f.score) < 0 || (max != null && Number(f.score) > max));
  const empty = f.score === '' && !f.feedback.trim() && !f.strengths.trim() && !f.improvements.trim();

  const isLate = data?.isLate || (data?.assessment?.dueDate && new Date(data.submittedAt) > new Date(data.assessment.dueDate));

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (scoreBad || empty) return;
    setBusy(true);
    setErr(null);
    try {
      await instructorApi.grade(id, {
        score: f.score === '' ? null : Number(f.score),
        feedback: f.feedback,
        strengths: f.strengths,
        improvements: f.improvements,
      });
      toast.success(t('sub.evalSaved'));
      reload();
    } catch (x) {
      setErr(friendlyError(x, t));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      await instructorApi.publishResult(id);
      toast.success(t('sub.resultPublished'));
      setConfirm(false);
      reload();
    } catch (x) {
      toast.error(friendlyError(x, t));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        back="/instructor/submissions"
        eyebrow={data?.assessment?.title}
        title={data?.student?.name || t('sub.review')}
        subtitle={data && `${t('common.submittedAt')}: ${fmtDateTime(data.submittedAt)}`}
        actions={data && <StatusBadge value={data.status} />}
      />

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            {/* Cadet & Mission Context Header Box */}
            <div className={subStyles.studentMetaBox}>
              <Avatar user={data.student} size={48} />
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="mb-0 fw-bold">{data.student?.name}</h5>
                  {isLate && (
                    <span className={subStyles.lateTag}>
                      <i className="fa-solid fa-clock me-1" aria-hidden="true" />
                      {t('att.late')}
                    </span>
                  )}
                </div>
                <div className="small text-muted">
                  {data.student?.email}
                  {data.assessment?.cohort?.name ? ` · Cohort: ${data.assessment.cohort.name}` : ''}
                  {data.assessment?.dueDate ? ` · Due: ${fmtDateTime(data.assessment.dueDate)}` : ''}
                </div>
              </div>
            </div>

            <Row className="g-3">
              <Col lg={6}>
                <Panel title={t('sub.content')}>
                  {data.submissionUrl && (
                    <div className="mb-3 p-3 bg-light rounded-3 border">
                      <span className="small fw-semibold text-muted d-block mb-1">
                        <i className="fa-brands fa-github text-primary me-2"></i>
                        Deliverable / Project Repository:
                      </span>
                      <a
                        href={data.submissionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fw-bold text-primary small d-inline-flex align-items-center gap-1"
                      >
                        <span>{data.submissionUrl}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                    </div>
                  )}

                  {(data.notes || data.textAnswer) && (
                    <div className="mb-3 p-3 bg-light rounded-3 border">
                      <span className="small fw-semibold text-muted d-block mb-1">
                        <i className="fa-solid fa-align-left text-primary me-2"></i>
                        Cadet Technical Summary & Notes:
                      </span>
                      <div className="small text-dark" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {data.notes || data.textAnswer}
                      </div>
                    </div>
                  )}

                  <div className={subStyles.contentCard}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {data.content || (!data.submissionUrl && !data.notes && !data.textAnswer && <span className="text-muted">{t('sub.noContent')}</span>)}
                    </div>
                  </div>

                  {data.attachments?.length > 0 && (
                    <div className="mt-3">
                      <div className="small fw-semibold text-muted mb-2 text-uppercase" style={{ letterSpacing: '0.04em' }}>
                        Attached Mission Submissions ({data.attachments.length})
                      </div>
                      <div className="d-flex flex-column gap-2">
                        {data.attachments.map((a, i) => (
                          <FileCard
                            key={i}
                            file={a}
                            onPreview={(file) => setPreviewFile(file)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </Panel>
              </Col>

              <Col lg={6}>
                <Panel title={t('sub.grading')}>
                  {locked ? (
                    <Alert variant="success" className="py-2">
                      <i className="fa-solid fa-lock me-2" aria-hidden="true" />
                      {t('sub.visibleToStudent')} · {t('sub.locked')}
                    </Alert>
                  ) : evaluated ? (
                    <Alert variant="warning" className="py-2">
                      <i className="fa-solid fa-eye-slash me-2" aria-hidden="true" />
                      {t('sub.notPublished')}
                    </Alert>
                  ) : null}

                  {err && <Alert variant="danger" role="alert">{err}</Alert>}

                  <Form onSubmit={save} noValidate>
                    <Form.Group className="mb-3" controlId="g-score">
                      <Form.Label>
                        {t('common.score')}
                        {max != null && <span className="text-muted ms-2 mono small">/ {max}</span>}
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        max={max != null ? max : undefined}
                        step="any"
                        value={f.score}
                        onChange={set('score')}
                        disabled={locked}
                        isInvalid={touched && scoreBad}
                      />
                      <Form.Control.Feedback type="invalid">
                        {max != null ? `${t('sub.maxHint')}: ${max}` : t('common.error')}
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="g-fb">
                      <Form.Label>{t('common.feedback')}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={f.feedback}
                        onChange={set('feedback')}
                        disabled={locked}
                        maxLength={5000}
                        isInvalid={touched && empty}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="g-st">
                      <Form.Label>{t('sub.strengths')}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={f.strengths}
                        onChange={set('strengths')}
                        disabled={locked}
                        maxLength={3000}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="g-im">
                      <Form.Label>{t('sub.improvements')}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={f.improvements}
                        onChange={set('improvements')}
                        disabled={locked}
                        maxLength={3000}
                      />
                    </Form.Group>

                    {!locked && (
                      <div className="d-flex flex-wrap gap-2">
                        <Button type="submit" className="btn-egsa" disabled={busy}>
                          {busy && <Spinner size="sm" className="me-2" />}
                          {t('sub.saveEval')}
                        </Button>
                        <Button
                          variant="outline-primary"
                          className="btn-gold"
                          type="button"
                          disabled={!evaluated || busy}
                          onClick={() => setConfirm(true)}
                        >
                          <i className="fa-solid fa-paper-plane me-2" aria-hidden="true" />
                          {t('sub.publishResult')}
                        </Button>
                      </div>
                    )}
                  </Form>
                </Panel>
              </Col>
            </Row>
          </>
        )}
      </StateView>

      <ConfirmModal
        show={confirm}
        variant="primary"
        title={t('sub.publishResult')}
        body={t('sub.publishConfirm')}
        confirmLabel={t('sub.publishResult')}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={publish}
      />

      <FilePreviewModal
        show={Boolean(previewFile)}
        file={previewFile}
        onHide={() => setPreviewFile(null)}
      />
    </>
  );
}

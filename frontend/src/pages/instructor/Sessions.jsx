import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { ConfirmModal, PageHeader, Panel, StateView, styles as s } from '../../components/instructor/ui.jsx';
import { useSessionLabel } from '../../components/instructor/tables.jsx';
import useFetch from '../../hooks/useFetch.js';
import { instructorApi } from '../../services/instructor.js';
import { useI18n } from '../../i18n/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { friendlyError } from '../../utils/errors.js';
import SessionControlCard, { SessionStatusBadge } from '../../components/instructor/SessionControlCard.jsx';
import QRProjectorModal from '../../components/instructor/QRProjectorModal.jsx';

function SessionForm({ show, onHide, initial, cohorts, onSaved }) {
  const { t } = useI18n(); const toast = useToast(); const editing = !!initial?._id;
  const blank = { cohortId: cohorts[0]?._id || '', title: '', description: '', date: '', startTime: '09:00', endTime: '11:00', location: '', onlineUrl: '' };
  const [f, setF] = useState(() => (editing ? { title: initial.title, description: initial.description || '', date: initial.date?.slice(0, 10), startTime: initial.startTime, endTime: initial.endTime, location: initial.location || '', onlineUrl: initial.onlineUrl || '' } : blank));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [touched, setTouched] = useState(false);
  const bad = !f.title.trim() || !f.date || !f.startTime || !f.endTime || f.endTime <= f.startTime || (!editing && !f.cohortId);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setTouched(true); if (bad) return; setBusy(true); setErr(null);
    try { const body = { ...f }; if (editing) { delete body.cohortId; await instructorApi.updateSession(initial._id, body); toast.success(t('sessions.updated')); } else { await instructorApi.createSession(body); toast.success(t('sessions.created')); } onSaved(); onHide(); }
    catch (x) { setErr(friendlyError(x, t)); } finally { setBusy(false); }
  };
  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">{editing ? t('sessions.edit') : t('sessions.new')}</Modal.Title></Modal.Header>
        <Modal.Body>
          {err && <Alert variant="danger" role="alert">{err}</Alert>}
          <Row className="g-3">
            {!editing && <Col md={12}><Form.Group controlId="sf-cohort"><Form.Label>{t('common.cohort')}</Form.Label><Form.Select value={f.cohortId} onChange={set('cohortId')}>{cohorts.map((c) => <option key={c._id} value={c._id}>{c.name} — {c.course?.name}</option>)}</Form.Select></Form.Group></Col>}
            <Col md={12}><Form.Group controlId="sf-title"><Form.Label>{t('common.title')} *</Form.Label><Form.Control value={f.title} onChange={set('title')} isInvalid={touched && !f.title.trim()} maxLength={160} /><Form.Control.Feedback type="invalid">{t('common.required')}</Form.Control.Feedback></Form.Group></Col>
            <Col md={4}><Form.Group controlId="sf-date"><Form.Label>{t('common.date')} *</Form.Label><Form.Control type="date" value={f.date} onChange={set('date')} isInvalid={touched && !f.date} /></Form.Group></Col>
            <Col md={4}><Form.Group controlId="sf-st"><Form.Label>{t('common.start')} *</Form.Label><Form.Control type="time" value={f.startTime} onChange={set('startTime')} /></Form.Group></Col>
            <Col md={4}><Form.Group controlId="sf-et"><Form.Label>{t('common.end')} *</Form.Label><Form.Control type="time" value={f.endTime} onChange={set('endTime')} isInvalid={touched && f.endTime <= f.startTime} /><Form.Control.Feedback type="invalid">{t('sessions.timeError')}</Form.Control.Feedback></Form.Group></Col>
            <Col md={6}><Form.Group controlId="sf-loc"><Form.Label>{t('common.location')}</Form.Label><Form.Control value={f.location} onChange={set('location')} maxLength={200} /></Form.Group></Col>
            <Col md={6}><Form.Group controlId="sf-url"><Form.Label>{t('common.online')}</Form.Label><Form.Control type="url" value={f.onlineUrl} onChange={set('onlineUrl')} maxLength={500} /></Form.Group></Col>
            <Col md={12}><Form.Group controlId="sf-desc"><Form.Label>{t('common.description')}</Form.Label><Form.Control as="textarea" rows={3} value={f.description} onChange={set('description')} maxLength={2000} /></Form.Group></Col>
          </Row>
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" onClick={onHide}>{t('common.cancel')}</Button><Button type="submit" className="btn-egsa" disabled={busy}>{busy && <Spinner size="sm" className="me-2" />}{t('common.save')}</Button></Modal.Footer>
      </Form>
    </Modal>
  );
}

export function SessionsPage() {
  const { t } = useI18n(); const label = useSessionLabel();
  const [cohortId, setCohortId] = useState(''); const [status, setStatus] = useState(''); const [upcoming, setUpcoming] = useState(false); const [showNew, setShowNew] = useState(false);
  const cohorts = useFetch(() => instructorApi.cohorts());
  const { data, loading, error, reload } = useFetch(() => instructorApi.sessions({ cohortId, status, upcoming: upcoming ? 'true' : '', limit: 100 }), [cohortId, status, upcoming]);

  // Projector modal quick launcher for any session
  const [projectorSession, setProjectorSession] = useState(null);

  // Active or most relevant session for the Command Center card
  const activeOrFeaturedSession = useMemo(() => {
    if (!data || !data.length) return null;
    // Prefer In_Progress session
    const active = data.find((s) => {
      const st = String(s.status || '').toLowerCase();
      return st === 'in_progress' || st === 'inprogress' || st === 'active';
    });
    if (active) return active;
    // Fallback to first scheduled session
    const scheduled = data.find((s) => String(s.status || '').toLowerCase() === 'scheduled');
    return scheduled || data[0];
  }, [data]);

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="CubeSat Telemetry & Ground Stations"
        actions={
          <div className="d-flex align-items-center gap-2">
            {cohorts.data?.length ? (
              <Button className="btn-egsa" onClick={() => setShowNew(true)}>
                <i className="fa-solid fa-plus me-2" aria-hidden="true" />
                {t('sessions.new')}
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Featured Session Command Center Hero Card */}
      {activeOrFeaturedSession && (
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <i className="fa-solid fa-tower-broadcast" style={{ color: '#3A6985' }} />
              Live Session Control
            </h5>
          </div>
          <SessionControlCard
            session={activeOrFeaturedSession}
            onSessionUpdated={() => reload()}
            showProjectorLauncher={true}
          />
        </div>
      )}

      {/* Filters Toolbar */}
      <Panel className="mb-3">
        <Row className="g-2 align-items-end">
          <Col md={4}>
            <Form.Label htmlFor="f-cohort" className="small">{t('common.cohort')}</Form.Label>
            <Form.Select id="f-cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {cohorts.data?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label htmlFor="f-status" className="small">{t('common.status')}</Form.Label>
            <Form.Select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {['scheduled', 'in_progress', 'completed', 'cancelled'].map((x) => (
                <option key={x} value={x}>
                  {x === 'in_progress' ? 'In Progress' : t(`status.${x}`)}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Check type="switch" id="f-up" label={t('sessions.upcomingOnly')} checked={upcoming} onChange={(e) => setUpcoming(e.target.checked)} />
          </Col>
        </Row>
      </Panel>

      {/* Session Roster Table */}
      <Panel flush>
        <StateView loading={loading} error={error} onRetry={reload} empty={data && !data.length} emptyText={t('sessions.empty')} emptyIcon="fa-calendar-xmark">
          <div className={s.tableWrap}>
            <Table hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>{t('common.title')}</th>
                  <th>{t('common.course')}</th>
                  <th>{t('common.cohort')}</th>
                  <th>{t('common.date')}</th>
                  <th>{t('common.status')}</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((x) => (
                  <tr key={x._id}>
                    <td className="fw-semibold">
                      <Link to={`/instructor/sessions/${x._id}`} className="text-decoration-none text-dark hover-primary">
                        {x.title}
                      </Link>
                    </td>
                    <td>{x.course?.name || x.course?.title}</td>
                    <td className="mono small">{x.cohort?.name}</td>
                    <td className="small mono">{label(x)}</td>
                    <td>
                      <SessionStatusBadge status={x.status} />
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex align-items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline-dark"
                          className="d-inline-flex align-items-center gap-1"
                          onClick={() => setProjectorSession(x)}
                          title="Open Classroom Projector Mode"
                          style={{ borderColor: '#3A6985', color: '#3A6985' }}
                        >
                          <i className="fa-solid fa-display" />
                          <span className="d-none d-lg-inline">Projector</span>
                        </Button>
                        <Link className="btn btn-sm btn-outline-secondary" to={`/instructor/sessions/${x._id}`}>
                          {t('common.open')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </StateView>
      </Panel>

      {showNew && cohorts.data && <SessionForm show onHide={() => setShowNew(false)} cohorts={cohorts.data} onSaved={reload} />}

      {/* Classroom Projector Modal for Selected Row */}
      {projectorSession && (
        <QRProjectorModal
          show={Boolean(projectorSession)}
          onHide={() => setProjectorSession(null)}
          session={projectorSession}
          onSessionUpdated={(fresh) => {
            setProjectorSession((prev) => ({ ...prev, ...fresh }));
            reload();
          }}
        />
      )}
    </>
  );
}

export function SessionDetail() {
  const { id } = useParams(); const { t, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => instructorApi.session(id), [id]);
  const [edit, setEdit] = useState(false); const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const cancel = async () => { setBusy(true); try { await instructorApi.updateSession(id, { status: 'cancelled' }); toast.success(t('sessions.updated')); setConfirm(false); reload(); } catch (x) { toast.error(friendlyError(x, t)); } finally { setBusy(false); } };

  return (
    <>
      <PageHeader
        back="/instructor/sessions"
        eyebrow={data?.cohort?.name || 'EgSA Flight Session'}
        title={data?.title || t('sessions.title')}
        subtitle={data?.course?.name || data?.course?.title}
        actions={
          data && data.status !== 'cancelled' && (
            <>
              <Link className="btn btn-egsa" to={`/instructor/attendance?sessionId=${id}`}>
                <i className="fa-solid fa-clipboard-user me-2" aria-hidden="true" />
                {t('sessions.takeAttendance')}
              </Link>
              <Button variant="outline-secondary" onClick={() => setEdit(true)}>
                {t('common.edit')}
              </Button>
              <Button variant="outline-danger" onClick={() => setConfirm(true)}>
                {t('sessions.cancelSession')}
              </Button>
            </>
          )
        }
      />

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            {/* Primary Session Control Card */}
            <SessionControlCard
              session={data}
              onSessionUpdated={() => reload()}
              showProjectorLauncher={true}
            />

            {/* Additional Session Specifications & Metadata Panel */}
            <Panel title="Session Specifications & Facilities">
              <dl className={s.kv}>
                <dt>{t('common.status')}</dt>
                <dd><SessionStatusBadge status={data.status} /></dd>
                <dt>{t('common.date')}</dt>
                <dd className="mono">{fmtDate(data.date)} · <bdi dir="ltr">{data.startTime}–{data.endTime}</bdi></dd>
                <dt>{t('common.location')}</dt>
                <dd>{data.location || data.classroom || '—'}</dd>
                <dt>{t('common.online')}</dt>
                <dd>{data.onlineUrl || data.meetingUrl ? <a href={data.onlineUrl || data.meetingUrl} target="_blank" rel="noreferrer noopener">{data.onlineUrl || data.meetingUrl}</a> : '—'}</dd>
                <dt>{t('common.description')}</dt>
                <dd>{data.description || data.focus || '—'}</dd>
                <dt>Classroom Code</dt>
                <dd className="mono fw-bold" style={{ letterSpacing: '0.1em', color: '#3A6985' }}>
                  {data?.qrCode?.code || (data?.qrCode?.token ? data.qrCode.token.slice(-6).toUpperCase() : 'EGSA26')}
                </dd>
              </dl>
            </Panel>
          </>
        )}
      </StateView>

      {edit && data && <SessionForm show onHide={() => setEdit(false)} initial={data} cohorts={[]} onSaved={reload} />}
      <ConfirmModal show={confirm} title={t('sessions.cancelSession')} body={t('sessions.cancelConfirm')} busy={busy} onConfirm={cancel} onCancel={() => setConfirm(false)} />
    </>
  );
}

export default SessionsPage;

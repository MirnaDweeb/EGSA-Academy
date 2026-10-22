import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Row, Col, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { instructorApi } from '../../services/instructor.js';
import { useToast } from '../../context/ToastContext.jsx';
import QRProjectorModal from './QRProjectorModal.jsx';

/**
 * Status Badge for Session Control with EgSA Institutional Colors
 * - Scheduled (Neutral Slate #64748B)
 * - In Progress (Pulsing Cosmos Blue #3A6985)
 * - Completed (Deep Teal #1E7C85)
 */
export function SessionStatusBadge({ status }) {
  const norm = String(status || '').toLowerCase().replace('-', '_');

  if (norm === 'in_progress' || norm === 'inprogress' || norm === 'active') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 14px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(58, 105, 133, 0.12)',
          color: '#3A6985',
          border: '1.5px solid #3A6985',
          fontWeight: 700,
          fontSize: '0.8rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          boxShadow: '0 0 10px rgba(58, 105, 133, 0.25)',
        }}
      >
        <span
          style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            backgroundColor: '#3A6985',
            boxShadow: '0 0 0 0 rgba(58, 105, 133, 0.7)',
            animation: 'pulseCosmos 1.5s infinite',
          }}
        />
        <style>
          {`
            @keyframes pulseCosmos {
              0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(58, 105, 133, 0.8); }
              70% { transform: scale(1.15); box-shadow: 0 0 0 8px rgba(58, 105, 133, 0); }
              100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(58, 105, 133, 0); }
            }
          `}
        </style>
        In Progress
      </span>
    );
  }

  if (norm === 'completed') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 14px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(30, 124, 133, 0.12)',
          color: '#1E7C85',
          border: '1.5px solid #1E7C85',
          fontWeight: 700,
          fontSize: '0.8rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <i className="fa-solid fa-circle-check" />
        Completed
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 14px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(100, 116, 139, 0.12)',
        color: '#64748B',
        border: '1.5px solid #64748B',
        fontWeight: 600,
        fontSize: '0.8rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      <i className="fa-regular fa-clock" />
      Scheduled
    </span>
  );
}

/**
 * Session Control Card
 * EgSA Platform Specification — Section 4, 10.1, 10.2, 18
 */
export default function SessionControlCard({
  session,
  onSessionUpdated,
  showProjectorLauncher = true,
  condensed = false,
}) {
  const toast = useToast();
  const [currentSession, setCurrentSession] = useState(session);
  const [busyAction, setBusyAction] = useState(null); // 'start', 'end', 'cycle', 'verify'
  const [showProjector, setShowProjector] = useState(false);

  // Sync state if session prop updates externally
  useEffect(() => {
    if (session) setCurrentSession(session);
  }, [session]);

  const sessId = currentSession?._id;
  const statusNorm = String(currentSession?.status || '').toLowerCase().replace('-', '_');
  const isInProgress = statusNorm === 'in_progress' || statusNorm === 'inprogress' || statusNorm === 'active';
  const isCompleted = statusNorm === 'completed';

  // Extract display information
  const cohortName = currentSession?.cohort?.name || currentSession?.cohortName || 'EgSA Flight Cohort';
  const courseName = currentSession?.course?.name || currentSession?.course?.title || currentSession?.courseName || '';
  const roomLocation = currentSession?.location || currentSession?.classroom || 'EGSA Ground Tracking Lab';
  
  // Format scheduled time
  const sessionDate = currentSession?.date ? new Date(currentSession.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const scheduledTimeStr = `${sessionDate ? `${sessionDate} · ` : ''}${currentSession?.startTime || '10:00'} – ${currentSession?.endTime || '14:00'}`;

  // Live counts
  const totalEnrolled = currentSession?.totalEnrolled ?? currentSession?.counts?.totalEnrolled ?? 0;
  const scannedPendingCount = currentSession?.scannedPendingCount ?? currentSession?.counts?.scannedPendingCount ?? 0;
  const verifiedPresentCount = currentSession?.verifiedPresentCount ?? currentSession?.counts?.verifiedPresentCount ?? 0;

  // Poll metrics every 5s if in progress and not currently busy
  useEffect(() => {
    if (!isInProgress || !sessId) return;
    const interval = setInterval(async () => {
      try {
        const res = await instructorApi.session(sessId);
        const data = res?.data || res;
        if (data) {
          setCurrentSession((prev) => ({
            ...prev,
            ...data,
            totalEnrolled: data.totalEnrolled ?? data.counts?.totalEnrolled ?? prev?.totalEnrolled,
            scannedPendingCount: data.scannedPendingCount ?? data.counts?.scannedPendingCount ?? prev?.scannedPendingCount,
            verifiedPresentCount: data.verifiedPresentCount ?? data.counts?.verifiedPresentCount ?? prev?.verifiedPresentCount,
          }));
        }
      } catch (e) {
        // quiet error on background poll
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isInProgress, sessId]);

  // Handle Launch Live Session
  const handleLaunchSession = async () => {
    if (!sessId || busyAction) return;
    setBusyAction('start');
    try {
      const res = await instructorApi.startSession(sessId);
      const updated = res?.data || res;
      setCurrentSession((prev) => ({ ...prev, ...updated, status: 'In_Progress' }));
      toast.success('Live Flight Session launched! Dynamic QR check-in active.');
      if (onSessionUpdated) onSessionUpdated(updated);
      // Auto-open classroom projector mode
      setShowProjector(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to start session.');
    } finally {
      setBusyAction(null);
    }
  };

  // Handle Conclude Session
  const handleConcludeSession = async () => {
    if (!sessId || busyAction) return;
    if (!window.confirm('Conclude this session? Active QR check-in token will be invalidated.')) {
      return;
    }
    setBusyAction('end');
    try {
      const res = await instructorApi.endSession(sessId);
      const updated = res?.data || res;
      setCurrentSession((prev) => ({ ...prev, ...updated, status: 'Completed' }));
      toast.success('Session concluded successfully. Attendance lock active.');
      setShowProjector(false);
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to conclude session.');
    } finally {
      setBusyAction(null);
    }
  };

  // Handle Regenerate QR Token
  const handleCycleToken = async () => {
    if (!sessId || busyAction) return;
    setBusyAction('cycle');
    try {
      const res = await instructorApi.regenerateQR(sessId);
      const updated = res?.data || res;
      setCurrentSession((prev) => ({ ...prev, ...updated }));
      toast.success('Fresh dynamic QR token generated for on-premise security.');
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to cycle QR token.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <Card
        className="mb-4 shadow-sm"
        style={{
          border: isInProgress ? '2px solid #3A6985' : '1px solid rgba(14, 26, 34, 0.12)',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Top Institutional Header Accent */}
        <div
          style={{
            height: '4px',
            backgroundColor: isInProgress ? '#3A6985' : isCompleted ? '#1E7C85' : '#64748B',
          }}
        />

        <Card.Body className="p-4">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  style={{
                    backgroundColor: '#0E1A22',
                    color: '#D4B87C',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  {cohortName}
                </span>
                {courseName && (
                  <span className="text-muted small fw-semibold">
                    · {courseName}
                  </span>
                )}
              </div>
              <h4 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                {currentSession?.title || 'Flight Simulation & Telemetry'}
              </h4>
            </div>

            {/* Status Badge */}
            <div>
              <SessionStatusBadge status={currentSession?.status} />
            </div>
          </div>

          {/* Session Metadata Grid */}
          <Row className="g-3 mb-3 pt-2 pb-3" style={{ borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>
            <Col sm={6} md={4}>
              <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.04em', fontSize: '0.75rem' }}>
                <i className="fa-solid fa-location-dot me-1.5" style={{ color: '#3A6985' }} />
                Room / Lab Location
              </div>
              <div className="fw-bold text-dark mt-1" style={{ fontSize: '0.92rem' }}>
                {roomLocation}
              </div>
            </Col>

            <Col sm={6} md={4}>
              <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.04em', fontSize: '0.75rem' }}>
                <i className="fa-regular fa-clock me-1.5" style={{ color: '#3A6985' }} />
                Scheduled Time
              </div>
              <div className="fw-bold text-dark mt-1" style={{ fontSize: '0.92rem' }}>
                {scheduledTimeStr}
              </div>
            </Col>

            <Col sm={12} md={4}>
              <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.04em', fontSize: '0.75rem' }}>
                <i className="fa-solid fa-users-viewfinder me-1.5" style={{ color: '#1E7C85' }} />
                Classroom Attendance
              </div>
              <div className="d-flex align-items-center gap-2 mt-1">
                <span className="badge" style={{ backgroundColor: '#1E7C85', color: '#fff', fontSize: '0.85rem' }}>
                  {verifiedPresentCount} Verified
                </span>
                <span className="badge" style={{ backgroundColor: '#D4B87C', color: '#0E1A22', fontSize: '0.85rem' }}>
                  {scannedPendingCount} Pending
                </span>
                <span className="text-muted small">
                  of {totalEnrolled} Enrolled
                </span>
              </div>
            </Col>
          </Row>

          {/* Real-Time Attendance Ticker Alert if scans awaiting verification */}
          {scannedPendingCount > 0 && (
            <Alert
              variant="warning"
              className="py-2.5 px-3 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
              style={{
                backgroundColor: 'rgba(212, 184, 124, 0.15)',
                borderColor: '#D4B87C',
                color: '#654D12',
                borderRadius: '8px',
              }}
            >
              <div className="d-flex align-items-center gap-2 fw-semibold">
                <i className="fa-solid fa-qrcode fa-spin" style={{ color: '#3A6985', animationDuration: '3s' }} />
                <span>
                  <strong>{scannedPendingCount} Students Scanned</strong> — Awaiting Your Verification
                </span>
              </div>
              <Link
                to={`/instructor/attendance?sessionId=${sessId}`}
                className="btn btn-sm"
                style={{ backgroundColor: '#3A6985', color: '#fff', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Review Roster <i className="fa-solid fa-arrow-right ms-1" />
              </Link>
            </Alert>
          )}

          {/* Action Buttons Row */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-1">
            <div className="d-flex flex-wrap align-items-center gap-2">
              {/* Primary Action Button: Launch Live Session */}
              {!isInProgress && !isCompleted && (
                <Button
                  className="btn-egsa d-inline-flex align-items-center gap-2"
                  onClick={handleLaunchSession}
                  disabled={busyAction === 'start'}
                  style={{
                    backgroundColor: '#3A6985',
                    borderColor: '#3A6985',
                    fontWeight: 600,
                    padding: '8px 18px',
                  }}
                >
                  {busyAction === 'start' ? (
                    <Spinner size="sm" />
                  ) : (
                    <i className="fa-solid fa-play" />
                  )}
                  Launch Live Session
                </Button>
              )}

              {/* Primary Action Button: Conclude Session */}
              {isInProgress && (
                <Button
                  variant="outline-danger"
                  className="d-inline-flex align-items-center gap-2"
                  onClick={handleConcludeSession}
                  disabled={busyAction === 'end'}
                  style={{
                    borderColor: '#DF4F4C',
                    color: '#DF4F4C',
                    fontWeight: 600,
                    padding: '8px 18px',
                  }}
                >
                  {busyAction === 'end' ? (
                    <Spinner size="sm" />
                  ) : (
                    <i className="fa-solid fa-flag-checkered" />
                  )}
                  Conclude Session
                </Button>
              )}

              {/* Projector Mode Launcher Button */}
              {showProjectorLauncher && (
                <Button
                  variant="outline-dark"
                  className="d-inline-flex align-items-center gap-2"
                  onClick={() => setShowProjector(true)}
                  style={{
                    borderColor: '#3A6985',
                    color: '#3A6985',
                    fontWeight: 600,
                    padding: '8px 16px',
                  }}
                >
                  <i className="fa-solid fa-display" />
                  Classroom Projector Mode
                </Button>
              )}

              {/* Cycle Token Action */}
              {isInProgress && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="d-inline-flex align-items-center gap-1.5"
                  onClick={handleCycleToken}
                  disabled={busyAction === 'cycle'}
                  title="Generate a fresh QR token for security cycling"
                >
                  {busyAction === 'cycle' ? (
                    <Spinner size="sm" />
                  ) : (
                    <i className="fa-solid fa-arrows-rotate" />
                  )}
                  Cycle Token Now
                </Button>
              )}
            </div>

            <div className="d-flex align-items-center gap-2">
              <Link
                to={`/instructor/attendance?sessionId=${sessId}`}
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5"
              >
                <i className="fa-solid fa-clipboard-user" />
                Attendance Roster
              </Link>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Classroom Projector Mode Modal */}
      {showProjector && (
        <QRProjectorModal
          show={showProjector}
          onHide={() => setShowProjector(false)}
          session={currentSession}
          onCycleToken={handleCycleToken}
          onSessionUpdated={(fresh) => {
            setCurrentSession((prev) => ({ ...prev, ...fresh }));
            if (onSessionUpdated) onSessionUpdated(fresh);
          }}
        />
      )}
    </>
  );
}

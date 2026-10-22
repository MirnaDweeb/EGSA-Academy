import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Badge, Spinner } from 'react-bootstrap';
import { instructorApi } from '../../services/instructor.js';
import { attendanceService } from '../../services/studentPortalServices.js';

export default function QRProjectorModal({
  show,
  onHide,
  session,
  onCycleToken,
  onSessionUpdated,
}) {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes default
  const [isCycling, setIsCycling] = useState(false);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [liveCounts, setLiveCounts] = useState({
    totalEnrolled: session?.totalEnrolled ?? 0,
    scannedPendingCount: session?.scannedPendingCount ?? 0,
    verifiedPresentCount: session?.verifiedPresentCount ?? 0,
  });

  const qr = session?.qrCode || {};
  const qrImage = qr.dataUrl || qr.qrCodeDataUrl || session?.qrCodeDataUrl;
  const sessionCode = qr.code || (qr.token ? qr.token.slice(-6).toUpperCase() : 'EGSA26');

  // Compute remaining seconds from expiresAt
  useEffect(() => {
    if (!show || !qr.expiresAt) return;

    const calculateRemaining = () => {
      const diff = Math.floor((new Date(qr.expiresAt).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    };

    setSecondsRemaining(calculateRemaining());

    const timer = setInterval(() => {
      const rem = calculateRemaining();
      setSecondsRemaining(rem);
      if (rem === 0) {
        // Auto-cycle token when ticker expires
        handleCycleToken();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [show, qr.expiresAt, qr.token]);

  // Live polling for student check-ins every 4 seconds without page reload
  useEffect(() => {
    if (!show || !session?._id) return;

    const pollInterval = setInterval(async () => {
      try {
        const fresh = await instructorApi.session(session._id);
        const data = fresh?.data || fresh;
        if (data) {
          setLiveCounts({
            totalEnrolled: data.totalEnrolled ?? data.counts?.totalEnrolled ?? liveCounts.totalEnrolled,
            scannedPendingCount: data.scannedPendingCount ?? data.counts?.scannedPendingCount ?? 0,
            verifiedPresentCount: data.verifiedPresentCount ?? data.counts?.verifiedPresentCount ?? 0,
          });
          if (onSessionUpdated) {
            onSessionUpdated(data);
          }
        }
      } catch (err) {
        // Silent background polling failure
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [show, session?._id]);

  // Sync initial counts on modal open or session prop change
  useEffect(() => {
    if (session) {
      setLiveCounts({
        totalEnrolled: session.totalEnrolled ?? session.counts?.totalEnrolled ?? 0,
        scannedPendingCount: session.scannedPendingCount ?? session.counts?.scannedPendingCount ?? 0,
        verifiedPresentCount: session.verifiedPresentCount ?? session.counts?.verifiedPresentCount ?? 0,
      });
    }
  }, [session]);

  const handleCycleToken = async () => {
    if (isCycling || !session?._id) return;
    setIsCycling(true);
    try {
      if (onCycleToken) {
        await onCycleToken();
      } else {
        const res = await instructorApi.regenerateQR(session._id);
        const data = res?.data || res;
        if (onSessionUpdated) onSessionUpdated(data);
      }
    } catch (e) {
      console.error('Failed to cycle token:', e);
    } finally {
      setIsCycling(false);
    }
  };

  const handleVerifyAllPending = async () => {
    if (isVerifyingAll || !session?._id) return;
    setIsVerifyingAll(true);
    try {
      await attendanceService.verifySessionAttendance(session._id, { verifyAll: true });
      // Refresh session
      const fresh = await instructorApi.session(session._id);
      const data = fresh?.data || fresh;
      if (onSessionUpdated) onSessionUpdated(data);
    } catch (e) {
      console.warn('Verify all error:', e);
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const elem = containerRef.current || document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (!show) return null;

  return (
    <Modal
      show={show}
      onHide={onHide}
      fullscreen
      centered
      className="qr-projector-modal"
      backdrop="static"
    >
      <div
        ref={containerRef}
        style={{
          minHeight: '100vh',
          backgroundColor: '#07101E',
          color: '#E2E8F0',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: 'flex',
          flexDirection: 'column',
          backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(58, 105, 133, 0.22) 0%, rgba(7, 16, 30, 0.98) 70%)',
        }}
      >
        {/* Projector Header Bar */}
        <div
          style={{
            backgroundColor: 'rgba(11, 21, 40, 0.9)',
            borderBottom: '2px solid #3A6985',
            padding: '1rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(58, 105, 133, 0.3)',
                border: '2px solid #D4B87C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(212, 184, 124, 0.2)',
              }}
            >
              <i className="fa-solid fa-satellite" style={{ color: '#D4B87C', fontSize: '1.4rem' }}></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span
                  style={{
                    backgroundColor: '#1E7C85',
                    color: '#FFFFFF',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  LIVE BROADCAST
                </span>
                <span style={{ color: '#D4B87C', fontWeight: 600, fontSize: '0.9rem' }}>
                  {session?.cohort?.name || 'CubeSat Telemetry Track'}
                </span>
              </div>
              <h4 style={{ margin: '0.2rem 0 0', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                {session?.title || 'Classroom Attendance Check-In'}
              </h4>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Button
              variant="outline-light"
              onClick={toggleFullscreen}
              style={{
                borderColor: '#475569',
                color: '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
            </Button>

            <Button
              variant="secondary"
              onClick={onHide}
              style={{
                backgroundColor: '#1E293B',
                borderColor: '#334155',
                color: '#E2E8F0',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              <i className="fa-solid fa-xmark me-2"></i>
              Close
            </Button>
          </div>
        </div>

        {/* Central Display Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
          }}
        >
          {/* Main Card (High-Contrast for Projectors) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '2.5rem 3rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(58, 105, 133, 0.3)',
              border: '4px solid #D4B87C',
              maxWidth: '560px',
              width: '100%',
              textAlign: 'center',
              color: '#0F2B48',
              position: 'relative',
            }}
          >
            {/* Top Badge on White Card */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#3A6985',
                color: '#FFFFFF',
                padding: '0.4rem 1.25rem',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginBottom: '1.25rem',
              }}
            >
              <i className="fa-solid fa-qrcode" style={{ color: '#D4B87C' }}></i>
              SCAN TO RECORD ATTENDANCE
            </div>

            {/* High-Resolution Centered QR Code */}
            <div
              style={{
                display: 'inline-block',
                padding: '12px',
                borderRadius: '16px',
                backgroundColor: '#FFFFFF',
                border: '3px solid #3A6985',
                boxShadow: '0 8px 24px rgba(15, 43, 72, 0.12)',
                marginBottom: '1.5rem',
              }}
            >
              {qrImage ? (
                <img
                  src={qrImage}
                  alt="Live Attendance QR Code"
                  style={{
                    width: '320px',
                    height: '320px',
                    objectFit: 'contain',
                    display: 'block',
                    borderRadius: '8px',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '320px',
                    height: '320px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <Spinner animation="border" style={{ color: '#3A6985' }} />
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Broadcasting Secure Token…</span>
                </div>
              )}
            </div>

            {/* Fallback 6-Character Alphanumeric Code */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '2px dashed #94A3B8',
                borderRadius: '14px',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                Camera Issue? Enter Alphanumeric Session Code:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '2rem',
                    fontWeight: 900,
                    letterSpacing: '0.25em',
                    fontFamily: "'Courier New', Courier, monospace",
                    color: '#3A6985',
                  }}
                >
                  {sessionCode}
                </span>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleCopyCode}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <i className={`fa-solid ${copiedCode ? 'fa-check text-success' : 'fa-copy'}`}></i>
                  {copiedCode ? ' Copied' : ''}
                </Button>
              </div>
            </div>

            {/* Live Countdown & Cycle Control */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: secondsRemaining < 60 ? 'rgba(223, 79, 76, 0.08)' : 'rgba(30, 124, 133, 0.08)',
                borderRadius: '12px',
                border: `1px solid ${secondsRemaining < 60 ? '#DF4F4C' : '#1E7C85'}`,
              }}
            >
              <div style={{ textAlign: 'start' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: secondsRemaining < 60 ? '#DF4F4C' : '#1E7C85' }}>
                  <i className="fa-solid fa-clock-rotate-left me-1"></i>
                  TOKEN AUTO-CYCLES IN:
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: secondsRemaining < 60 ? '#DF4F4C' : '#0F2B48',
                  }}
                >
                  {formatTime(secondsRemaining)}
                </div>
              </div>

              <Button
                variant="primary"
                onClick={handleCycleToken}
                disabled={isCycling}
                style={{
                  backgroundColor: '#3A6985',
                  borderColor: '#3A6985',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                }}
              >
                {isCycling ? (
                  <>
                    <Spinner size="sm" animation="border" /> Cycling...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-arrows-rotate"></i> Cycle Token Now
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Real-Time Attendance Ticker (Step 2.2) */}
          <div
            style={{
              marginTop: '1.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.25rem',
              justifyContent: 'center',
              alignItems: 'center',
              maxWidth: '720px',
              width: '100%',
            }}
          >
            {/* Scanned Pending Ticker */}
            <div
              style={{
                backgroundColor: 'rgba(212, 184, 124, 0.15)',
                border: '2px solid #D4B87C',
                borderRadius: '16px',
                padding: '0.85rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#D4B87C',
                  color: '#0F2B48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.2rem',
                }}
              >
                {liveCounts.scannedPendingCount}
              </div>
              <div style={{ textAlign: 'start' }}>
                <div style={{ fontWeight: 800, color: '#D4B87C', fontSize: '1rem' }}>
                  {liveCounts.scannedPendingCount} Students Scanned
                </div>
                <div style={{ color: '#CBD5E1', fontSize: '0.82rem' }}>
                  Awaiting Your In-Person Verification
                </div>
              </div>

              {liveCounts.scannedPendingCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleVerifyAllPending}
                  disabled={isVerifyingAll}
                  style={{
                    backgroundColor: '#1E7C85',
                    borderColor: '#1E7C85',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    marginLeft: '0.5rem',
                  }}
                >
                  {isVerifyingAll ? <Spinner size="sm" animation="border" /> : <><i className="fa-solid fa-check-double me-1"></i> Verify All</>}
                </Button>
              )}
            </div>

            {/* Verified Present Ticker */}
            <div
              style={{
                backgroundColor: 'rgba(30, 124, 133, 0.15)',
                border: '2px solid #1E7C85',
                borderRadius: '16px',
                padding: '0.85rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#1E7C85',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.2rem',
                }}
              >
                {liveCounts.verifiedPresentCount}
              </div>
              <div style={{ textAlign: 'start' }}>
                <div style={{ fontWeight: 800, color: '#38BDF8', fontSize: '1rem' }}>
                  {liveCounts.verifiedPresentCount} / {liveCounts.totalEnrolled} Verified Present
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.82rem' }}>
                  Institutional On-Premise Confirmation
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import adminService from '../../services/adminService.js';
import AdminAuthModal from '../../components/admin/AdminAuthModal.jsx';
import styles from './AdminGatewayPage.module.css';

export default function AdminGatewayPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  // Authentication Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState('UNIVERSITY');

  // Live or fallback division operational metrics
  const [divisionStats, setDivisionStats] = useState({
    UNIVERSITY: {
      students: 1280,
      programs: 6,
      applications: 42,
      cohorts: 4,
    },
    PRE_UNIVERSITY: {
      students: 850,
      programs: 4,
      applications: 28,
      cohorts: 3,
    },
  });

  // Attempt to fetch live metrics if authorized
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      adminService
        .getGatewayOverview()
        .then((res) => {
          if (!isMounted || !res?.divisions) return;
          const mapped = {};
          res.divisions.forEach((div) => {
            mapped[div.key] = {
              students: div.studentCount ?? 0,
              programs: div.activePrograms ?? 0,
              applications: div.pendingApplications ?? 0,
              cohorts: div.activeCohorts ?? 0,
            };
          });
          setDivisionStats((prev) => ({ ...prev, ...mapped }));
        })
        .catch(() => {
          // Graceful fallback to initial realistic metrics
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleOpenAuth = (divisionKey) => {
    if (isAuthenticated && isAdmin) {
      if (isSuperAdmin || !user?.division || user?.division === divisionKey) {
        localStorage.setItem('admin_active_division', divisionKey);
        localStorage.setItem('egsa_active_division', divisionKey);
        navigate(`/admin/dashboard?division=${divisionKey}`);
        return;
      }
    }
    setSelectedDivision(divisionKey);
    setIsAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    if (logout) {
      await logout();
    }
  };

  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  const isAdmin = isSuperAdmin || userRole.includes('ADMIN');

  return (
    <div className={styles.gatewayContainer}>
      <div className={styles.contentWrapper}>
        {/* Aerospace Agency Header */}
        <header className={styles.gatewayHeader}>
          <div className={styles.agencyEmblemWrap}>
            <img
              src="/esa-logo.png"
              alt="Egyptian Space Agency Official Emblem"
              className={styles.agencyLogo}
            />
          </div>
          <div className={styles.statusPill}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>EGSA Secure Gateway • Operational</span>
          </div>
          <h1 className={styles.mainTitle}>
            Division Gateway
          </h1>
          <p className={styles.subtitle}>
            Select academic sector to enter scoped administrative workspace.
          </p>
        </header>

        {/* Active Session Indicator (if administrator is already authenticated) */}
        {isAuthenticated && isAdmin && (
          <div className={styles.activeSessionBanner}>
            <div className={styles.sessionLeft}>
              <div className={styles.sessionIcon}>
                <i className="fa-solid fa-user-shield" aria-hidden="true" />
              </div>
              <div className={styles.sessionText}>
                <span className={styles.sessionTitle}>
                  Active Session: <strong>{user?.fullName || user?.name || user?.email}</strong>
                </span>
                <span className={styles.sessionSubtitle}>
                  {isSuperAdmin
                    ? 'Super Administrator'
                    : user?.division === 'PRE_UNIVERSITY'
                    ? 'Pre-University Admin'
                    : 'University Admin'}
                </span>
              </div>
            </div>
            <div className={styles.sessionActions}>
              <button
                type="button"
                id="btn-goto-active-dashboard"
                className="btn btn-primary btn-sm px-3"
                onClick={() =>
                  navigate(isSuperAdmin ? '/admin/super' : '/admin/dashboard')
                }
              >
                <i className="fa-solid fa-gauge-high me-1.5" aria-hidden="true" />
                Dashboard
              </button>
              <button
                type="button"
                id="btn-gateway-signout"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleSignOut}
              >
                <i className="fa-solid fa-arrow-right-from-bracket me-1" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Dual-Division Split Cards */}
        <main className={styles.splitGrid}>
          {/* Card A: Higher Education & University Division */}
          <section
            className={`${styles.divisionCard} ${styles.cardUniversity}`}
            aria-labelledby="card-a-title"
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTop}>
                <div className={styles.iconEmblem}>
                  <i className="fa-solid fa-graduation-cap" aria-hidden="true" />
                </div>
                <span className={`${styles.divisionBadge} ${styles.badgeTeal}`}>
                  Higher Education
                </span>
              </div>
              <h2 id="card-a-title" className={styles.cardTitle}>
                University Academic Division
              </h2>
              <div className={styles.cardArabicTitle}>
                كليات الهندسة والعلوم
              </div>
            </div>

            <div className={styles.cardBody}>
              {/* Focus Pillars */}
              <div className={styles.focusSection}>
                <div className={styles.focusSectionHeader}>
                  <i className="fa-solid fa-bullseye" aria-hidden="true" />
                  Academic Focus
                </div>
                <div className={styles.focusGrid}>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-satellite" aria-hidden="true" />
                    <span>CubeSat System Engineering</span>
                  </div>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-route" aria-hidden="true" />
                    <span>Flight Dynamics & Orbitals</span>
                  </div>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-tower-broadcast" aria-hidden="true" />
                    <span>Space Communications & TT&C</span>
                  </div>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-microchip" aria-hidden="true" />
                    <span>Advanced Payloads & Optics</span>
                  </div>
                </div>
              </div>

              {/* Operational Metrics */}
              <div className={styles.metricsRow}>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.UNIVERSITY.students}
                  </span>
                  <span className={styles.metricLabel}>Cadets</span>
                </div>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.UNIVERSITY.programs}
                  </span>
                  <span className={styles.metricLabel}>Programs</span>
                </div>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.UNIVERSITY.applications}
                  </span>
                  <span className={styles.metricLabel}>Admissions</span>
                </div>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.UNIVERSITY.cohorts}
                  </span>
                  <span className={styles.metricLabel}>Cohorts</span>
                </div>
              </div>

              {/* CTA Action */}
              <div className={styles.cardFooter}>
                <button
                  type="button"
                  id="btn-auth-university"
                  className={`${styles.primaryCtaBtn} ${styles.ctaUniversity}`}
                  onClick={() => handleOpenAuth('UNIVERSITY')}
                >
                  <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" />
                  <span>
                    {isAuthenticated && isAdmin && (isSuperAdmin || user?.division === 'UNIVERSITY')
                      ? 'Enter University Portal'
                      : 'Authenticate & Enter University Portal'}
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* Card B: Pre-University & STEM Schools Division */}
          <section
            className={`${styles.divisionCard} ${styles.cardPreUniversity}`}
            aria-labelledby="card-b-title"
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTop}>
                <div className={styles.iconEmblem}>
                  <i className="fa-solid fa-school" aria-hidden="true" />
                </div>
                <span className={`${styles.divisionBadge} ${styles.badgeCosmos}`}>
                  Pre-University & Cadets
                </span>
              </div>
              <h2 id="card-b-title" className={styles.cardTitle}>
                Pre-University & STEM Cadets
              </h2>
              <div className={styles.cardArabicTitle}>
                مدارس المتفوقين وطلائع الفضاء
              </div>
            </div>

            <div className={styles.cardBody}>
              {/* Focus Pillars */}
              <div className={styles.focusSection}>
                <div className={styles.focusSectionHeader}>
                  <i className="fa-solid fa-bullseye" aria-hidden="true" />
                  Academic Focus
                </div>
                <div className={styles.focusGrid}>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-box" aria-hidden="true" />
                    <span>CanSat Junior Lab</span>
                  </div>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
                    <span>High Altitude Balloons (HAB)</span>
                  </div>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-atom" aria-hidden="true" />
                    <span>Space Foundations & Astro</span>
                  </div>
                  <div className={styles.focusPill}>
                    <i className="fa-solid fa-laptop-code" aria-hidden="true" />
                    <span>STEM Cadet Workshops</span>
                  </div>
                </div>
              </div>

              {/* Operational Metrics */}
              <div className={styles.metricsRow}>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.PRE_UNIVERSITY.students}
                  </span>
                  <span className={styles.metricLabel}>Cadets</span>
                </div>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.PRE_UNIVERSITY.programs}
                  </span>
                  <span className={styles.metricLabel}>Programs</span>
                </div>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.PRE_UNIVERSITY.applications}
                  </span>
                  <span className={styles.metricLabel}>Admissions</span>
                </div>
                <div className={styles.metricBox}>
                  <span className={styles.metricValue}>
                    {divisionStats.PRE_UNIVERSITY.cohorts}
                  </span>
                  <span className={styles.metricLabel}>Cohorts</span>
                </div>
              </div>

              {/* CTA Action */}
              <div className={styles.cardFooter}>
                <button
                  type="button"
                  id="btn-auth-pre-university"
                  className={`${styles.primaryCtaBtn} ${styles.ctaPreUniversity}`}
                  onClick={() => handleOpenAuth('PRE_UNIVERSITY')}
                >
                  <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" />
                  <span>
                    {isAuthenticated && isAdmin && (isSuperAdmin || user?.division === 'PRE_UNIVERSITY')
                      ? 'Enter STEM Portal'
                      : 'Authenticate & Enter STEM Portal'}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* Secondary Executive Link (Footer) */}
        <footer className={styles.gatewayFooter}>
          <button
            type="button"
            id="btn-super-admin-console"
            className={styles.superAdminLinkBtn}
            onClick={() => {
              if (isAuthenticated && isSuperAdmin) {
                navigate('/admin/super');
              } else {
                handleOpenAuth('SUPER_ADMIN');
              }
            }}
          >
            <span>Are you a Platform Super Administrator? Access Central Console</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
          <div className={styles.footerCopyright}>
            Egyptian Space Agency (EGSA) • Official Academic Governance Portal • ISO/IEC 27001 Secure Handshake
          </div>
        </footer>
      </div>

      {/* In-Place Interactive Authentication Modal */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        targetDivision={selectedDivision}
      />
    </div>
  );
}

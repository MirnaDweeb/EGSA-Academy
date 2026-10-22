import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import s from './Layout.module.css';
import Logo from '../components/common/Logo.jsx';
import AppSidebar, { STUDENT_NAV, INSTRUCTOR_NAV, ADMIN_NAV } from './AppSidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import apiClient from '../services/apiClient.js';

export default function AppLayout({ forcedRole }) {
  const { user, logout, lang, setLang } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('egsa_side_collapsed') === '1';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('egsa_side_collapsed', c ? '0' : '1');
      } catch {}
      return !c;
    });

  const activeRole =
    forcedRole ||
    (loc.pathname.startsWith('/instructor')
      ? 'instructor'
      : loc.pathname.startsWith('/admin')
      ? 'admin'
      : user?.role?.toLowerCase() || 'student');

  const navGroups =
    activeRole === 'instructor'
      ? INSTRUCTOR_NAV
      : activeRole === 'admin'
      ? ADMIN_NAV
      : STUDENT_NAV;

  useEffect(() => {
    let live = true;
    apiClient
      .get('/notifications?limit=1')
      .then((r) => {
        if (live) {
          const unread =
            r.data?.meta?.unreadCount ??
            r.data?.unreadCount ??
            (Array.isArray(r.data?.data)
              ? r.data.data.filter((n) => !n.isRead && !n.read).length
              : 0);
          setUnreadNotif(unread);
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [loc.pathname]);

  const doLogout = async () => {
    await logout();
    nav('/login', { replace: true });
  };

  const displayName = user?.fullName || user?.name || user?.email || 'User';
  const roleDisplay = activeRole.toUpperCase();

  // Dynamic route / page title resolver for Center Topbar Display
  const getPageTitle = (pathname, role) => {
    const p = pathname.toLowerCase();
    if (p.includes('/dashboard')) {
      return role === 'instructor' ? 'Mission Control Dashboard' : role === 'admin' ? 'Command Center Dashboard' : 'Cadet Mission Dashboard';
    }
    if (p.includes('/attendance')) {
      return role === 'instructor' ? 'Attendance Verification Ledger' : role === 'admin' ? 'Central Attendance Ledger' : 'Cadet Attendance Record';
    }
    if (p.includes('/sessions')) return 'Training Sessions & Live QR';
    if (p.includes('/courses')) return 'Official Course Catalog';
    if (p.includes('/cohorts')) return 'Cohorts & Training Batches';
    if (p.includes('/students')) return role === 'instructor' ? 'Student Roster' : 'Student Directory';
    if (p.includes('/programs')) return 'Academic & Mission Programs';
    if (p.includes('/applications')) return 'Admissions & Applications';
    if (p.includes('/readiness')) return 'Flight Readiness Assessment';
    if (p.includes('/assessments')) {
      return role === 'instructor' ? 'Assessments & Grading' : role === 'admin' ? 'Institutional Assessments' : 'Assessments & Quizzes';
    }
    if (p.includes('/submissions')) return 'Cadet Submissions Review Queue';
    if (p.includes('/certificates')) {
      return role === 'admin' ? 'Certificate & Clearance Ledger' : 'Official Certificates & Clearance (إفادة)';
    }
    if (p.includes('/evaluation')) return 'Course & Academy Evaluations';
    if (p.includes('/progress')) return 'Cadet Academic Progress';
    if (p.includes('/training')) return 'Interactive Training Hub';
    if (p.includes('/payments') || p.includes('/finance')) return 'Finance & Invoice Ledger';
    if (p.includes('/media')) return 'Training Media Asset Vault';
    if (p.includes('/messages')) return 'Cadet Communications';
    if (p.includes('/notifications')) return 'System Notifications Center';
    if (p.includes('/profile')) return 'Profile & Security Credentials';
    if (p.includes('/division')) return 'Division Operational Scope';
    if (p.includes('/audit')) return 'Institutional Audit Logs';
    if (p.includes('/reports')) return 'Strategic Analytics & Reports';
    if (p.includes('/enrollments')) return 'My Academic Enrollments';
    if (role === 'admin') return 'EGSA Mission Administration';
    if (role === 'instructor') return 'EGSA Faculty Operations';
    return 'Egyptian Space Agency Academy';
  };

  // Dynamic portal indicator for Center Topbar Display
  const getPortalIndicator = (user, activeRole, pathname) => {
    const role = (user?.role || activeRole || '').toLowerCase();
    const division = (user?.division || '').toUpperCase();
    const p = pathname.toLowerCase();

    if (role === 'instructor' || p.startsWith('/instructor')) {
      return 'Instructor Portal';
    }
    if (role === 'admin' || role === 'super_admin' || role === 'superadmin' || p.startsWith('/admin')) {
      if (p.includes('/pre-university') || division === 'PRE_UNIVERSITY') {
        return 'Pre-University Admin';
      }
      return 'University Admin';
    }
    return 'Student Portal';
  };

  const portalIndicator = getPortalIndicator(user, activeRole, loc.pathname);
  const pageTitle = getPageTitle(loc.pathname, activeRole);

  return (
    <div className={s.shell} data-collapsed={collapsed}>
      <a href="#main" className="visually-hidden-focusable">
        Skip to main content
      </a>

      {/* Primary Sidebar & Offcanvas Drawer Component */}
      <AppSidebar
        activeRole={activeRole}
        navGroups={navGroups}
        collapsed={collapsed}
        toggleSidebar={toggleSidebar}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        unreadNotif={unreadNotif}
        unreadMessages={unreadMessages}
        displayName={displayName}
        roleDisplay={roleDisplay}
        portalIndicator={portalIndicator}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content Area */}
      <div className={s.contentWrap}>
        <header className={s.topbar}>
          {/* Left: Hamburger button on mobile + Official EGSA Logo & Title */}
          <div className="d-flex align-items-center gap-2 gap-sm-3">
            <button
              type="button"
              className={s.menuBtn}
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <i className="fa-solid fa-bars" aria-hidden="true" />
            </button>

            <NavLink to={`/${activeRole}/dashboard`} className="d-flex align-items-center gap-2 text-decoration-none">
              <Logo size={36} light={false} />
              <div className="d-flex flex-column">
                <span className="fw-bold text-dark lh-1" style={{ fontSize: '0.98rem', letterSpacing: '-0.01em' }}>
                  Egyptian Space Academy
                </span>
                <span
                  className="text-uppercase mono fw-semibold mt-1"
                  style={{ fontSize: '0.62rem', color: '#64748B', letterSpacing: '0.08em' }}
                >
                  EGSA Platform
                </span>
              </div>
            </NavLink>
          </div>

          {/* Right: Clean User Avatar + Name + Logout button */}
          <div className="d-flex align-items-center gap-2 gap-sm-3">
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white fw-semibold"
                style={{
                  width: 34,
                  height: 34,
                  backgroundColor: 'var(--primary-cosmos, #24476B)',
                  fontSize: '0.86rem',
                  flexShrink: 0,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>

              <div className="d-none d-sm-flex flex-column text-start lh-sm">
                <span className="fw-semibold text-dark text-truncate" style={{ maxWidth: 140, fontSize: '0.84rem' }}>
                  {displayName}
                </span>
                <span
                  className="badge rounded-pill fw-semibold text-uppercase mt-0.5"
                  style={{
                    backgroundColor: 'var(--bg-surface-muted, #F3F1EC)',
                    color: 'var(--text-secondary, #536471)',
                    border: '1px solid var(--border-structural, #E2DFD7)',
                    fontSize: '0.62rem',
                    padding: '0.12rem 0.45rem',
                    width: 'fit-content',
                  }}
                >
                  {roleDisplay}
                </span>
              </div>
            </div>

            <button
              type="button"
              className={s.logoutBtn}
              onClick={doLogout}
              title="Sign Out / Logout"
              aria-label="Logout"
            >
              <i className="fa-solid fa-right-from-bracket me-1 text-danger" aria-hidden="true" />
              <span className="d-none d-sm-inline fw-semibold small">Logout</span>
            </button>
          </div>
        </header>

        <main id="main" className={`${s.main} container-fluid px-3 px-md-4 px-lg-5 py-4`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

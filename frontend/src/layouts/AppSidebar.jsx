import React from 'react';
import { NavLink } from 'react-router-dom';
import { Offcanvas } from 'react-bootstrap';
import s from './Layout.module.css';
import Logo from '../components/common/Logo.jsx';

export const STUDENT_NAV = [
  [
    'mission',
    [
      ['dashboard', 'fa-gauge-high', '/student/dashboard', 'Dashboard'],
      ['catalog', 'fa-graduation-cap', '/student/catalog', 'Course Catalog'],
    ],
  ],
  [
    'academics',
    [
      ['applications', 'fa-file-signature', '/student/applications', 'My Applications'],
      ['enrollments', 'fa-user-check', '/student/enrollments', 'Enrollments'],
      ['attendance', 'fa-clipboard-user', '/student/attendance', 'Attendance'],
      ['training', 'fa-laptop-code', '/student/training', 'Training Hub'],
      ['assessments', 'fa-file-pen', '/student/assessments', 'Assessments'],
      ['certificates', 'fa-award', '/student/certificates', 'Certificates'],
      ['evaluation', 'fa-star', '/student/evaluation', 'Evaluations'],
    ],
  ],
  [
    'billing',
    [
      ['payments', 'fa-credit-card', '/student/payments', 'Invoices & Payments'],
      ['media', 'fa-photo-film', '/student/media', 'Training Media'],
    ],
  ],
  [
    'account',
    [
      ['notifications', 'fa-bell', '/student/notifications', 'Notifications'],
      ['profile', 'fa-user-gear', '/student/profile', 'Profile'],
    ],
  ],
];

export const INSTRUCTOR_NAV = [
  [
    'mission',
    [
      ['dashboard', 'fa-gauge-high', '/instructor/dashboard', 'Mission Control'],
      ['courses', 'fa-book-open', '/instructor/courses', 'Courses'],
      ['cohorts', 'fa-users-rectangle', '/instructor/cohorts', 'Cohorts'],
      ['sessions', 'fa-calendar-days', '/instructor/sessions', 'Sessions'],
    ],
  ],
  [
    'learners',
    [
      ['students', 'fa-user-graduate', '/instructor/students', 'Students'],
      ['messages', 'fa-comments', '/instructor/messages', 'Messages'],
      ['attendance', 'fa-clipboard-user', '/instructor/attendance', 'Attendance'],
      ['progress', 'fa-chart-line', '/instructor/progress', 'Progress'],
    ],
  ],
  [
    'assessment',
    [
      ['assessments', 'fa-file-pen', '/instructor/assessments', 'Assessments'],
      ['submissions', 'fa-inbox', '/instructor/submissions', 'Submissions'],
      ['gradebook', 'fa-book-bookmark', '/instructor/gradebook', 'Gradebook'],
    ],
  ],
  [
    'account',
    [
      ['notifications', 'fa-bell', '/instructor/notifications', 'Notifications'],
      ['profile', 'fa-id-badge', '/instructor/profile', 'Profile'],
    ],
  ],
];

export const ADMIN_NAV = [
  [
    'command',
    [
      ['gateway', 'fa-door-open', '/admin', 'Division Gateway'],
      ['strategic', 'fa-satellite-dish', '/admin/super', 'Strategic Cockpit'],
      ['dashboard', 'fa-gauge-high', '/admin/dashboard', 'Dashboard'],
    ],
  ],
  [
    'academics',
    [
      ['programs', 'fa-graduation-cap', '/admin/programs', 'Programs'],
      ['cohorts', 'fa-users-rectangle', '/admin/cohorts', 'Cohorts'],
      ['applications', 'fa-file-signature', '/admin/applications', 'Applications'],
      ['readiness', 'fa-clipboard-check', '/admin/readiness', 'Readiness Oversight'],
      ['students', 'fa-user-graduate', '/admin/students', 'Student Directory'],
    ],
  ],
  [
    'operations',
    [
      ['attendance', 'fa-clipboard-user', '/admin/attendance', 'Attendance'],
      ['assessments', 'fa-file-pen', '/admin/assessments', 'Assessments'],
      ['certificates', 'fa-award', '/admin/certificates', 'Certificates'],
      ['payments', 'fa-credit-card', '/admin/payments', 'Finance & Payments'],
      ['media', 'fa-photo-film', '/admin/media', 'Media Assets'],
    ],
  ],
  [
    'divisions',
    [
      ['pre_uni', 'fa-school', '/admin/division/pre_university', 'Pre-University'],
      ['uni', 'fa-building-columns', '/admin/division/university', 'University'],
    ],
  ],
];

export function Brand({ size = 56, role = 'student', portalIndicator }) {
  const roleLabel =
    portalIndicator ||
    (role === 'instructor'
      ? 'Instructor Portal'
      : role === 'admin'
      ? 'Admin Mission Control'
      : 'Student Academy');

  return (
    <div className={s.brand}>
      <Logo size={size} />
      <div className={s.brandText}>
        <div className={s.brandName}>Egyptian Space Agency</div>
        <div className={s.brandSub}>{roleLabel}</div>
      </div>
    </div>
  );
}

export function NavList({ navGroups, notifUnread = 0, msgUnread = 0, onNavigate }) {
  return (
    <ul className={s.nav}>
      {navGroups.map(([group, items]) => (
        <li key={group} style={{ listStyle: 'none' }}>
          <div className={s.group} role="presentation">
            {group.toUpperCase()}
          </div>
          <ul className="list-unstyled m-0 d-flex flex-column gap-1">
            {items.map(([key, icon, path, label]) => (
              <li key={key}>
                <NavLink
                  to={path}
                  onClick={onNavigate}
                  title={label}
                  className={({ isActive }) => `${s.link} ${isActive ? s.active : ''}`}
                >
                  <i className={`fa-solid ${icon}`} aria-hidden="true" />
                  <span className={s.label}>{label}</span>
                  {key === 'notifications' && notifUnread > 0 && (
                    <span className={s.badgeDot} aria-label={`${notifUnread} unread`}>
                      {notifUnread}
                    </span>
                  )}
                  {key === 'messages' && msgUnread > 0 && (
                    <span className={s.badgeDot} aria-label={`${msgUnread} unread`}>
                      {msgUnread}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default function AppSidebar({
  activeRole,
  navGroups,
  collapsed,
  toggleSidebar,
  mobileOpen,
  setMobileOpen,
  unreadNotif = 0,
  unreadMessages = 0,
  displayName,
  roleDisplay,
  portalIndicator,
  lang,
  setLang,
}) {
  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className={s.sidebar} aria-label="Primary Navigation">
        <Brand size={collapsed ? 40 : 54} role={activeRole} portalIndicator={portalIndicator} />
        <NavList
          navGroups={navGroups}
          notifUnread={unreadNotif}
          msgUnread={unreadMessages}
          onNavigate={() => {}}
        />

        {lang && setLang && !collapsed && (
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top" style={{ borderColor: 'var(--border-structural, #E2DFD7)' }}>
            <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary, #536471)' }}>Interface Lang</span>
            <button
              type="button"
              className="btn btn-sm text-uppercase mono py-0 px-2"
              style={{
                fontSize: '0.66rem',
                borderRadius: 'var(--radius-badge, 4px)',
                borderColor: 'var(--border-structural, #E2DFD7)',
                color: 'var(--text-ink-primary, #151D24)',
                backgroundColor: 'var(--bg-surface-muted, #F3F1EC)',
                border: '1px solid var(--border-structural, #E2DFD7)',
              }}
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              title="Switch Language"
            >
              <i className="fa-solid fa-globe me-1 text-muted" />
              {lang === 'ar' ? 'English' : 'عربي'}
            </button>
          </div>
        )}

        <div className={s.sideFoot}>
          <div className={s.who}>
            <div className="fw-semibold text-truncate" style={{ fontSize: '0.82rem', color: 'var(--text-ink-primary, #151D24)' }}>
              {displayName}
            </div>
            <div className="text-uppercase mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary, #536471)' }}>
              {roleDisplay}
            </div>
          </div>
          <button
            type="button"
            className={s.collapseBtn}
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i
              className={`fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </aside>

      {/* 2. Responsive Offcanvas Drawer (< 992px) for Tablet and Mobile */}
      <Offcanvas
        show={mobileOpen}
        onHide={() => setMobileOpen(false)}
        placement="start"
        className={`d-lg-none ${s.offcanvasDrawer}`}
      >
        <Offcanvas.Header closeButton className="border-bottom px-3 py-3" style={{ borderColor: 'var(--border-structural, #E2DFD7)' }}>
          <Brand size={44} role={activeRole} portalIndicator={portalIndicator} />
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0 overflow-auto d-flex flex-column justify-content-between">
          <NavList
            navGroups={navGroups}
            notifUnread={unreadNotif}
            msgUnread={unreadMessages}
            onNavigate={() => setMobileOpen(false)}
          />

          {lang && setLang && (
            <div className="p-3 border-top d-flex align-items-center justify-content-between mt-auto" style={{ borderColor: 'var(--border-structural, #E2DFD7)' }}>
              <span className="small" style={{ color: 'var(--text-secondary, #536471)' }}>Language / اللغة</span>
              <button
                type="button"
                className="btn btn-sm text-uppercase mono py-1 px-3"
                style={{
                  fontSize: '0.72rem',
                  borderRadius: 'var(--radius-badge, 4px)',
                  borderColor: 'var(--border-structural, #E2DFD7)',
                  backgroundColor: 'var(--bg-surface-muted, #F3F1EC)',
                  color: 'var(--text-ink-primary, #151D24)',
                  border: '1px solid var(--border-structural, #E2DFD7)',
                }}
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              >
                <i className="fa-solid fa-globe me-1 text-muted" />
                {lang === 'ar' ? 'English' : 'عربي'}
              </button>
            </div>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}


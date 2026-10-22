import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Egyptian Space Agency — Student Dashboard Quick Actions
 * Ensures the 4 core institutional operational shortcuts are prominent:
 * 1. /student/catalog
 * 2. /student/training
 * 3. /student/payments
 * 4. /student/profile
 */
export default function QuickActions({
  hasActiveEnrollment = false,
  hasActiveApplication = false,
  hasPendingPayment = false,
  hasPendingReadiness = false,
  currentApplicationId,
  readinessCourseId,
}) {
  const coreActions = [
    {
      id: 'catalog',
      title: 'Course Catalog',
      subtitle: 'Academic Curriculum',
      description: 'Explore EgSA aerospace, satellite & space robotics courses',
      icon: 'fa-graduation-cap',
      link: '/student/catalog',
      accentColor: '#1E7C85',
      badge: null,
    },
    {
      id: 'training',
      title: 'Academic Training Hub',
      subtitle: 'Syllabus & Lab Center',
      description: 'Access active coursework, session agendas & materials',
      icon: 'fa-laptop-code',
      link: '/student/training',
      accentColor: '#3A6985',
      badge: hasActiveEnrollment ? 'Enrolled' : null,
      badgeVariant: 'primary',
    },
    {
      id: 'payments',
      title: 'Tuition & Invoicing',
      subtitle: 'Commercial Logistics',
      description: 'Review invoices, 72h seat reservations & receipts',
      icon: 'fa-credit-card',
      link: '/student/payments',
      accentColor: '#D4B87C',
      badge: hasPendingPayment ? 'Action Required' : null,
      badgeVariant: 'warning',
    },
    {
      id: 'profile',
      title: 'Student Academic Profile',
      subtitle: 'Credentials & ID Hub',
      description: 'National ID, university degree & space experience',
      icon: 'fa-id-card',
      link: '/student/profile',
      accentColor: '#1E7C85',
      badge: null,
    },
  ];

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="quick-actions-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-bolt-lightning text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Portal Navigation</span>
            <h2 id="quick-actions-heading" className="card-heading-title">Quick Operational Actions</h2>
          </div>
        </div>
      </div>

      {/* Urgent Diagnostic Alert if applicable */}
      {hasPendingReadiness && (
        <Link
          to={readinessCourseId ? `/student/apply/${readinessCourseId}` : '/student/catalog'}
          className="p-3 mb-3 rounded border text-decoration-none d-flex align-items-center justify-content-between gap-3 text-dark shadow-sm"
          style={{
            borderColor: '#D4B87C',
            backgroundColor: 'rgba(212, 184, 124, 0.12)',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                backgroundColor: '#D4B87C',
                color: '#000000',
              }}
            >
              <i className="fa-solid fa-list-check"></i>
            </div>
            <div>
              <div className="fw-bold text-dark" style={{ fontSize: '0.86rem' }}>
                Pending Readiness Assessment
              </div>
              <p className="text-muted small mb-0" style={{ fontSize: '0.74rem' }}>
                Technical diagnostic evaluation required for admissions qualification
              </p>
            </div>
          </div>
          <span className="badge rounded-pill bg-warning text-dark fw-bold" style={{ fontSize: '0.7rem' }}>
            Complete Pending Assessment &rarr;
          </span>
        </Link>
      )}

      {/* 4 Core Institutional Shortcut Cards */}
      <div className="d-flex flex-column gap-2">
        {coreActions.map((act) => (
          <Link
            key={act.id}
            to={act.link}
            className="p-3 rounded border text-decoration-none d-flex align-items-center justify-content-between gap-3 bg-white text-dark shadow-sm transition-all"
            style={{
              borderColor: act.badge === 'Action Required' ? '#DF4F4C' : '#CBD5E1',
              backgroundColor: act.badge === 'Action Required' ? 'rgba(223, 79, 76, 0.04)' : '#FFFFFF',
              transition: 'all 0.18s ease-in-out',
            }}
            title={act.title}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: `${act.accentColor}18`,
                  color: act.accentColor,
                  fontSize: '1.1rem',
                  border: `1px solid ${act.accentColor}33`,
                }}
              >
                <i className={`fa-solid ${act.icon}`}></i>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold text-dark" style={{ fontSize: '0.88rem' }}>
                    {act.title}
                  </span>
                  {act.badge && (
                    <span
                      className="badge rounded-pill fw-bold"
                      style={{
                        backgroundColor: act.badge === 'Action Required' ? '#DF4F4C' : '#1E7C85',
                        color: '#FFFFFF',
                        fontSize: '0.62rem',
                      }}
                    >
                      {act.badge}
                    </span>
                  )}
                </div>
                <p className="text-muted small mb-0 lh-sm" style={{ fontSize: '0.75rem' }}>
                  {act.description}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 text-muted small">
              <i className="fa-solid fa-chevron-right" style={{ color: '#94A3B8' }}></i>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

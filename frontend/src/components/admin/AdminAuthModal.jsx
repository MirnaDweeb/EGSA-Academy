import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import styles from './AdminAuthModal.module.css';

const DIVISION_CONFIG = {
  UNIVERSITY: {
    key: 'UNIVERSITY',
    name: 'University Academic Division',
    arabicName: 'كليات الهندسة والعلوم',
    headerTitle: 'Egyptian Space Agency — University Governance Authentication',
    badgeClass: styles.badgeUniversity,
    scopeBannerClass: styles.scopeBannerUniversity,
    submitBtnClass: styles.submitBtnUniversity,
    icon: 'fa-graduation-cap',
    demoUser: {
      name: 'Sara Mostafa',
      title: 'University Academic Administrator',
      email: 'sara.univadmin@egsa.gov.eg',
      password: 'Password123!',
    },
    redirectPath: '/admin/dashboard',
  },
  PRE_UNIVERSITY: {
    key: 'PRE_UNIVERSITY',
    name: 'Pre-University & STEM Cadets',
    arabicName: 'مدارس المتفوقين وطلائع الفضاء',
    headerTitle: 'Egyptian Space Agency — STEM Cadets Governance Authentication',
    badgeClass: styles.badgePreUniversity,
    scopeBannerClass: styles.scopeBannerPreUniversity,
    submitBtnClass: styles.submitBtnPreUniversity,
    icon: 'fa-school',
    demoUser: {
      name: 'Eng. Noha Farouk',
      title: 'Pre-University & STEM Administrator',
      email: 'noha.preunivadmin@egsa.gov.eg',
      password: 'Password123!',
    },
    redirectPath: '/admin/dashboard',
  },
  SUPER_ADMIN: {
    key: 'SUPER_ADMIN',
    name: 'Platform Super Administration',
    arabicName: 'القيادة المركزية والرقابة العامة',
    headerTitle: 'Egyptian Space Agency — Central Command & Super Administration',
    badgeClass: styles.badgeSuperAdmin,
    scopeBannerClass: styles.scopeBannerSuperAdmin,
    submitBtnClass: styles.submitBtnSuperAdmin,
    icon: 'fa-shield-halved',
    demoUser: {
      name: 'Eng. Ayman Ahmed',
      title: 'Platform Super Administrator',
      email: 'ayman.superadmin@egsa.gov.eg',
      password: 'Password123!',
    },
    redirectPath: '/admin/super',
  },
};

export default function AdminAuthModal({
  isOpen,
  onClose,
  targetDivision = 'UNIVERSITY',
}) {
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const toast = useToast();

  const config = DIVISION_CONFIG[targetDivision] || DIVISION_CONFIG.UNIVERSITY;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const emailInputRef = useRef(null);

  // Initialize or reset when modal opens or target division changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setLoading(false);
      setShowPassword(false);
      // Pre-fill demo credentials matching the selected target division for convenience
      if (config.demoUser) {
        setEmail(config.demoUser.email);
        setPassword(config.demoUser.password);
      }
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, targetDivision]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleQuickFill = (demoData) => {
    setEmail(demoData.email);
    setPassword(demoData.password);
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please provide both administrative email and password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate credentials via login
      const authenticatedUser = await login(cleanEmail, password);

      if (!authenticatedUser) {
        throw new Error('Authentication returned an invalid user session.');
      }

      const roleUpper = (authenticatedUser.role || '').toUpperCase();
      const isSuperAdmin = roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN';
      const isAdminRole = isSuperAdmin || roleUpper.includes('ADMIN');

      // 2. Validate role is administrative
      if (!isAdminRole) {
        if (logout) await logout();
        setErrorMessage(
          'Access Denied: This account lacks administrative credentials. Cadet or instructor accounts cannot access academic governance.'
        );
        setLoading(false);
        return;
      }

      // 3. Validate division match or SUPER_ADMIN authorization
      const userDivision = (authenticatedUser.division || '').toUpperCase();

      if (targetDivision === 'UNIVERSITY') {
        if (!isSuperAdmin && userDivision !== 'UNIVERSITY') {
          if (logout) await logout();
          setErrorMessage(
            'Access Restricted: This administrator account is assigned to the Pre-University Division. Please authenticate via the STEM Portal or use University credentials.'
          );
          setLoading(false);
          return;
        }
      } else if (targetDivision === 'PRE_UNIVERSITY') {
        if (!isSuperAdmin && userDivision !== 'PRE_UNIVERSITY') {
          if (logout) await logout();
          setErrorMessage(
            'Access Restricted: This administrator account is assigned to the University Academic Division. Please authenticate via the University Portal or use STEM credentials.'
          );
          setLoading(false);
          return;
        }
      } else if (targetDivision === 'SUPER_ADMIN') {
        if (!isSuperAdmin) {
          if (logout) await logout();
          setErrorMessage(
            'Access Restricted: Platform Super Administrator privilege is required to access the Central Console.'
          );
          setLoading(false);
          return;
        }
      }

      // 4. Apply division scope to localStorage for consistent telemetry & filter scoping
      const activeScope =
        targetDivision === 'SUPER_ADMIN'
          ? 'ALL'
          : targetDivision;

      localStorage.setItem('admin_active_division', activeScope);
      localStorage.setItem('egsa_active_division', activeScope);

      // 5. Success feedback & redirection
      toast.success(
        `Session authenticated for ${config.name}. Welcome, ${authenticatedUser.fullName || 'Administrator'}!`
      );

      onClose();

      // Immediate scoped routing
      navigate(config.redirectPath, { replace: true });
    } catch (err) {
      console.error('[AdminAuthModal] Authentication error:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please verify your administrative credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-modal-title"
    >
      <div className={styles.modalDialog}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTop}>
            <div className={styles.emblemWrap}>
              <img
                src="/esa-logo.png"
                alt="Egyptian Space Agency Official Emblem"
                className={styles.agencyEmblem}
              />
              <div className={styles.titleArea}>
                <span className={styles.agencyLabel}>
                  Egyptian Space Agency • Academic Authority
                </span>
                <h2 id="admin-auth-modal-title" className={styles.modalTitle}>
                  {config.headerTitle}
                </h2>
              </div>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              disabled={loading}
              aria-label="Close authentication modal"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>

          {/* Division Scope Indicator */}
          <div className={`${styles.scopeBanner} ${config.scopeBannerClass}`}>
            <span className={`${styles.scopeBadge} ${config.badgeClass}`}>
              <i className={`fa-solid ${config.icon}`} aria-hidden="true" />
              {config.name}
            </span>
            <span>{config.arabicName}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Inline Error Alert Box */}
          {errorMessage && (
            <div
              className={styles.inlineAlert}
              role="alert"
              id="admin-auth-inline-error"
            >
              <i
                className={`fa-solid fa-triangle-exclamation ${styles.alertIcon}`}
                aria-hidden="true"
              />
              <div>
                <strong>Authentication Alert:</strong>
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Quick-Fill Demo Helper */}
          {config.demoUser && (
            <div className={styles.quickFillSection}>
              <div className={styles.quickFillHeader}>
                <span className={styles.quickFillLabel}>
                  <i className="fa-solid fa-bolt text-warning" aria-hidden="true" />
                  Demo Verification Credentials
                </span>
                <span className="text-muted small">One-Click Test</span>
              </div>
              <button
                type="button"
                id="btn-admin-auth-quickfill"
                className={styles.quickFillBtn}
                onClick={() => handleQuickFill(config.demoUser)}
                disabled={loading}
              >
                <span>
                  <strong>{config.demoUser.name}</strong> ({config.demoUser.email})
                </span>
                <span className={styles.quickFillRole}>{config.demoUser.title}</span>
              </button>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label htmlFor="admin-auth-email" className={styles.label}>
                Administrative Email Address
              </label>
              <div className={styles.inputWrap}>
                <i
                  className={`fa-solid fa-envelope ${styles.inputIcon}`}
                  aria-hidden="true"
                />
                <input
                  ref={emailInputRef}
                  id="admin-auth-email"
                  type="email"
                  className={styles.inputField}
                  placeholder="admin.name@egsa.gov.eg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="admin-auth-password" className={styles.label}>
                Secure Access Password
              </label>
              <div className={styles.inputWrap}>
                <i
                  className={`fa-solid fa-lock ${styles.inputIcon}`}
                  aria-hidden="true"
                />
                <input
                  id="admin-auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.inputField}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles.togglePassBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <i
                    className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            <div className={styles.securityNotice}>
              <i className="fa-solid fa-lock text-muted" aria-hidden="true" />
              <span>Encrypted administrative session</span>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-admin-auth-submit"
                className={`${styles.submitBtn} ${config.submitBtnClass}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-key" aria-hidden="true" />
                    <span>Authenticate & Enter</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authTranslations } from '../../utils/authTranslations.js';

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  division: 'UNIVERSITY', // 'UNIVERSITY' or 'PRE_UNIVERSITY'
  password: '',
  confirmPassword: '',
  university: '',
  faculty: '',
  graduationYear: '',
  agreeToTerms: true,
};

export default function RegisterPage() {
  const { register, language = 'en', isRTL = false } = useAuth();
  const t = authTranslations[language] || authTranslations.en;
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError('');
  };

  const setDivision = (div) => {
    setForm((f) => ({ ...f, division: div }));
    if (error) setError('');
  };

  // Password Strength Evaluation
  const passwordStrength = useMemo(() => {
    const p = form.password || '';
    if (!p) return { score: 0, label: '', color: '#CBD5E1', pct: 0 };
    let score = 0;
    if (p.length >= 8) score += 1;
    if (p.length >= 10) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;

    if (score <= 1) {
      return { score: 1, label: 'Weak (min 8 chars needed)', color: '#DF4F4C', pct: 25 };
    }
    if (score === 2 || score === 3) {
      return { score: 2, label: 'Fair (add upper/numbers)', color: '#D4B87C', pct: 50 };
    }
    if (score === 4) {
      return { score: 3, label: 'Good (add special symbol)', color: '#3A6985', pct: 75 };
    }
    return { score: 4, label: 'Strong Security', color: '#1E7C85', pct: 100 };
  }, [form.password]);

  // Password match status
  const passwordsMatch = useMemo(() => {
    if (!form.confirmPassword) return null;
    return form.password === form.confirmPassword;
  }, [form.password, form.confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim()) {
      setError('Please enter your full official name (min 3 characters).');
      return;
    }
    if (form.fullName.trim().length < 3) {
      setError('Full name must be at least 3 characters.');
      return;
    }
    if (!form.email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!form.password) {
      setError('Password is required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.agreeToTerms) {
      setError('You must accept the EGSA Academy terms and academic regulations.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        division: form.division,
        phone: form.phone.trim(),
        university: form.university.trim(),
        faculty: form.faculty.trim(),
        graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        agreeToTerms: true,
      };

      await register(payload);

      // Do NOT auto-login. Prompt student with high-contrast success notification and redirect to /login
      setSuccessModal(true);
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            email: form.email.trim().toLowerCase(),
            successMessage: 'Account created successfully! Please sign in with your credentials to continue.',
          },
        });
      }, 2500);
    } catch (err) {
      const msg =
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please verify your details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t.registerTitle || 'Create Cadet Account'}
      sub={t.registerSub || 'Official Egyptian Space Agency Space Academy Enrollment'}
    >
      <div style={{ maxWidth: '500px', width: '100%', margin: '0 auto' }}>
        {/* Success Modal / Card */}
        {successModal ? (
          <div
            className="p-4 rounded-3 text-center shadow-lg my-3"
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid #1E7C85',
              boxShadow: '0 10px 25px rgba(30, 124, 133, 0.2)',
            }}
          >
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
              style={{ width: '68px', height: '68px', backgroundColor: '#1E7C85' }}
            >
              <i className="fa-solid fa-circle-check fs-2"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">Account Created Successfully!</h4>
            <p className="text-muted small mb-4">
              Your official Space Academy profile has been provisioned. Please sign in with your credentials to continue.
            </p>
            <button
              type="button"
              className="btn text-white px-4 py-2 w-100 fw-bold shadow-sm"
              style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
              onClick={() => {
                navigate('/login', {
                  replace: true,
                  state: {
                    email: form.email.trim().toLowerCase(),
                    successMessage: 'Account created successfully! Please sign in with your credentials to continue.',
                  },
                });
              }}
            >
              <i className="fa-solid fa-arrow-right-to-bracket me-2"></i> Proceed to Login
            </button>
            <div className="mt-3 text-muted small">
              <i className="fa-solid fa-clock me-1"></i> Redirecting automatically in 2 seconds…
            </div>
          </div>
        ) : (
          <>
            {/* Error Banner - Red-Coral floating alert */}
            {error && (
              <div
                className="alert d-flex align-items-center mb-3 py-2 px-3 shadow-sm"
                role="alert"
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #DF4F4C',
                  color: '#991B1B',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <i className="fa-solid fa-circle-exclamation me-2 flex-shrink-0" style={{ color: '#DF4F4C', fontSize: '1rem' }} />
                <div className="fw-medium">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
          {/* Division Selector: High-Contrast Segmented Toggle */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-dark mb-1 d-flex justify-content-between align-items-center">
              <span>Select Academic Division <span className="text-danger">*</span></span>
              <span className="badge text-uppercase" style={{ backgroundColor: '#EEF2F6', color: '#1E7C85', fontSize: '0.7rem' }}>
                {form.division === 'PRE_UNIVERSITY' ? 'School Track' : 'University Track'}
              </span>
            </label>

            <div className="row g-2">
              <div className="col-6">
                <button
                  type="button"
                  onClick={() => setDivision('UNIVERSITY')}
                  className="w-100 p-2.5 text-start border rounded-3 transition-all"
                  style={{
                    backgroundColor: form.division === 'UNIVERSITY' ? '#1E7C85' : '#FFFFFF',
                    borderColor: form.division === 'UNIVERSITY' ? '#1E7C85' : '#CBD5E1',
                    color: form.division === 'UNIVERSITY' ? '#FFFFFF' : '#334155',
                    cursor: 'pointer',
                    boxShadow: form.division === 'UNIVERSITY' ? '0 3px 8px rgba(30,124,133,0.25)' : 'none',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="fw-bold small d-flex align-items-center gap-1.5">
                      <i className="fa-solid fa-graduation-cap"></i>
                      University Student
                    </span>
                    {form.division === 'UNIVERSITY' && (
                      <i className="fa-solid fa-circle-check text-white small"></i>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: form.division === 'UNIVERSITY' ? '#E2E8F0' : '#64748B',
                      lineHeight: '1.2',
                    }}
                  >
                    Engineering, Science, & Senior Undergrads
                  </div>
                </button>
              </div>

              <div className="col-6">
                <button
                  type="button"
                  onClick={() => setDivision('PRE_UNIVERSITY')}
                  className="w-100 p-2.5 text-start border rounded-3 transition-all"
                  style={{
                    backgroundColor: form.division === 'PRE_UNIVERSITY' ? '#3A6985' : '#FFFFFF',
                    borderColor: form.division === 'PRE_UNIVERSITY' ? '#3A6985' : '#CBD5E1',
                    color: form.division === 'PRE_UNIVERSITY' ? '#FFFFFF' : '#334155',
                    cursor: 'pointer',
                    boxShadow: form.division === 'PRE_UNIVERSITY' ? '0 3px 8px rgba(58,105,133,0.25)' : 'none',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="fw-bold small d-flex align-items-center gap-1.5">
                      <i className="fa-solid fa-rocket"></i>
                      Pre-University Cadet
                    </span>
                    {form.division === 'PRE_UNIVERSITY' && (
                      <i className="fa-solid fa-circle-check text-white small"></i>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: form.division === 'PRE_UNIVERSITY' ? '#E2E8F0' : '#64748B',
                      lineHeight: '1.2',
                    }}
                  >
                    STEM Schools, High School & Secondary
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div className="mb-2.5">
            <label className="form-label small fw-semibold text-dark mb-1" htmlFor="reg-fullName">
              Full Official Name <span className="text-danger">*</span>
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderColor: '#CBD5E1' }}>
                <i className="fa-regular fa-user" />
              </span>
              <input
                id="reg-fullName"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="e.g. Youssef Mohamed Hassan"
                value={form.fullName}
                onChange={update('fullName')}
                required
                style={{ borderColor: '#CBD5E1' }}
              />
            </div>
          </div>

          {/* Email Address & Phone Number */}
          <div className="row g-2 mb-2.5">
            <div className="col-md-7">
              <label className="form-label small fw-semibold text-dark mb-1" htmlFor="reg-email">
                Email Address <span className="text-danger">*</span>
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderColor: '#CBD5E1' }}>
                  <i className="fa-regular fa-envelope" />
                </span>
                <input
                  id="reg-email"
                  type="email"
                  className="form-control form-control-sm border-start-0"
                  placeholder="cadet@egsa.gov.eg"
                  value={form.email}
                  onChange={update('email')}
                  required
                  style={{ borderColor: '#CBD5E1' }}
                />
              </div>
            </div>

            <div className="col-md-5">
              <label className="form-label small fw-semibold text-dark mb-1" htmlFor="reg-phone">
                Phone Number
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderColor: '#CBD5E1' }}>
                  <i className="fa-solid fa-phone" />
                </span>
                <input
                  id="reg-phone"
                  type="tel"
                  className="form-control form-control-sm border-start-0"
                  placeholder="+20 10..."
                  value={form.phone}
                  onChange={update('phone')}
                  style={{ borderColor: '#CBD5E1' }}
                />
              </div>
            </div>
          </div>

          {/* Password with Strength Indicator */}
          <div className="mb-2.5">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label small fw-semibold text-dark mb-0" htmlFor="reg-password">
                Password <span className="text-danger">*</span>
              </label>
              {passwordStrength.label && (
                <span className="small fw-semibold" style={{ color: passwordStrength.color, fontSize: '0.72rem' }}>
                  {passwordStrength.label}
                </span>
              )}
            </div>

            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderColor: '#CBD5E1' }}>
                <i className="fa-solid fa-lock" />
              </span>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control form-control-sm border-start-0 border-end-0"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={update('password')}
                required
                style={{ borderColor: '#CBD5E1' }}
              />
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm bg-white"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                style={{ borderColor: '#CBD5E1', color: '#64748B' }}
              >
                <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>

            {/* Password Strength Visual Meter */}
            {form.password && (
              <div className="progress mt-1.5" style={{ height: '4px', backgroundColor: '#E2E8F0' }}>
                <div
                  className="progress-bar transition-all"
                  role="progressbar"
                  style={{
                    width: `${passwordStrength.pct}%`,
                    backgroundColor: passwordStrength.color,
                  }}
                  aria-valuenow={passwordStrength.pct}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
            )}
          </div>

          {/* Confirm Password with Real-Time Match Confirmation */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label small fw-semibold text-dark mb-0" htmlFor="reg-confirmPassword">
                Confirm Password <span className="text-danger">*</span>
              </label>
              {passwordsMatch !== null && (
                <span
                  className="small fw-semibold d-flex align-items-center gap-1"
                  style={{
                    color: passwordsMatch ? '#1E7C85' : '#DF4F4C',
                    fontSize: '0.72rem',
                  }}
                >
                  <i className={`fa-solid ${passwordsMatch ? 'fa-check-circle' : 'fa-times-circle'}`} />
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </span>
              )}
            </div>

            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderColor: '#CBD5E1' }}>
                <i className="fa-solid fa-shield-halved" />
              </span>
              <input
                id="reg-confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                className="form-control form-control-sm border-start-0 border-end-0"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                required
                style={{
                  borderColor: passwordsMatch === false ? '#DF4F4C' : '#CBD5E1',
                }}
              />
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm bg-white"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex="-1"
                style={{ borderColor: '#CBD5E1', color: '#64748B' }}
              >
                <i className={`fa-regular ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          {/* Academic Affiliation Details (Adaptive by Division) */}
          <div
            className="p-2.5 rounded-3 mb-3 border"
            style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
          >
            <div className="small fw-bold text-dark mb-2 d-flex align-items-center gap-1.5">
              <i className="fa-solid fa-landmark text-muted"></i>
              <span>{form.division === 'PRE_UNIVERSITY' ? 'School Affiliation (Optional)' : 'University Affiliation (Optional)'}</span>
            </div>

            {form.division === 'PRE_UNIVERSITY' ? (
              <div className="row g-2">
                <div className="col-md-7">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="School / STEM Academy Name"
                    value={form.university}
                    onChange={update('university')}
                    style={{ borderColor: '#CBD5E1' }}
                  />
                </div>
                <div className="col-md-5">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Grade (e.g. Grade 11)"
                    value={form.faculty}
                    onChange={update('faculty')}
                    style={{ borderColor: '#CBD5E1' }}
                  />
                </div>
              </div>
            ) : (
              <div className="row g-2">
                <div className="col-md-5">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="University (e.g. Cairo Univ)"
                    value={form.university}
                    onChange={update('university')}
                    style={{ borderColor: '#CBD5E1' }}
                  />
                </div>
                <div className="col-md-4">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Faculty (e.g. Engineering)"
                    value={form.faculty}
                    onChange={update('faculty')}
                    style={{ borderColor: '#CBD5E1' }}
                  />
                </div>
                <div className="col-md-3">
                  <input
                    type="number"
                    min="2020"
                    max="2035"
                    className="form-control form-control-sm"
                    placeholder="Grad Year"
                    value={form.graduationYear}
                    onChange={update('graduationYear')}
                    style={{ borderColor: '#CBD5E1' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Terms Agreement Checkbox */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              id="agreeTerms"
              className="form-check-input"
              checked={form.agreeToTerms}
              onChange={update('agreeToTerms')}
              style={{ cursor: 'pointer' }}
            />
            <label className="form-check-label small text-muted" htmlFor="agreeTerms" style={{ cursor: 'pointer', fontSize: '0.78rem' }}>
              I agree to the Egyptian Space Agency Space Academy Terms of Service & Privacy Policy.
            </label>
          </div>

          {/* Action Button: Solid Deep Teal-Green with spinner */}
          <button
            type="submit"
            disabled={loading}
            className="btn w-100 py-2.5 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2"
            style={{
              backgroundColor: '#1E7C85',
              borderColor: '#1E7C85',
              borderRadius: '8px',
              transition: 'background-color 200ms ease',
            }}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Creating Cadet Account…</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-user-plus" />
                <span>Complete Registration & Launch</span>
              </>
            )}
          </button>

          {/* Navigation to Login */}
          <div className="text-center mt-3 pt-2 border-top" style={{ borderColor: '#E2E8F0' }}>
            <span className="small text-muted me-1">Already registered as an EgSA cadet?</span>
            <Link to="/login" className="small fw-bold text-decoration-none" style={{ color: '#1E7C85' }}>
              Sign In to Mission Portal &rarr;
            </Link>
          </div>
        </form>
        </>
        )}
      </div>
    </AuthShell>
  );
}

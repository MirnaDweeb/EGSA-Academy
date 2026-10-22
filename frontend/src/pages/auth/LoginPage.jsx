import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import s from './auth.module.css';

export default function LoginPage() {
  const { user, login, lang } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [f, setF] = useState({ email: location.state?.email || '', password: '' });
  const [roleHint, setRoleHint] = useState('all'); // 'all', 'student', 'instructor', 'admin'
  const [successMsg, setSuccessMsg] = useState(location.state?.successMessage || null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  if (user) {
    const role = user.role?.toLowerCase() || '';
    if (role === 'instructor') return <Navigate to="/instructor/dashboard" replace />;
    if (role.includes('admin')) return <Navigate to="/admin/gateway" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  const invalid = !f.email.includes('@') || !f.password;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (busy || invalid) return;
    setBusy(true);
    setErr(null);

    try {
      const loggedUser = await login(f.email.trim(), f.password);
      const role = loggedUser?.role?.toLowerCase() || '';

      const from = location.state?.from?.pathname;
      if (from) {
        nav(from, { replace: true });
      } else if (role === 'instructor') {
        nav('/instructor/dashboard', { replace: true });
      } else if (role.includes('admin')) {
        nav('/admin/gateway', { replace: true });
      } else {
        nav('/student/dashboard', { replace: true });
      }
    } catch (x) {
      setErr(
        x.code === 'NOT_INSTRUCTOR'
          ? 'This account does not have instructor privileges.'
          : x.status === 429
          ? (x.message || 'Too many attempts. Please try again later.')
          : x.status === 401 || x.status === 400
          ? (lang === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.')
          : x.message === 'timeout'
          ? (lang === 'ar' ? 'انتهت مهلة الاتصال بالخادم.' : 'Connection timed out. Please try again.')
          : (x.message || 'Failed to authenticate. Please check your credentials.')
      );
    } finally {
      setBusy(false);
    }
  };

  const titleText = lang === 'ar' ? 'مرحبًا بعودتك' : 'Welcome Back';
  const subText =
    lang === 'ar'
      ? 'سجّل الدخول إلى حسابك في أكاديمية الفضاء.'
      : 'Sign in to access your academy portal.';

  return (
    <AuthShell
      title={titleText}
      sub={subText}
      portalLabel={lang === 'ar' ? 'أكاديمية الفضاء · تسجيل الدخول' : 'Space Academy • Unified Portal'}
    >
      {successMsg && (
        <Alert
          variant="success"
          role="alert"
          className="py-2 px-3 mb-3 small d-flex align-items-center"
          style={{ backgroundColor: '#F0FDF4', borderColor: '#1E7C85', color: '#065F46' }}
        >
          <i className="fa-solid fa-circle-check me-2 flex-shrink-0" style={{ color: '#1E7C85' }} aria-hidden="true" />
          <div className="fw-medium">{successMsg}</div>
        </Alert>
      )}

      {err && (
        <Alert
          variant="danger"
          role="alert"
          className="py-2 px-3 mb-3 small d-flex align-items-center"
        >
          <i className="fa-solid fa-circle-exclamation me-2 flex-shrink-0" aria-hidden="true" />
          <div>{err}</div>
        </Alert>
      )}

      {/* Role Navigation Quick Hints */}
      <div className="d-flex rounded p-1 mb-3 bg-light border" style={{ fontSize: '0.78rem' }}>
        {[
          { key: 'all', label: lang === 'ar' ? 'عام' : 'Unified' },
          { key: 'student', label: lang === 'ar' ? 'طالب' : 'Student' },
          { key: 'instructor', label: lang === 'ar' ? 'مدرب' : 'Instructor' },
          { key: 'admin', label: lang === 'ar' ? 'مسؤول' : 'Admin' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`btn btn-sm flex-fill border-0 ${
              roleHint === item.key ? 'bg-white fw-bold shadow-sm text-dark' : 'text-muted'
            }`}
            onClick={() => {
              setRoleHint(item.key);
              if (item.key === 'student') setF({ email: 'sara.demo@egsa-academy.example', password: 'Password123!' });
              else if (item.key === 'instructor') setF({ email: 'instructor@egsa-academy.example', password: 'InstructorPass123!' });
              else if (item.key === 'admin') setF({ email: 'admin@egsa-academy.example', password: 'AdminPass123!' });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Form onSubmit={submit} noValidate>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label className="small fw-semibold text-secondary mb-1">
            {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
          </Form.Label>
          <div className={s.inputGroupWrap}>
            <i className={`fa-solid fa-envelope ${s.inputIcon}`} aria-hidden="true" />
            <Form.Control
              type="email"
              autoComplete="username"
              placeholder="user@egsa-academy.example"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              isInvalid={touched && !f.email.includes('@')}
              className={s.controlWithIcon}
              required
            />
          </div>
          <Form.Control.Feedback type="invalid">
            {lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Valid email is required'}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="password">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <Form.Label className="small fw-semibold text-secondary mb-0">
              {lang === 'ar' ? 'كلمة المرور' : 'Password'}
            </Form.Label>
            <Link to="/forgot-password" className="small text-muted text-decoration-none">
              {lang === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
            </Link>
          </div>
          <div className={s.inputGroupWrap}>
            <i className={`fa-solid fa-lock ${s.inputIcon}`} aria-hidden="true" />
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              isInvalid={touched && !f.password}
              className={s.controlWithIcon}
              required
            />
            <button
              type="button"
              className={s.togglePassBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
            </button>
          </div>
          <Form.Control.Feedback type="invalid">
            {lang === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Password is required'}
          </Form.Control.Feedback>
        </Form.Group>

        <Button type="submit" className={`btn-egsa ${s.submitBtn} w-100 py-2`} disabled={busy}>
          {busy ? (
            <>
              <Spinner size="sm" className="me-2" />
              <span>{lang === 'ar' ? 'جارٍ التحقق…' : 'Authenticating…'}</span>
            </>
          ) : (
            <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
          )}
        </Button>

        <div className="text-center mt-3 pt-2 border-top">
          <span className="small text-muted me-1">
            {lang === 'ar' ? 'طالب جديد؟' : "Don't have an account?"}
          </span>
          <Link to="/register" className="small fw-semibold text-primary text-decoration-none">
            {lang === 'ar' ? 'إنشاء حساب طالب' : 'Create Student Account'}
          </Link>
        </div>
      </Form>
    </AuthShell>
  );
}

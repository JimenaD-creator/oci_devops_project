import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, login as setAuthenticated } from '../../utils/auth';
import {
  fetchDeveloperPrimaryProject,
  fetchManagerPrimaryProject,
  loginWithCredentials,
} from './loginApi';

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [formError, setFormError]       = useState('');

  const [showForgot, setShowForgot]     = useState(false);
  const [forgotEmail, setForgotEmail]   = useState('');
  const [forgotStatus, setForgotStatus] = useState('idle');

  useEffect(() => {
    document.body.classList.add('login-route');
    return () => document.body.classList.remove('login-route');
  }, []);

  useEffect(() => {
    if (isAuthenticated()) navigate('/', { replace: true });
  }, [navigate]);

  async function completeLogin() {
    setFormError('');
    if (!email.trim() || !password) {
      setFormError('Please enter your email, phone number, or username and password.');
      return;
    }
    setIsLoading(true);
    try {
      const authData = await loginWithCredentials(email.trim(), password.trim());
      const userData = {
        ...authData.user,
        role: (authData.user.role || 'DEVELOPER').toUpperCase(),
      };
      setAuthenticated({ token: authData.token, user: userData }, rememberMe);

      if (userData.role === 'ADMIN') {
        navigate('/project-selector');
      } else if (userData.role === 'MANAGER') {
        try {
          const project = await fetchManagerPrimaryProject(userData.id);
          if (project) {
            localStorage.setItem('currentProjectId', String(project.id));
            localStorage.setItem('currentProjectName', project.name);
          }
        } catch { console.error('Could not pre-load the manager project'); }
        navigate('/');
      } else if (userData.role === 'DEVELOPER') {
        try {
          const project = await fetchDeveloperPrimaryProject(userData.id);
          if (project) {
            localStorage.setItem('currentProjectId', String(project.id));
            localStorage.setItem('currentProjectName', project.name);
          }
        } catch { console.error('Could not pre-load the developer project'); }
        navigate('/');
      }
    } catch (err) {
      setFormError(
        !err.status
          ? 'Could not connect to the server.'
          : 'Invalid credentials. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  const handleSignIn = (e) => {
    e.preventDefault();
    completeLogin();
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotStatus('loading');
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotStatus('sent');
    } catch {
      setForgotStatus('idle');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">ORACLE</h1>
          <div className="login-brand-bar" />
          <h2 className="login-title">Software Manager Tool</h2>
          <p className="login-subtitle">Sign in to access the dashboard</p>
        </div>

        <form className="login-form" onSubmit={handleSignIn} noValidate>
          <div className="login-field-group">
            <label className="login-label" htmlFor="login-email">
              Email, phone number, or username
            </label>
            <div className={focusedField === 'email' ? 'login-input-wrapper login-input-wrapper--focused' : 'login-input-wrapper'}>
              <span className="login-input-icon"><MailIcon /></span>
              <input
                id="login-email"
                type="text"
                className="login-input"
                placeholder="Email, phone, or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>

          <div className="login-field-group">
            <label className="login-label" htmlFor="login-password">
              Password
            </label>
            <div className={focusedField === 'password' ? 'login-input-wrapper login-input-wrapper--focused' : 'login-input-wrapper'}>
              <span className="login-input-icon"><LockIcon /></span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <div className="login-remember-row">
            <label className="login-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="login-checkbox"
              />
              <span className="login-checkbox-custom">
                {rememberMe && <span className="login-check-mark">✓</span>}
              </span>
              <span className="login-remember-text">Remember me</span>
            </label>
          </div>

          {formError && (
            <div style={{
              backgroundColor: '#ffebee', color: '#c62828',
              padding: '10px', borderRadius: '4px', fontSize: '0.85rem',
              marginBottom: '15px', border: '1px solid #ffcdd2', textAlign: 'center',
            }}>
              {formError}
            </div>
          )}

          <button type="submit" className="login-signin-btn" disabled={isLoading}>
            {isLoading ? (
              <span className="login-loading-dots">
                <span className="login-dot" />
                <span className="login-dot login-dot--delay-1" />
                <span className="login-dot login-dot--delay-2" />
              </span>
            ) : 'Sign in'}
          </button>

          <div className="login-forgot-wrap">
            <a
              href="#forgot"
              className="login-forgot-link"
              onClick={(e) => { e.preventDefault(); setShowForgot((v) => !v); setForgotStatus('idle'); }}
            >
              Forgot your password?
            </a>

            {showForgot && (
              <div style={{ marginTop: 12 }}>
                {forgotStatus === 'sent' ? (
                  <p style={{ color: '#2e7d32', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                    ✅ Si el email existe, recibirás un enlace de recuperación en breve.
                  </p>
                ) : (
                  <div>
                    <div
                      className={focusedField === 'forgot' ? 'login-input-wrapper login-input-wrapper--focused' : 'login-input-wrapper'}
                      style={{ marginBottom: 8 }}
                    >
                      <span className="login-input-icon"><MailIcon /></span>
                      <input
                        type="email"
                        className="login-input"
                        placeholder="Your account email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        onFocus={() => setFocusedField('forgot')}
                        onBlur={() => setFocusedField(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleForgotPassword(e); } }}
                      />
                    </div>
                    <button
                      type="button"
                      className="login-signin-btn"
                      disabled={forgotStatus === 'loading'}
                      style={{ marginTop: 0 }}
                      onClick={handleForgotPassword}
                    >
                      {forgotStatus === 'loading' ? (
                        <span className="login-loading-dots">
                          <span className="login-dot" />
                          <span className="login-dot login-dot--delay-1" />
                          <span className="login-dot login-dot--delay-2" />
                        </span>
                      ) : 'Send reset link'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        <div className="login-footer">
          <p className="login-footer-text">© 2026 Oracle Corporation. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
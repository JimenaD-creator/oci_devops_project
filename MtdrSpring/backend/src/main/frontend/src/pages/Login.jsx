import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, login as setSessionAuthenticated } from "../utils/auth";

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
    ) : (
      <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
    )}
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [formError, setFormError] = useState('');

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
      setFormError('Please enter your email, phone, or username and password.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/users`);
      if (!response.ok) throw new Error('Backend error');
      const users = await response.json();
      const idRaw = String(email).trim();
      const idLower = idRaw.toLowerCase();
      const idDigits = idRaw.replace(/\D/g, '');
      const match = users.find((u) => {
        const pass = u.userPassword != null ? String(u.userPassword) : '';
        if (pass !== password) return false;
        const phoneDigits =
          u.phoneNumber != null ? String(u.phoneNumber).replace(/\D/g, '') : '';
        const phoneOk = idDigits.length > 0 && phoneDigits === idDigits;
        const nameOk =
          u.name != null && String(u.name).trim().toLowerCase() === idLower;
        const emailOk =
          u.email != null &&
          String(u.email).trim().toLowerCase() === idLower;
        return phoneOk || nameOk || emailOk;
      });
      if (match) {
        setSessionAuthenticated();
        navigate('/', { replace: true });
      } else {
        setFormError('Invalid credentials. Please try again.');
      }
    } catch (err) {
      setFormError('Could not connect to server. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleSignIn = (e) => {
    e.preventDefault();
    completeLogin();
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">ORACLE</h1>
          <div className="login-brand-bar" />
          <h2 className="login-title">Software Manager Tool</h2>
          <p className="login-subtitle">Sign in to access your team dashboard</p>
        </div>

        <form className="login-form" onSubmit={handleSignIn} noValidate>
          <div className="login-field-group">
            <label className="login-label" htmlFor="login-email">Email, phone, or username</label>
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
            <label className="login-label" htmlFor="login-password">Password</label>
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
              <button type="button" className="login-eye-btn" onClick={() => setShowPassword(!showPassword)}>
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

          {formError && <p className="login-form-error" role="alert">{formError}</p>}

          <button type="submit" className="login-signin-btn" disabled={isLoading}>
            {isLoading ? (
              <span className="login-loading-dots">
                <span className="login-dot" />
                <span className="login-dot login-dot--delay-1" />
                <span className="login-dot login-dot--delay-2" />
              </span>
            ) : 'Sign In'}
          </button>

          <div className="login-forgot-wrap">
            <a href="#forgot" className="login-forgot-link" onClick={(e) => e.preventDefault()}>
              Forgot password?
            </a>
          </div>

          <div className="login-divider">
            <div className="login-divider-line" />
          </div>

          <button type="button" className="login-sso-btn" onClick={completeLogin}>
            <ShieldIcon />
            <span>Secure login with Oracle SSO</span>
          </button>
        </form>

        <div className="login-footer">
          <p className="login-footer-text">© 2026 Oracle Corporation. All rights reserved.</p>
          <div className="login-footer-links">
            <a href="#privacy" className="login-footer-link" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <span className="login-footer-sep">·</span>
            <a href="#terms" className="login-footer-link" onClick={(e) => e.preventDefault()}>Terms of Use</a>
            <span className="login-footer-sep">·</span>
            <a href="#help" className="login-footer-link" onClick={(e) => e.preventDefault()}>Help</a>
          </div>
        </div>
      </div>
    </div>
  );
}
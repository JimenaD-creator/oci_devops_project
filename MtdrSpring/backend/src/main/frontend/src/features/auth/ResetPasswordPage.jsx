import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const LockIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#E53935"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedField, setFocused] = useState(null);

  useEffect(() => {
    document.body.classList.add('login-route');
    return () => document.body.classList.remove('login-route');
  }, []);

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Minimum 6 characters.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Error resetting password.');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch {
      setErrorMsg('Connection error.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-header">
            <h1 className="login-brand">ORACLE</h1>
            <div className="login-brand-bar" />
            <h2 className="login-title">Password updated</h2>
            <p className="login-subtitle">You can now sign in with your new password.</p>
          </div>
          <button
            className="login-signin-btn"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/login')}
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">ORACLE</h1>
          <div className="login-brand-bar" />
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
            <LockIcon />
          </div>
          <h2 className="login-title">New password</h2>
          <p className="login-subtitle">Enter and confirm your new password</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field-group">
            <label className="login-label" htmlFor="rp-password">
              New password
            </label>
            <div
              className={
                focusedField === 'pw'
                  ? 'login-input-wrapper login-input-wrapper--focused'
                  : 'login-input-wrapper'
              }
            >
              <input
                id="rp-password"
                type="password"
                className="login-input"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
              />
            </div>
          </div>

          <div className="login-field-group">
            <label className="login-label" htmlFor="rp-confirm">
              Confirm password
            </label>
            <div
              className={
                focusedField === 'cf'
                  ? 'login-input-wrapper login-input-wrapper--focused'
                  : 'login-input-wrapper'
              }
            >
              <input
                id="rp-confirm"
                type="password"
                className="login-input"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onFocus={() => setFocused('cf')}
                onBlur={() => setFocused(null)}
              />
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                backgroundColor: '#ffebee',
                color: '#c62828',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '0.85rem',
                marginBottom: '15px',
                border: '1px solid #ffcdd2',
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </div>
          )}

          <button type="submit" className="login-signin-btn" disabled={status === 'loading'}>
            {status === 'loading' ? (
              <span className="login-loading-dots">
                <span className="login-dot" />
                <span className="login-dot login-dot--delay-1" />
                <span className="login-dot login-dot--delay-2" />
              </span>
            ) : (
              'Reset password'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-footer-text">© 2026 Oracle Corporation. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

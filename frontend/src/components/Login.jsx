import React, { useContext, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiShield,
} from 'react-icons/fi';
import { AuthContext } from './AuthProvider';
import { FactoryIcon } from './FactoryIcons';
import { api } from '../api';
import { Brand, Feedback, Field } from './ui';

function FactoryIllustration() {
  return (
    <svg
      className="factory-illustration"
      viewBox="0 0 600 300"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" stroke="#ffffff" strokeOpacity=".06" />
        </pattern>
      </defs>
      <rect width="600" height="300" fill="url(#grid)" />
      <path d="M38 238L306 84L566 234L300 389Z" fill="#162439" />
      <path d="M92 205V127L167 84L243 127V205L167 249Z" fill="#3b5274" />
      <path d="M167 171L243 127V205L167 249Z" fill="#20354f" />
      <path d="M92 127L167 84L243 127L167 171Z" fill="#538cda" />
      <path d="M218 223V145L293 102L369 145V223L293 267Z" fill="#486a97" />
      <path d="M293 189L369 145V223L293 267Z" fill="#2c466b" />
      <path d="M218 145L293 102L369 145L293 189Z" fill="#79a8ed" />
      <path d="M344 205V127L419 84L495 127V205L419 249Z" fill="#586177" />
      <path d="M419 171L495 127V205L419 249Z" fill="#293b51" />
      <path d="M344 127L419 84L495 127L419 171Z" fill="#8394ad" />
      <path
        d="M113 151L144 169V203L113 185ZM238 171L269 189V223L238 205ZM365 151L396 169V203L365 185Z"
        fill="#101824"
      />
      <path d="M258 124V51L279 39L300 51V124L279 136Z" fill="#dca64f" />
      <path d="M279 64L300 51V124L279 136Z" fill="#99703b" />
      <path d="M279 39L300 51L279 64L258 51Z" fill="#f6c875" />
      <path
        d="M50 256L300 112L553 256"
        stroke="#4c91ff"
        strokeOpacity=".35"
        strokeDasharray="6 7"
      />
      <circle cx="49" cy="255" r="5" fill="#4c91ff" />
      <circle cx="553" cy="255" r="5" fill="#4c91ff" />
    </svg>
  );
}

export default function Login({ mode = 'login' }) {
  const auth = useContext(AuthContext);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [token] = useState(() => {
    if (mode !== 'reset') return '';
    const value =
      new URLSearchParams(window.location.search).get('token') || '';
    return value;
  });
  useEffect(() => {
    if (mode === 'reset')
      window.history.replaceState({}, '', window.location.pathname);
  }, [mode]);
  if (auth.isAuthenticated && mode === 'login')
    return (
      <Navigate to={auth.role === 'admin' ? '/admin' : '/profile'} replace />
    );
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'login') {
        const result = await api('/login', { method: 'POST', body: data });
        auth.login(result.access_token, result.role);
      } else if (mode === 'forgot') {
        const result = await api('/auth/forgot-password', {
          method: 'POST',
          body: data,
        });
        setMessage(result.message);
      } else {
        if (data.password !== data.confirm_password)
          throw new Error('The passwords don’t match.');
        const result = await api('/auth/reset-password', {
          method: 'POST',
          body: { token, password: data.password },
        });
        auth.clearSession();
        setMessage(result.message);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === 'login'
      ? 'Welcome back.'
      : mode === 'forgot'
        ? 'Let’s get you back in.'
        : 'A fresh start.';
  return (
    <main className="login">
      <section className="login-story">
        <Brand />
        <div className="story-body">
          <span className="story-tag">
            <i /> FACTORY WORKFORCE SYSTEM
          </span>
          <h1>
            Factory command.
            <br />
            Every crew.
            <br />
            <em>Every shift.</em>
          </h1>
          <p>
            Coordinate crews. Monitor coverage.
            <br />
            One control room for your factory workforce.
          </p>
          <div className="login-machine-strip">
            {['conveyor', 'press', 'forklift', 'crew'].map((name) => (
              <span key={name}>
                <FactoryIcon name={name} />
                <small>
                  {name === 'crew' ? 'PERSONNEL' : name.toUpperCase()}
                </small>
              </span>
            ))}
          </div>
          <FactoryIllustration />
        </div>
        <div className="story-footer">
          <span>CREW · ATTENDANCE · SHIFT COORDINATION</span>
          <span>01 / 01</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-top">
          <span>Control room access</span>
          <FiShield /> Secure access
        </div>
        <div className="login-form">
          <p className="eyebrow">
            {mode === 'login' ? 'OPERATOR AUTHENTICATION' : 'ACCOUNT RECOVERY'}
          </p>
          <h2>{title}</h2>
          <p className="muted">
            {mode === 'login'
              ? 'Authenticate to access your factory workforce terminal.'
              : mode === 'forgot'
                ? 'Enter your work email to request a password reset link.'
                : 'Choose a strong password for your workspace.'}
          </p>
          <Feedback error message={error} />
          <Feedback message={message} />
          {!(mode === 'reset' && message) && (
            <form onSubmit={submit}>
              {mode === 'login' ? (
                <>
                  <Field
                    label="Staff ID"
                    name="staff_id"
                    autoComplete="username"
                    placeholder="Enter your staff ID"
                    required
                    maxLength={50}
                  />
                  <label>
                    Password
                    <div className="password-input">
                      <input
                        name="password"
                        type={visible ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        required
                        maxLength={72}
                      />
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={visible ? 'Hide password' : 'Show password'}
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </label>
                  <div className="login-options">
                    <span>
                      <FiShield /> Your workspace, protected.
                    </span>
                    <Link to="/forgot-password">Forgot password?</Link>
                  </div>
                </>
              ) : mode === 'forgot' ? (
                <Field
                  label="Work email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  maxLength={150}
                  required
                />
              ) : (
                <>
                  <Field
                    label="New password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                    hint="At least 12 characters. Try a memorable phrase."
                  />
                  <Field
                    label="Confirm password"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                  />
                </>
              )}
              <button
                className="login-submit"
                disabled={busy || (mode === 'reset' && !token)}
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign in to workspace'
                    : mode === 'forgot'
                      ? 'Send reset link'
                      : 'Set new password'}
                <FiArrowRight />
              </button>
              {mode === 'reset' && !token && (
                <p className="field-hint">
                  Open the link from your reset email, or request a new one.
                </p>
              )}
            </form>
          )}
          <div className="login-help">
            {mode === 'login' ? (
              <>
                New to the team?{' '}
                <span>Your administrator can help you get started.</span>
              </>
            ) : (
              <Link to="/">
                <FiArrowLeft /> Back to sign in
              </Link>
            )}
          </div>
        </div>
        <div className="login-bottom">
          <span>© {new Date().getFullYear()} Factory</span>
          <span>FACTORY CONTROL / AUTHORIZED ACCESS</span>
        </div>
      </section>
    </main>
  );
}

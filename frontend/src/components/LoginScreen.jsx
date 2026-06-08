import { useState } from 'react';

export default function LoginScreen({ onLogin, error, loading }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLocalError('');

    try {
      await onLogin(form);
    } catch (err) {
      console.error('LOGIN ERROR =>', err);
      setLocalError(
        err?.response?.data?.detail ||
        err?.message ||
        'Login failed'
      );
    }
  }

  return (
    <div className="login-shell">
      <div className="login-left">
        <div className="login-brand">
          <div className="brand-logo">S</div>
          <span>Shiksha</span>
        </div>

        <div className="login-hero-content">
          <h1>Your complete student counselling workspace</h1>
          <p>
            Manage leads, applications, documents, payments and communication —
            all in one platform.
          </p>

          <div className="login-features">
            {[
              {
                icon: '🎓',
                title: 'Lead to Admission',
                desc: 'Full pipeline from prospect to enrolled student',
              },
              {
                icon: '📋',
                title: 'Application Tracking',
                desc: 'Real-time status across universities and programs',
              },
              {
                icon: '💬',
                title: 'Integrated Chat',
                desc: 'Per-application communication with students',
              },
              {
                icon: '📊',
                title: 'Live Dashboard',
                desc: 'KPIs, payments, and pipeline at a glance',
              },
            ].map((f) => (
              <div key={f.title} className="login-feature">
                <span className="feature-icon">{f.icon}</span>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="login-left-footer">
          <span>2026 Shiksha - Built for education counsellors</span>
        </div>
      </div>

      <div className="login-right">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <div className="secure-badge">🔒 Secure Access</div>
            <h2>Sign in to your workspace</h2>
            <p>Enter your credentials to continue</p>
          </div>

          <div className="login-fields">
            <label className="field">
              <span className="field-label">Email address</span>
              <input
                className="field-input"
                type="email"
                placeholder="you@portal.com"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                required
                autoComplete="username"
              />
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <input
                className="field-input"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                required
                autoComplete="current-password"
              />
            </label>
          </div>

          {(error || localError) && (
            <div className="error-banner">{error || localError}</div>
          )}

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" /> Signing in...
              </span>
            ) : (
              'Sign In →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

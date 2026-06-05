import { useEffect, useState } from 'react';
import { apiFetch, formatDateTime, formatLabel } from '../../utils';
import ExportButtons from './ExportButtons';

const TABS = ['overview', 'users', 'activity', 'branches', 'danger'];
const PLAN_OPTIONS = ['Free Trial', 'Starter', 'Professional', 'Enterprise'];

function StorageGauge({ health }) {
  const pct = Number(health?.storage_pct || 0);
  const tone = pct > 90 ? 'critical' : pct > 75 ? 'warning' : 'ok';
  return (
    <div className="ops-detail-storage">
      <div className="storage-meter-track">
        <span className={`storage-meter-fill ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span>{pct.toFixed(1)}% used</span>
    </div>
  );
}

export default function TenantDetailPanel({ tenantId, onClose, onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [tenant, setTenant] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [message, setMessage] = useState('');
  const [resetForm, setResetForm] = useState({ admin_email: '', new_password: '' });
  const [planForm, setPlanForm] = useState({ subscription_plan: 'Free Trial', storage_limit_mb: '' });

  useEffect(() => {
    setActiveTab('overview');
    setTenant(null);
    setOnboarding(null);
    setUsers([]);
    setActivity([]);
    setBranches([]);
    setError('');
    setMessage('');
    setResetForm({ admin_email: '', new_password: '' });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    if (activeTab === 'overview' && (!tenant || !onboarding)) loadOverview();
    if (activeTab === 'users' && !users.length) loadUsers();
    if (activeTab === 'activity' && !activity.length) loadActivity();
    if (activeTab === 'branches' && !branches.length) loadBranches();
  }, [tenantId, activeTab]);

  async function loadOverview() {
    setLoading('overview');
    setError('');
    try {
      const [tenantData, onboardingData] = await Promise.all([
        apiFetch(`/api/superadmin/tenants/${tenantId}`),
        apiFetch(`/api/superadmin/tenants/${tenantId}/onboarding`),
      ]);
      setTenant(tenantData);
      setOnboarding(onboardingData);
      setPlanForm({
        subscription_plan: tenantData.subscription_plan || 'Free Trial',
        storage_limit_mb: tenantData.storage_limit_mb || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }

  async function loadUsers() {
    setLoading('users');
    setError('');
    try {
      setUsers(await apiFetch(`/api/superadmin/tenants/${tenantId}/users`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }

  async function loadActivity() {
    setLoading('activity');
    setError('');
    try {
      setActivity(await apiFetch(`/api/superadmin/tenants/${tenantId}/activity`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }

  async function loadBranches() {
    setLoading('branches');
    setError('');
    try {
      setBranches(await apiFetch(`/api/superadmin/tenants/${tenantId}/branches`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }

  async function refreshEverything() {
    await Promise.allSettled([loadOverview(), onRefresh?.()]);
  }

  async function updatePlan(event) {
    event.preventDefault();
    setActionKey('plan');
    setError('');
    setMessage('');
    try {
      const updated = await apiFetch(`/api/superadmin/tenants/${tenantId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({
          subscription_plan: planForm.subscription_plan,
          storage_limit_mb: Number(planForm.storage_limit_mb),
        }),
      });
      setTenant(updated);
      setMessage('Plan updated successfully.');
      await onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionKey('');
    }
  }

  async function toggleTenant() {
    if (!tenant) return;
    setActionKey('status');
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/tenants/${tenantId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !tenant.is_active }),
      });
      setMessage(`Tenant ${tenant.is_active ? 'deactivated' : 'activated'} successfully.`);
      await refreshEverything();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionKey('');
    }
  }

  async function resetCredentials(event) {
    event.preventDefault();
    setActionKey('reset');
    setError('');
    setMessage('');
    try {
      const result = await apiFetch(`/api/tenants/${tenantId}/reset-credentials`, {
        method: 'POST',
        body: JSON.stringify({
          admin_email: resetForm.admin_email.trim() || null,
          new_password: resetForm.new_password,
        }),
      });
      setResetForm({ admin_email: '', new_password: '' });
      setMessage(`Temporary credentials reset for ${result.admin_email}.`);
      await Promise.allSettled([loadUsers(), onRefresh?.()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionKey('');
    }
  }

  async function deleteTenant() {
    if (!tenant) return;
    const confirmed = window.confirm(`Delete tenant "${tenant.name}"? This deactivates its users and removes it from platform lists.`);
    if (!confirmed) return;
    setActionKey('delete');
    setError('');
    try {
      await apiFetch(`/api/tenants/${tenantId}`, { method: 'DELETE' });
      await onRefresh?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionKey('');
    }
  }

  async function impersonateUser(user) {
    const confirmed = window.confirm(`Start a 15 minute impersonation session as ${user.email}?`);
    if (!confirmed) return;
    setActionKey(`impersonate-${user.id}`);
    setError('');
    try {
      const data = await apiFetch(`/api/superadmin/impersonate/${user.id}`, { method: 'POST' });
      localStorage.setItem('superadmin_token_backup', localStorage.getItem('crm_access_token') || '');
      localStorage.setItem('superadmin_role_backup', localStorage.getItem('crm_role') || '');
      localStorage.setItem('superadmin_name_backup', localStorage.getItem('crm_full_name') || '');
      localStorage.setItem('superadmin_tenant_backup', localStorage.getItem('crm_tenant_id') || '');
      localStorage.setItem('crm_role', data.target_user.role || '');
      localStorage.setItem('crm_full_name', data.target_user.email || 'Impersonated User');
      if (data.target_user.tenant_id) {
        localStorage.setItem('crm_tenant_id', String(data.target_user.tenant_id));
      }
      sessionStorage.setItem('crm_impersonate_token', data.access_token);
      sessionStorage.setItem('crm_impersonate_name', data.target_user.email);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionKey('');
    }
  }

  function renderOverview() {
    if (loading === 'overview') return <div className="ops-panel-loading">Loading tenant overview...</div>;
    if (!tenant) return null;
    const health = tenant.health || {};

    return (
      <div className="ops-detail-stack">
        <div className="ops-detail-band">
          <div>
            <span className="ops-eyebrow">Tenant</span>
            <h3>{tenant.name}</h3>
            <p>{tenant.slug}</p>
          </div>
          <span className={`tenant-status-badge ${tenant.is_active ? 'is-active' : 'is-inactive'}`}>
            {tenant.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="ops-detail-grid">
          <div><span>Users</span><strong>{health.total_users || 0}</strong></div>
          <div><span>Students</span><strong>{health.total_students || 0}</strong></div>
          <div><span>Applications</span><strong>{health.total_applications || 0}</strong></div>
          <div><span>Last Activity</span><strong>{health.last_activity_at ? formatDateTime(health.last_activity_at) : 'Never'}</strong></div>
        </div>

        <div className="ops-detail-section">
          <h4>Plan & Storage</h4>
          <form className="ops-plan-form" onSubmit={updatePlan}>
            <label className="field">
              <span className="field-label">Subscription Plan</span>
              <select
                className="field-select"
                value={planForm.subscription_plan}
                onChange={event => setPlanForm(prev => ({ ...prev, subscription_plan: event.target.value }))}
              >
                {PLAN_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Storage Limit MB</span>
              <input
                className="field-input"
                type="number"
                min="1"
                value={planForm.storage_limit_mb}
                onChange={event => setPlanForm(prev => ({ ...prev, storage_limit_mb: event.target.value }))}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={actionKey === 'plan'}>
              {actionKey === 'plan' ? 'Saving...' : 'Save Plan'}
            </button>
          </form>
          <StorageGauge health={health} />
        </div>

        <div className="ops-detail-section">
          <h4>Onboarding</h4>
          <div className="onboarding-progress">
            <span style={{ width: `${onboarding?.overall_pct || 0}%` }} />
          </div>
          <div className="onboarding-checks">
            {(onboarding?.checks || []).map(check => (
              <div key={check.key} className={`onboarding-check ${check.status ? 'is-done' : ''}`}>
                <span>{check.status ? 'Done' : 'Open'}</span>
                <div>
                  <strong>{check.label}</strong>
                  <small>{check.detail}</small>
                </div>
                {check.is_required && <em>Required</em>}
              </div>
            ))}
          </div>
        </div>

        <div className="ops-detail-section">
          <h4>Exports</h4>
          <ExportButtons tenantId={tenant.id} tenantSlug={tenant.slug} />
        </div>
      </div>
    );
  }

  function renderUsers() {
    if (loading === 'users') return <div className="ops-panel-loading">Loading users...</div>;
    return (
      <div className="ops-panel-table">
        {users.map(user => (
          <div key={user.id} className="ops-user-row">
            <div>
              <strong>{user.full_name}</strong>
              <span>{user.email}</span>
            </div>
            <span className="tenant-plan-badge">{formatLabel(user.role)}</span>
            <span className={`tenant-status-badge ${user.is_active ? 'is-active' : 'is-inactive'}`}>
              {user.is_active ? 'Active' : 'Inactive'}
            </span>
            <small>{user.last_login_at ? formatDateTime(user.last_login_at) : 'Never logged in'}</small>
            <button
              type="button"
              className="btn-outline"
              onClick={() => impersonateUser(user)}
              disabled={!user.is_active || actionKey === `impersonate-${user.id}`}
              aria-label={`Impersonate ${user.email}`}
            >
              Impersonate
            </button>
          </div>
        ))}
        {!users.length && <div className="ops-empty-state"><p>No tenant staff users found.</p></div>}
      </div>
    );
  }

  function renderActivity() {
    if (loading === 'activity') return <div className="ops-panel-loading">Loading activity...</div>;
    return (
      <div className="ops-activity-feed">
        {activity.map(item => (
          <div key={item.id} className="ops-activity-row">
            <span className="severity-dot info" />
            <div>
              <strong>{formatLabel(item.action)}</strong>
              <small>{item.user_email || 'System'} · {item.module_name} · {formatDateTime(item.created_at)}</small>
            </div>
          </div>
        ))}
        {!activity.length && <div className="ops-empty-state"><p>No activity recorded yet.</p></div>}
      </div>
    );
  }

  function renderBranches() {
    if (loading === 'branches') return <div className="ops-panel-loading">Loading branches...</div>;
    return (
      <div className="ops-branch-list">
        {branches.map(branch => (
          <div key={branch.id} className="ops-branch-row">
            <div>
              <strong>{branch.name}</strong>
              <span>{[branch.city, branch.state, branch.country].filter(Boolean).join(', ') || 'No location set'}</span>
            </div>
            <span className={`tenant-status-badge ${branch.is_active ? 'is-active' : 'is-inactive'}`}>
              {branch.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
        {!branches.length && <div className="ops-empty-state"><p>No branches created yet.</p></div>}
      </div>
    );
  }

  function renderDanger() {
    if (!tenant) return <div className="ops-panel-loading">Load overview first.</div>;
    return (
      <div className="ops-detail-stack">
        <div className="ops-detail-section">
          <h4>Reset Tenant Credentials</h4>
          <form className="ops-reset-form" onSubmit={resetCredentials}>
            <label className="field">
              <span className="field-label">Admin Email</span>
              <input
                className="field-input"
                type="email"
                placeholder="Optional"
                value={resetForm.admin_email}
                onChange={event => setResetForm(prev => ({ ...prev, admin_email: event.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">New Temporary Password</span>
              <input
                className="field-input"
                type="password"
                minLength="8"
                required
                value={resetForm.new_password}
                onChange={event => setResetForm(prev => ({ ...prev, new_password: event.target.value }))}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={actionKey === 'reset'}>
              {actionKey === 'reset' ? 'Resetting...' : 'Reset Credentials'}
            </button>
          </form>
        </div>

        <div className="ops-danger-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={toggleTenant}
            disabled={actionKey === 'status'}
          >
            {tenant.is_active ? 'Deactivate Tenant' : 'Activate Tenant'}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={deleteTenant}
            disabled={actionKey === 'delete'}
          >
            Delete Tenant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-drawer-overlay" onClick={event => event.target === event.currentTarget && onClose?.()}>
      <aside className="ops-drawer" aria-label="Tenant detail panel">
        <div className="ops-drawer-head">
          <div>
            <span>Tenant Detail</span>
            <h2>{tenant?.name || 'Loading...'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close tenant detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="ops-tabs" role="tablist">
          {TABS.map(tab => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'is-active' : ''}
              onClick={() => setActiveTab(tab)}
              aria-label={`Show ${formatLabel(tab)} tab`}
            >
              {formatLabel(tab)}
            </button>
          ))}
        </div>

        {message && <div className="tenant-success">{message}</div>}
        {error && <div className="ops-inline-error">{error}</div>}

        <div className="ops-drawer-body">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'activity' && renderActivity()}
          {activeTab === 'branches' && renderBranches()}
          {activeTab === 'danger' && renderDanger()}
        </div>
      </aside>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { apiFetch, formatDateTime, formatLabel } from '../../utils';

const PLAN_OPTIONS = ['all', 'Free Trial', 'Starter', 'Professional', 'Enterprise'];
const STATUS_OPTIONS = ['all', 'active', 'inactive'];

function relativeTime(value) {
  if (!value) return 'Never';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return formatDateTime(value);
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function IconButton({ title, className = '', onClick, disabled, children }) {
  return (
    <button
      type="button"
      className={`tenant-icon-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

export default function TenantHealthTable({
  tenants = [],
  loading = false,
  error = '',
  onRetry,
  onRefresh,
  onOpenTenant,
}) {
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const [actionKey, setActionKey] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter(tenant => {
      const matchesSearch = !q
        || tenant.name?.toLowerCase().includes(q)
        || tenant.slug?.toLowerCase().includes(q)
        || tenant.subscription_plan?.toLowerCase().includes(q);
      const matchesPlan = plan === 'all' || tenant.subscription_plan === plan;
      const tenantStatus = tenant.is_active ? 'active' : 'inactive';
      const matchesStatus = status === 'all' || tenantStatus === status;
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [tenants, search, plan, status]);

  async function toggleTenant(tenant, event) {
    event.stopPropagation();
    setActionKey(`status-${tenant.id}`);
    setMessage('');
    setActionError('');
    try {
      await apiFetch(`/api/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !tenant.is_active }),
      });
      setMessage(`${tenant.name} ${tenant.is_active ? 'deactivated' : 'activated'} successfully.`);
      await onRefresh?.();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionKey('');
    }
  }

  async function resetCredentials(tenant, event) {
    event.stopPropagation();
    const newPassword = window.prompt(`Temporary password for ${tenant.name}`);
    if (!newPassword) return;
    if (newPassword.length < 8) {
      setActionError('Temporary password must be at least 8 characters.');
      return;
    }
    const adminEmail = window.prompt('Admin email to reset. Leave blank for first tenant admin.') || '';

    setActionKey(`reset-${tenant.id}`);
    setMessage('');
    setActionError('');
    try {
      const result = await apiFetch(`/api/tenants/${tenant.id}/reset-credentials`, {
        method: 'POST',
        body: JSON.stringify({
          new_password: newPassword,
          admin_email: adminEmail.trim() || null,
        }),
      });
      setMessage(`Temporary credentials reset for ${result.admin_email}.`);
      await onRefresh?.();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionKey('');
    }
  }

  if (loading) {
    return (
      <section className="ops-table-shell">
        <div className="ops-table-toolbar">
          <span className="ops-skeleton w-44" />
          <span className="ops-skeleton w-32" />
        </div>
        <div className="ops-skeleton-table">
          {Array.from({ length: 6 }).map((_, index) => <span key={index} className="ops-skeleton row" />)}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="ops-table-shell">
        <div className="ops-empty-state">
          <h3>Unable to load tenants</h3>
          <p>{error}</p>
          <button type="button" className="btn-primary" onClick={onRetry}>Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="ops-table-shell">
      <div className="ops-table-toolbar">
        <div className="ops-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search tenants"
            aria-label="Search tenants"
          />
        </div>
        <select value={plan} onChange={event => setPlan(event.target.value)} aria-label="Filter by plan">
          {PLAN_OPTIONS.map(option => (
            <option key={option} value={option}>{option === 'all' ? 'All Plans' : option}</option>
          ))}
        </select>
        <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter by status">
          {STATUS_OPTIONS.map(option => (
            <option key={option} value={option}>{option === 'all' ? 'All Statuses' : formatLabel(option)}</option>
          ))}
        </select>
      </div>

      {message && <div className="tenant-success">{message}</div>}
      {actionError && <div className="ops-inline-error">{actionError}</div>}

      <div className="ops-table-wrap">
        <table className="ops-tenant-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Plan</th>
              <th>Usage</th>
              <th>Storage</th>
              <th>Activity</th>
              <th>Setup</th>
              <th>Status</th>
              <th className="tenant-actions-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map(tenant => {
              const health = tenant.health || {};
              const pct = Number(health.storage_pct || 0);
              const storageTone = pct > 90 ? 'critical' : pct > 75 ? 'warning' : 'ok';
              return (
                <tr key={tenant.id} onClick={() => onOpenTenant?.(tenant.id)}>
                  <td>
                    <div className="tenant-name-stack">
                      <strong>{tenant.name}</strong>
                      <span>{tenant.slug}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`ops-plan-badge plan-${String(tenant.subscription_plan || '').toLowerCase().replaceAll(' ', '-')}`}>
                      {tenant.subscription_plan}
                    </span>
                  </td>
                  <td>
                    <div className="ops-count-grid">
                      <span><strong>{health.total_users || 0}</strong> users</span>
                      <span><strong>{health.total_students || 0}</strong> students</span>
                      <span><strong>{health.total_applications || 0}</strong> apps</span>
                    </div>
                  </td>
                  <td>
                    <div className="storage-meter">
                      <div className="storage-meter-track">
                        <span className={`storage-meter-fill ${storageTone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <small>{pct.toFixed(1)}%</small>
                    </div>
                  </td>
                  <td>{relativeTime(health.last_activity_at)}</td>
                  <td>
                    <span className={`tenant-status-badge ${health.setup_completed ? 'is-active' : 'is-inactive'}`}>
                      {health.setup_completed ? 'Complete' : 'Incomplete'}
                    </span>
                  </td>
                  <td>
                    <span className={`tenant-status-badge ${tenant.is_active ? 'is-active' : 'is-inactive'}`}>
                      {tenant.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="tenant-row-actions">
                      <IconButton title="View tenant" onClick={(event) => { event.stopPropagation(); onOpenTenant?.(tenant.id); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                        </svg>
                      </IconButton>
                      <IconButton title="Reset tenant credentials" onClick={(event) => resetCredentials(tenant, event)} disabled={actionKey === `reset-${tenant.id}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 3v5h-5" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-5h5" />
                        </svg>
                      </IconButton>
                      <IconButton
                        title={tenant.is_active ? 'Deactivate tenant' : 'Activate tenant'}
                        className={tenant.is_active ? 'warning' : 'success'}
                        onClick={(event) => toggleTenant(tenant, event)}
                        disabled={actionKey === `status-${tenant.id}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.3 6.8a8 8 0 1011.4 0" />
                        </svg>
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredTenants.length && (
              <tr>
                <td colSpan="8" className="tenant-empty-row">No tenants match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

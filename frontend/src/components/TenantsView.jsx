import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils';

const createEmptyTenantForm = () => ({
  name: '',
  slug: '',
  custom_domain: '',
  subscription_plan: 'Free Trial',
  admin_email: '',
  admin_full_name: '',
  admin_password: '',
});

export default function TenantsView({ setGlobalError }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [resetTenant, setResetTenant] = useState(null);
  const [resetForm, setResetForm] = useState({ admin_email: '', new_password: '' });
  const [creating, setCreating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState(createEmptyTenantForm);

  useEffect(() => {
    loadTenants();
  }, []);

  async function loadTenants() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/tenants/');
      setTenants(data);
    } catch (err) {
      setGlobalError("Failed to load tenants: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setSuccessMessage('');
    try {
      await apiFetch('/api/tenants/', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData(createEmptyTenantForm());
      setSuccessMessage(`Tenant created. ${formData.admin_email} can now log in with the temporary password and will be forced to change it.`);
      loadTenants();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleTenant(tenant) {
    setActionLoadingId(`status-${tenant.id}`);
    setSuccessMessage('');
    try {
      const updated = await apiFetch(`/api/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !tenant.is_active }),
      });
      setTenants(prev => prev.map(item => item.id === tenant.id ? updated : item));
      setSuccessMessage(`${tenant.name} ${updated.is_active ? 'activated' : 'deactivated'} successfully.`);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setActionLoadingId('');
    }
  }

  async function handleDeleteTenant(tenant) {
    const confirmed = window.confirm(`Delete tenant "${tenant.name}"? This will remove it from the platform list and deactivate its users.`);
    if (!confirmed) return;

    setActionLoadingId(`delete-${tenant.id}`);
    setSuccessMessage('');
    try {
      await apiFetch(`/api/tenants/${tenant.id}`, { method: 'DELETE' });
      setTenants(prev => prev.filter(item => item.id !== tenant.id));
      setSuccessMessage(`${tenant.name} deleted successfully.`);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setActionLoadingId('');
    }
  }

  function openResetModal(tenant) {
    setResetTenant(tenant);
    setResetForm({ admin_email: '', new_password: '' });
    setSuccessMessage('');
  }

  async function handleResetCredentials(e) {
    e.preventDefault();
    if (!resetTenant) return;

    setActionLoadingId(`reset-${resetTenant.id}`);
    setSuccessMessage('');
    try {
      const payload = {
        new_password: resetForm.new_password,
        admin_email: resetForm.admin_email.trim() || null,
      };
      const result = await apiFetch(`/api/tenants/${resetTenant.id}/reset-credentials`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResetTenant(null);
      setResetForm({ admin_email: '', new_password: '' });
      await loadTenants();
      setSuccessMessage(`Temporary credentials reset for ${result.admin_email}. They must change the password on next login.`);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setActionLoadingId('');
    }
  }

  if (loading) return <div className="p-8">Loading tenants...</div>;

  return (
    <div className="tenant-page">
      <div className="tenant-page-head">
        <div>
          <h1>Platform Tenants</h1>
          <p>Create tenant organizations and their first admin login.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          + Create Tenant
        </button>
      </div>

      {successMessage && (
        <div className="tenant-success">
          {successMessage}
        </div>
      )}

      <div className="tenant-table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Plan</th>
              <th>Storage</th>
              <th>Status</th>
              <th className="tenant-actions-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td className="tenant-name-cell">{t.name}</td>
                <td>{t.slug}</td>
                <td>
                  <span className="tenant-plan-badge">{t.subscription_plan}</span>
                </td>
                <td>
                  {t.storage_used_mb} / {t.storage_limit_mb} MB
                </td>
                <td>
                  <span className={`tenant-status-badge ${t.is_active ? 'is-active' : 'is-inactive'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="tenant-row-actions">
                    <button
                      type="button"
                      className={`tenant-icon-btn ${t.is_active ? 'warning' : 'success'}`}
                      onClick={() => handleToggleTenant(t)}
                      disabled={actionLoadingId === `status-${t.id}`}
                      title={t.is_active ? 'Deactivate tenant' : 'Activate tenant'}
                      aria-label={t.is_active ? 'Deactivate tenant' : 'Activate tenant'}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.3 6.8a8 8 0 1011.4 0" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="tenant-icon-btn"
                      onClick={() => openResetModal(t)}
                      disabled={actionLoadingId === `reset-${t.id}`}
                      title="Reset tenant credentials"
                      aria-label="Reset tenant credentials"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 3v5h-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-5h5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="tenant-icon-btn danger"
                      onClick={() => handleDeleteTenant(t)}
                      disabled={actionLoadingId === `delete-${t.id}`}
                      title="Delete tenant"
                      aria-label="Delete tenant"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr><td colSpan="6" className="tenant-empty-row">No tenants found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="tenant-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="tenant-modal">
            <div className="tenant-modal-head">
              <div>
                <h2>Create New Tenant</h2>
                <p>Set up the organization and first admin account.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="tenant-form">
              <div className="tenant-form-section">
                <h3>Organization</h3>
                <div className="tenant-form-grid">
                  <label className="field">
                    <span className="field-label">Company Name</span>
                    <input required type="text" className="field-input"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </label>
                  <label className="field">
                    <span className="field-label">Tenant Slug</span>
                    <input required type="text" className="field-input"
                      placeholder="example-agency"
                      value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')})} />
                    <small className="field-hint">Used for tenant selection during login.</small>
                  </label>
                  <label className="field">
                    <span className="field-label">Custom Domain</span>
                    <input type="text" className="field-input"
                      placeholder="Optional"
                      value={formData.custom_domain} onChange={e => setFormData({...formData, custom_domain: e.target.value})} />
                  </label>
                  <label className="field">
                    <span className="field-label">Subscription Plan</span>
                    <select className="field-select"
                      value={formData.subscription_plan} onChange={e => setFormData({...formData, subscription_plan: e.target.value})}>
                  <option>Free Trial</option>
                  <option>Starter</option>
                  <option>Professional</option>
                  <option>Enterprise</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="tenant-form-section">
                <h3>Tenant Admin Login</h3>
                <p>This user is active immediately and must change the temporary password on first login.</p>
                <div className="tenant-form-grid">
                  <label className="field">
                    <span className="field-label">Admin Email</span>
                    <input required type="email" className="field-input"
                      autoComplete="off"
                      value={formData.admin_email} onChange={e => setFormData({...formData, admin_email: e.target.value})} />
                  </label>
                  <label className="field">
                    <span className="field-label">Admin Full Name</span>
                    <input type="text" className="field-input"
                      placeholder="Optional"
                      autoComplete="off"
                      value={formData.admin_full_name} onChange={e => setFormData({...formData, admin_full_name: e.target.value})} />
                  </label>
                  <label className="field field-full">
                    <span className="field-label">Temporary Password</span>
                    <input required type="password" minLength="8" className="field-input"
                      autoComplete="new-password"
                      value={formData.admin_password} onChange={e => setFormData({...formData, admin_password: e.target.value})} />
                    <small className="field-hint">Minimum 8 characters. The tenant admin will replace it after logging in.</small>
                  </label>
                </div>
              </div>

              <div className="tenant-form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTenant && (
        <div className="tenant-modal-overlay" onClick={e => e.target === e.currentTarget && setResetTenant(null)}>
          <div className="tenant-modal tenant-reset-modal">
            <div className="tenant-modal-head">
              <div>
                <h2>Reset Tenant Credentials</h2>
                <p>{resetTenant.name}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setResetTenant(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleResetCredentials} className="tenant-form">
              <div className="tenant-form-section">
                <h3>Temporary Admin Password</h3>
                <p>Leave admin email blank to reset the first tenant admin account.</p>
                <div className="tenant-form-grid">
                  <label className="field">
                    <span className="field-label">Admin Email</span>
                    <input
                      type="email"
                      className="field-input"
                      placeholder="Optional"
                      value={resetForm.admin_email}
                      onChange={e => setResetForm({...resetForm, admin_email: e.target.value})}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">New Temporary Password</span>
                    <input
                      required
                      type="password"
                      minLength="8"
                      className="field-input"
                      autoComplete="new-password"
                      value={resetForm.new_password}
                      onChange={e => setResetForm({...resetForm, new_password: e.target.value})}
                    />
                    <small className="field-hint">The tenant admin will be forced to change this password on login.</small>
                  </label>
                </div>
              </div>

              <div className="tenant-form-actions">
                <button type="button" onClick={() => setResetTenant(null)} className="btn-outline">Cancel</button>
                <button type="submit" disabled={actionLoadingId === `reset-${resetTenant.id}`} className="btn-primary">
                  {actionLoadingId === `reset-${resetTenant.id}` ? 'Resetting...' : 'Reset Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

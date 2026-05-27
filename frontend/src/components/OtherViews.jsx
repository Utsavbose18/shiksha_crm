import { useState } from 'react';
import { SectionCard, Badge, TextInput, TextArea, SelectInput, Modal } from './UI';
import { formatDateTime, formatLabel, apiFetch, SERVICE_TYPES, USER_ROLES } from '../utils';



function UserChangePasswordModal({ user, onClose, setGlobalError }) {
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState('');
  const [error, setError]             = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
      setSuccess('Password reset successfully!');
      setNewPassword('');
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Reset Password — ${user.full_name || user.email}`} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        {success && <div className="alert alert-success field-full">{success}</div>}
        {error   && <div className="alert alert-error field-full">{error}</div>}
        <TextInput
          label="New Password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="Min. 8 characters"
          required
        />
        <div className="form-actions field-full">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function UsersView({ users, onRefresh, setGlobalError }) {
  const [showForm, setShowForm]             = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [changePwdUser, setChangePwdUser]   = useState(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', role: 'counsellor' });
  const [submitting, setSubmitting]         = useState(false);

  function update(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/users/', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ email: '', password: '', full_name: '', phone: '', role: 'counsellor' });
      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Delete user ${user.full_name}?\n\nThis cannot be undone.`)) return;
    setActionLoadingId(String(user.id));
    try {
      await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setActionLoadingId('');
    }
  }

  return (
    <div className="view-stack">
      <SectionCard
        title="Users"
        subtitle="Staff management — admins and counsellors"
        actions={<button className="btn-primary" onClick={() => setShowForm(true)}>+ Add User</button>}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>No users found</td></tr>
              )}
              {users.map(user => {
                const isLoading = String(actionLoadingId) === String(user.id);
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-cell-avatar">{(user.full_name || 'U').charAt(0).toUpperCase()}</div>
                        <span style={{ fontWeight: 500 }}>{user.full_name}</span>
                      </div>
                    </td>
                    <td className="text-muted">{user.email}</td>
                    <td><Badge value={user.role} /></td>
                    <td className="text-muted">{user.phone || '—'}</td>
                    <td>
                      <span className={`active-dot ${user.is_active ? 'active' : 'inactive'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-muted">{formatDateTime(user.created_at)}</td>

                    {/* Actions column */}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>

                        {/* Change Password */}
                        <button
                          title="Reset user password"
                          onClick={() => setChangePwdUser(user)}
                          style={{
                            background: 'var(--sap-brand-light)',
                            border: '1px solid var(--sap-brand-mid)',
                            borderRadius: 6,
                            padding: '5px 9px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            color: 'var(--sap-brand)',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                          </svg>
                          Reset
                        </button>

                        {/* Delete */}
                        <button
                          title="Delete user"
                          disabled={isLoading}
                          onClick={() => handleDelete(user)}
                          style={{
                            background: 'var(--sap-negative-light)',
                            border: '1px solid #f5b5b5',
                            borderRadius: 6,
                            padding: '5px 9px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'var(--sap-negative)',
                            opacity: isLoading ? 0.6 : 1,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Add user modal */}
      {showForm && (
        <Modal title="Add Team Member" onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submit}>
            <TextInput label="Full Name" value={form.full_name} onChange={e => update('full_name', e.target.value)} required />
            <TextInput label="Email" type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
            <TextInput label="Password" type="password" value={form.password} onChange={e => update('password', e.target.value)} required />
            <TextInput label="Phone" value={form.phone} onChange={e => update('phone', e.target.value)} />
            <SelectInput label="Role" options={USER_ROLES} value={form.role} onChange={e => update('role', e.target.value)} />
            <div className="form-actions field-full">
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create User'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change password modal */}
      {changePwdUser && (
        <UserChangePasswordModal
          user={changePwdUser}
          onClose={() => setChangePwdUser(null)}
          setGlobalError={setGlobalError}
        />
      )}
    </div>
  );
}

// ── Universities ──────────────────────────────────────────────────────────────



export function UniversitiesView({ universities, onRefresh, setGlobalError }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    country: '',
    city: '',
    category: 'global',
  });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const filteredUniversities = universities.filter(u =>
  [u.name, u.country, u.city, u.category]
    .join(' ')
    .toLowerCase()
    .includes(search.toLowerCase())
);
  function update(f, v) {
    setForm(p => ({ ...p, [f]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name: form.name.trim(),
        country: form.country.trim(),
        city: form.city.trim() || null,
        category: form.category,
      };

      console.log("Submitting university payload:", payload); // debug

      await apiFetch('/api/universities/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setForm({
        name: '',
        country: '',
        city: '',
        category: 'global',
      });

      await onRefresh();
    } catch (err) {
      console.error("University create error:", err);
      setGlobalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="view-stack">
      <SectionCard
        title="Universities"
        subtitle="Manage universities used for student applications"
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Add University
          </button>
        }
        
      >
        <input
  type="text"
  placeholder="Search universities..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    marginBottom: '12px',
    padding: '8px 10px',
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
  }}
/>
<table>
  <thead>
    <tr>
    <th>University Name</th>
    <th>Country</th>
    <th>City</th>
    <th>Partners</th>
    </tr>
  </thead>
<tbody>
  {universities.length === 0 && (
    <tr>
      <td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>
        No universities added yet.
      </td>
    </tr>
  )}

  {filteredUniversities.map(u => (
    <tr key={u.id}>
      <td>{u.name}</td>
      <td>{u.country}</td>
      <td>{u.city || '—'}</td>
      <td>{u.category}</td>
    </tr>
  ))}
</tbody>
</table>
      </SectionCard>

      {showForm && (
        <Modal title="Add University" onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submit}>
            <TextInput
              label="University Name"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              required
            />

            <TextInput
              label="Country"
              value={form.country}
              onChange={e => update('country', e.target.value)}
              required
            />

            <TextInput
              label="City (Optional)"
              value={form.city}
              onChange={e => update('city', e.target.value)}
            />

            {/* USE NORMAL SELECT instead of SelectInput */}
            <label className="field">
              <span className="field-label">Partners</span>
              <select
                className="field-select"
                value={form.category}
                onChange={e => update('category', e.target.value)}
                required
              >
                <option value="global">Global</option>
                <option value="superior">Superior</option>
                <option value="kings">Kings</option>
              </select>
            </label>

            <div className="form-actions field-full">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button className="btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Add University'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


function getFlag(country) {
  const flags = {
    'United Kingdom': '🇬🇧', 'UK': '🇬🇧',
    'United States': '🇺🇸', 'USA': '🇺🇸',
    'Canada': '🇨🇦', 'Australia': '🇦🇺',
    'Germany': '🇩🇪', 'France': '🇫🇷',
    'Netherlands': '🇳🇱', 'Ireland': '🇮🇪',
    'New Zealand': '🇳🇿', 'Singapore': '🇸🇬',
    'Switzerland': '🇨🇭', 'India': '🇮🇳',
  };
  return flags[country] || '🌍';
}
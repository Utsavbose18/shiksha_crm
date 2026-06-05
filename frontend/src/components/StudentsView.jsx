import { useState } from 'react';
import { SectionCard, TextInput, Modal } from './UI';
import { formatDateTime, apiFetch } from '../utils';

// ── Status config — module scope so AppStatusBadge can access it ──────────────
const STATUS_CONFIG = {
  lead:                     { label: 'Lead',               color: '#0C447C', bg: '#E6F1FB', border: '#185FA5' },
  initiated:                { label: 'Initiated',           color: '#633806', bg: '#FAEEDA', border: '#BA7517' },
  pending_from_student:     { label: 'Pending — student',   color: '#27500A', bg: '#EAF3DE', border: '#3B6D11' },
  pending_from_LS:          { label: 'Pending — LS',        color: '#27500A', bg: '#EAF3DE', border: '#3B6D11' },
  conditional_offer:        { label: 'Conditional offer',   color: '#085041', bg: '#E1F5EE', border: '#0F6E56' },
  unconditional_offer:      { label: 'Unconditional offer', color: '#085041', bg: '#E1F5EE', border: '#0F6E56' },
  offer_accepted:           { label: 'Offer accepted',      color: '#3C3489', bg: '#EEEDFE', border: '#534AB7' },
  funds_approved:           { label: 'Funds approved',      color: '#3C3489', bg: '#EEEDFE', border: '#534AB7' },
  fee_paid:                 { label: 'Fee paid',            color: '#3C3489', bg: '#EEEDFE', border: '#534AB7' },
  tuition_payment_not_done: { label: 'Tuition pending',     color: '#633806', bg: '#FAEEDA', border: '#BA7517' },
  visa_applied:             { label: 'Visa applied',        color: '#72243E', bg: '#FBEAF0', border: '#993556' },
  visa_approved:            { label: 'Visa approved',       color: '#72243E', bg: '#FBEAF0', border: '#993556' },
  rejected:                 { label: 'Rejected',            color: '#791F1F', bg: '#FCEBEB', border: '#A32D2D' },
  visa_rejected:            { label: 'Visa rejected',       color: '#791F1F', bg: '#FCEBEB', border: '#A32D2D' },
  application_on_hold:      { label: 'On hold',             color: '#444441', bg: '#F1EFE8', border: '#5F5E5A' },
  case_closed:              { label: 'Case closed',         color: '#444441', bg: '#F1EFE8', border: '#5F5E5A' },
  waitlisted:               { label: 'Waitlisted',          color: '#444441', bg: '#F1EFE8', border: '#5F5E5A' },
  deferral:                 { label: 'Deferral',            color: '#444441', bg: '#F1EFE8', border: '#5F5E5A' },
};

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ student, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

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
      await apiFetch(`/api/students/${student.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
      setSuccess('Password changed successfully!');
      setNewPassword('');
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Change Password — ${[student.first_name, student.last_name].filter(Boolean).join(' ') || student.email}`}
      onClose={onClose}
    >
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

// ── Inline Assigned-To Dropdown ───────────────────────────────────────────────
function AssignedToCell({ student, users, onRefresh, setGlobalError }) {
  const [saving, setSaving] = useState(false);

  async function handleChange(e) {
    const newCounsellorId = e.target.value ? Number(e.target.value) : null;
    setSaving(true);
    try {
      await apiFetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ counsellor_id: newCounsellorId }),
      });
      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const counsellors = users.filter(u => u.role === 'counsellor');

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={student.counsellor_id || ''}
        onChange={handleChange}
        disabled={saving}
        onClick={e => e.stopPropagation()}
        style={{
          fontSize: 12,
          padding: '4px 24px 4px 8px',
          border: '1px solid var(--sap-border)',
          borderRadius: 6,
          background: saving ? 'var(--sap-base-2)' : 'var(--sap-base)',
          color: student.counsellor_id ? 'var(--sap-text-1)' : 'var(--sap-text-4)',
          cursor: saving ? 'not-allowed' : 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          fontFamily: 'inherit',
          minWidth: 120,
          maxWidth: 160,
        }}
      >
        <option value="">Unassigned</option>
        {counsellors.map(u => (
          <option key={u.id} value={u.id}>{u.full_name}</option>
        ))}
      </select>
      <span style={{
        position: 'absolute', right: 7, top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        fontSize: 9,
        color: 'var(--sap-text-3)',
      }}>▼</span>
      {saving && (
        <span style={{
          position: 'absolute', right: -20, top: '50%',
          transform: 'translateY(-50%)',
          width: 12, height: 12,
          border: '2px solid var(--sap-brand-mid)',
          borderTopColor: 'var(--sap-brand)',
          borderRadius: '50%',
          animation: 'spin .6s linear infinite',
          display: 'inline-block',
        }} />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentsView({
  students,
  users,
  auth,
  selectedStudentId,
  setSelectedStudentId,
  openedStudentId,
  setOpenedStudentId,
  onRefresh,
  setGlobalError
}) {
  const [appCounts, setAppCounts] = useState({});
  const [showForm, setShowForm]           = useState(false);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', phone: '', counsellor_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/students/', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          counsellor_id: form.counsellor_id ? Number(form.counsellor_id) : null
        }),
      });
      setShowForm(false);
      setForm({ email: '', first_name: '', last_name: '', phone: '', counsellor_id: '' });
      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteStudent(student) {
    const confirmed = window.confirm(
      `Delete ${getStudentName(student)}?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;
    setActionLoadingId(String(student.id));
    try {
      await apiFetch(`/api/students/${student.id}/delete`, { method: 'DELETE' });
      if (String(openedStudentId) === String(student.id)) setOpenedStudentId('');
      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setActionLoadingId('');
    }
  }

  async function openStudent(studentId) {
    setSelectedStudentId(String(studentId));
    setOpenedStudentId(String(studentId));
    if (!appCounts[studentId]) {
      try {
        const res = await apiFetch(`/api/students/${studentId}/applications`);
        setAppCounts(prev => ({ ...prev, [studentId]: res.length }));
      } catch (err) {
        console.error('Failed to fetch application count', err);
      }
    }
  }

  const filtered = students.filter(student => {
    const name = [student.first_name, student.last_name].filter(Boolean).join(' ').toLowerCase();
    const matchSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      student.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || student.lead_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="view-stack">
      <SectionCard
        title="Students"
        subtitle="Manage your students and their profiles"
        actions={
          <div className="actions-row">
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Register New Student
            </button>
          </div>
        }
      >
        <div className="filters-bar">
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="lead">Lead</option>
            <option value="converted">Converted</option>
          </select>
          <button className="btn-primary btn-sm" type="button">Search</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Created On</th>
                <th>Student Name</th>
                <th>Email</th>
                <th>Phone Number</th>
                {auth.role === 'admin' && <th>LS Assignee</th>}
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-8">
                    No students found
                  </td>
                </tr>
              )}

              {filtered.map(student => {
                const name       = getStudentName(student);
                const isSelected = String(selectedStudentId) === String(student.id);
                const isLoading  = String(actionLoadingId)   === String(student.id);

                return (
                  <tr
                    key={student.id}
                    className={`student-row-clickable ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => openStudent(student.id)}
                  >
                    <td onClick={e => e.stopPropagation()} />

                    <td className="text-muted">{formatDateTime(student.created_at)}</td>

                    <td>
                      <div className="student-name-cell">
                        <span className="student-name-link">{name}</span>
                      </div>
                    </td>

                    <td>
                      <div className="email-cell">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cell-icon">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {student.email}
                      </div>
                    </td>

                    <td>
                      {student.phone ? (
                        <div className="phone-cell">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cell-icon">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {student.phone}
                        </div>
                      ) : '—'}
                    </td>

                    {auth.role === 'admin' && (
                      <td onClick={e => e.stopPropagation()}>
                        <AssignedToCell
                          student={student}
                          users={users}
                          onRefresh={onRefresh}
                          setGlobalError={setGlobalError}
                        />
                      </td>
                    )}

                    <td>
                      <AppStatusBadge leadStatus={student.application_status} />
                    </td>

                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          title="Delete student"
                          disabled={isLoading}
                          onClick={() => handleDeleteStudent(student)}
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

        <TableFooterBar
          count={filtered.length}
          total={students.length}
          actionLabel="View Total Applications"
        />
      </SectionCard>

      {showForm && (
        <Modal title="Register New Student" onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submit}>
            <TextInput label="First Name"  value={form.first_name}  onChange={e => update('first_name', e.target.value)}  required />
            <TextInput label="Last Name"   value={form.last_name}   onChange={e => update('last_name', e.target.value)}   required />
            <TextInput label="Email" type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
            <TextInput label="Phone" value={form.phone} onChange={e => update('phone', e.target.value)} />
            {auth.role === 'admin' && (
              <label className="field">
                <span className="field-label">Assign Counsellor</span>
                <select className="field-select" value={form.counsellor_id} onChange={e => update('counsellor_id', e.target.value)}>
                  <option value="">Assign later</option>
                  {users.filter(u => u.role === 'counsellor').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="form-actions field-full">
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Register Student'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStudentName(student) {
  return [student.first_name, student.last_name].filter(Boolean).join(' ') || '—';
}

function TableFooterBar({ count, total, actionLabel }) {
  return (
    <div className="table-footer-bar">
      <div className="table-footer-left">
        {count > 0 ? `Showing 1 - ${count}` : 'Showing 0'} of {total}
      </div>
      <div className="table-footer-right">
        <button type="button" className="table-footer-link">{actionLabel}</button>
        <div className="table-footer-nav">
          <button type="button" className="table-footer-nav-btn" disabled aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function AppStatusBadge({ leadStatus }) {
  const cfg = STATUS_CONFIG[leadStatus];
  if (!cfg) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#F1EFE8', color: '#444441', border: '0.5px solid #5F5E5A', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5F5E5A', flexShrink: 0 }} />
      No application
    </span>
  );
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color,
      border: `0.5px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.border, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

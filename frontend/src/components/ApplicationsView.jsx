import { useMemo, useState } from 'react';
import { SectionCard, TextInput, TextArea, Modal } from './UI';
import { apiFetch, formatLabel } from '../utils';

export default function ApplicationsView({
  applications,
  students,
  universities,
  auth,
  selectedStudentId,
  selectedApplicationId,
  setSelectedApplicationId,
  onRefresh,
  setGlobalError,
  onOpenStudent,
}) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({
    student_id: '',
    university_id: '',
    course_name: '',
    intake_month: '',
    intake_year: '',
    application_deadline: '',
    tuition_fee: '',
    currency: 'USD',
    application_fee: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const studentMap = useMemo(() => {
    const map = new Map();
    (students || []).forEach((student) => {
      map.set(String(student.id), student);
    });
    return map;
  }, [students]);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (applications || []).filter((app) => {
      const student = studentMap.get(String(app.student_id));
      const studentName = getStudentName(student).toLowerCase();
      const universityName = (app.university?.name || '').toLowerCase();
      const courseName = (app.course_name || '').toLowerCase();
      const ackNo = buildAckNo(app).toLowerCase();
      const status = String(app.application_status || '').toLowerCase();

      const matchesSearch =
        !query ||
        studentName.includes(query) ||
        universityName.includes(query) ||
        courseName.includes(query) ||
        ackNo.includes(query);

      const matchesStatus =
        statusFilter === 'all' || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter, studentMap]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const sid = form.student_id || selectedStudentId;
      if (!sid) throw new Error('Select a student first');

      await apiFetch(`/api/students/${sid}/applications/`, {
        method: 'POST',
        body: JSON.stringify({
          university_id: Number(form.university_id),
          course_name: form.course_name,
          intake_month: form.intake_month || null,
          intake_year: form.intake_year ? Number(form.intake_year) : null,
          application_deadline: form.application_deadline || null,
          tuition_fee: form.tuition_fee ? Number(form.tuition_fee) : null,
          currency: form.currency || 'USD',
          application_fee: form.application_fee ? Number(form.application_fee) : null,
          notes: form.notes || null,
        }),
      });

      setShowForm(false);
      setForm({
        student_id: sid,
        university_id: '',
        course_name: '',
        intake_month: '',
        intake_year: '',
        application_deadline: '',
        tuition_fee: '',
        currency: 'USD',
        application_fee: '',
        notes: '',
      });

      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteApplication(app) {
    if (!app?.id || !app?.student_id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete application ${buildAckNo(app)}?`
    );

    if (!confirmed) return;

    setDeletingId(String(app.id));

    try {
      await apiFetch(`/api/students/${app.student_id}/applications/${app.id}`, {
        method: 'DELETE',
      });

      if (String(selectedApplicationId) === String(app.id)) {
        setSelectedApplicationId(null);
      }

      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="view-stack">
      <SectionCard
        title={auth.role === 'student' ? 'My Applications' : 'Applications'}
        subtitle="Track and manage student applications in one professional workspace"
        actions={
          auth.role !== 'student' && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Add Application
            </button>
          )
        }
        noPad
      >
        <div className="app-shell-header">
          <div className="applications-toolbar applications-toolbar-single">
            <div className="applications-search">
              <input
                type="text"
                className="field-input"
                placeholder="Search by ACK no., student, university, or program"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="applications-filters">
              <select
                className="field-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="initiated">Initiated</option>
                <option value="pending_from_student">Pending from Student</option>
                <option value="pending_from_LS">Pending From LS</option>
                <option value="conditional_offer">Conditional Offer</option>
                <option value="unconditional_offer">Unconditional Offer</option>
                <option value="offer_accepted">Offer Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="case_closed">Case closed</option>
                <option value="application_on_hold">Application on hold</option>
                <option value="funds_approved">Funds Approved</option>
                <option value="deferral">Deferral</option>
                <option value="fee_paid">Fee Paid</option>
                <option value="tuition_payment_not_done">Tuition payment not done</option>
                <option value="visa_applied">Visa Applied</option>
                <option value="visa_rejected">Visa Rejected</option>
                <option value="visa_approved">Visa Approved</option>
                
              </select>
            </div>
          </div>
        </div>

        <div className="section-body">
          {filteredApplications.length === 0 ? (
            <div className="empty-state empty-state-soft">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3>No applications found</h3>
              <p>
                {applications.length === 0
                  ? auth.role === 'student'
                    ? 'Your applications will appear here.'
                    : 'Select a student and add their first application.'
                  : 'Try changing your search or status filter.'}
              </p>
            </div>
          ) : (
            <AppliedProgramsTableView
              applications={filteredApplications}
              students={students}
              auth={auth}
              deletingId={deletingId}
              selectedApplicationId={selectedApplicationId}
              setSelectedApplicationId={setSelectedApplicationId}
              onDelete={handleDeleteApplication}
              onOpenStudent={onOpenStudent}
            />
          )}
        </div>
      </SectionCard>

      {showForm && (
        <Modal title="Add New Application" onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Student</span>
              <select
                className="field-select"
                value={form.student_id || selectedStudentId}
                onChange={(e) => update('student_id', e.target.value)}
                required
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getStudentName(s)} ({s.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">University</span>
              <select
                className="field-select"
                value={form.university_id}
                onChange={(e) => update('university_id', e.target.value)}
                required
              >
                <option value="">Select university</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>

            <TextInput
              label="Program Name"
              value={form.course_name}
              onChange={(e) => update('course_name', e.target.value)}
              required
            />

            <TextInput
              label="Intake Month"
              placeholder="e.g. September"
              value={form.intake_month}
              onChange={(e) => update('intake_month', e.target.value)}
            />

            <TextInput
              label="Intake Year"
              type="number"
              placeholder="2025"
              value={form.intake_year}
              onChange={(e) => update('intake_year', e.target.value)}
            />

            <TextInput
              label="Application Deadline"
              type="date"
              value={form.application_deadline}
              onChange={(e) => update('application_deadline', e.target.value)}
            />

            <TextInput
              label="Tuition Fee"
              type="number"
              value={form.tuition_fee}
              onChange={(e) => update('tuition_fee', e.target.value)}
            />

            <TextInput
              label="Currency"
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
            />

            <TextInput
              label="Application Fee"
              type="number"
              value={form.application_fee}
              onChange={(e) => update('application_fee', e.target.value)}
            />

            <TextArea
              label="Notes"
              rows={4}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />

            <div className="form-actions field-full">
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AppliedProgramsTableView({
  applications,
  students,
  auth,
  deletingId,
  selectedApplicationId,
  setSelectedApplicationId,
  onDelete,
  onOpenStudent,
}) {
  const studentMap = useMemo(() => {
    const map = new Map();
    (students || []).forEach((student) => {
      map.set(String(student.id), student);
    });
    return map;
  }, [students]);

  const canDelete = auth?.role !== 'student';

  return (
    <div className="applications-table-shell">
      <div className="applications-table-wrap">
        <table className="applications-table">
          <thead>
            <tr>
              <th>ACK. No.</th>
              <th>Date Created</th>
              <th>Student Name</th>
              <th>LS Assignee</th>
              <th>University Name</th>
              <th>Program Name</th>
              <th>Intake</th>
              <th>Created By</th>
              <th>Application Status</th>
              <th className="th-actions">Actions</th>
            </tr>
          </thead>

          <tbody>
            {applications.map((app) => {
              const student = studentMap.get(String(app.student_id));
              const isActive = String(app.id) === String(selectedApplicationId);
              const isDeleting = String(deletingId) === String(app.id);

              return (
                <tr
                  key={app.id}
                  className={isActive ? 'is-active' : ''}
                  onClick={() => {
                    setSelectedApplicationId(String(app.id));
                    if (onOpenStudent && app.student_id) {
                      onOpenStudent(app.student_id);
                    }
                  }}
                >
                  <td className="td-ack">
                    <button
                      type="button"
                      className="ack-link"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedApplicationId(String(app.id));
                        if (onOpenStudent && app.student_id) {
                          onOpenStudent(app.student_id);
                        }
                      }}
                    >
                      {buildAckNo(app)}
                    </button>
                  </td>

                  <td>{formatCreatedAt(app.created_at)}</td>

                  <td>
                    <div className="table-primary-cell">
                      <span className="cell-title">{getStudentName(student)}</span>
                      <span className="cell-subtitle">{student?.email || '—'}</span>
                    </div>
                  </td>
                  <td>{getLsAssigneeName(student)}</td>
                  <td>
                    <div className="table-primary-cell">
                      <span className="cell-title">{app.university?.name || '—'}</span>
                      <span className="cell-subtitle">{app.university?.country || '—'}</span>
                    </div>
                  </td>

                  <td>
                    <div className="table-primary-cell">
                      <span className="cell-title">{app.course_name || '—'}</span>
                      <span className="cell-subtitle">
                        {app.notes ? clampText(app.notes, 44) : 'No notes added'}
                      </span>
                    </div>
                  </td>

                  <td>{formatIntake(app.intake_month, app.intake_year)}</td>

                  <td>{getCreatedByLabel(app, auth)}</td>

                  <td>
                    <span className={`status-chip status-${getStatusColor(app.application_status)}`}>
                      {formatLabel(app.application_status)}
                    </span>
                  </td>

                  

                  <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                    {canDelete ? (
                      <button
                        type="button"
                        className="table-action-btn table-action-btn-danger"
                        onClick={() => onDelete(app)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : (
                      <span className="table-action-placeholder">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        <TableFooterBar
      count={applications.length}
      total={applications.length}
      actionLabel="View Total Applications"
    />
    </div>
  );
}
function TableFooterBar({ count, total, actionLabel }) {
  const hasRows = count > 0;

  return (
    <div className="table-footer-bar">
      <div className="table-footer-left">
        {hasRows ? `Showing 1 - ${count}` : 'Showing 0'} of {total}
      </div>

      <div className="table-footer-right">
        <button type="button" className="table-footer-link">
          {actionLabel}
        </button>

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
function getStudentName(student) {
  if (!student) return '—';
  const fullName = [student.first_name, student.last_name].filter(Boolean).join(' ').trim();
  return fullName || student.email || '—';
}

function getLsAssigneeName(student) {
  if (!student) return '—';

  return (
    student.counsellor_name ||
    student.counsellor?.full_name ||
    student.assigned_counsellor_name ||
    '—'
  );
}

function buildAckNo(app) {
  const created = app?.created_at ? new Date(app.created_at) : null;
  const year = created && !Number.isNaN(created.getTime())
    ? String(created.getFullYear()).slice(-2)
    : '00';
  const nextYear = String(Number(year) + 1).padStart(2, '0');
  return `ACK-${String(app.id).padStart(4, '0')}/${year}-${nextYear}`;
}

function formatCreatedAt(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatIntake(month, year) {
  const text = [month, year].filter(Boolean).join(' ').trim();
  return text || '—';
}

function getCreatedByLabel(app, auth) {
  if (auth?.role === 'student') return 'Student';
  if (auth?.role === 'admin') return 'Admin';
  if (auth?.role === 'counsellor') return 'Counsellor';
  return '—';
}




function clampText(value, limit = 40) {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function getStatusColor(status) {
  const map = {
    accepted: 'green',
    unconditional_offer: 'green',
    rejected: 'red',
    withdrawn: 'gray',
    under_review: 'orange',
    conditional_offer: 'orange',
    waitlisted: 'orange',
    applied: 'blue',
    shortlisted: 'blue',
  };

  return map[status] || 'gray';
}
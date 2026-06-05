import { useMemo, useState } from 'react';
import { SectionCard, TextInput, TextArea, Modal } from './UI';
import { APPLICATION_STATUS, apiFetch, formatLabel } from '../utils';

const UNIVERSITY_CATEGORIES = ['global', 'superior', 'kings'];

export default function ApplicationsView({
  applications = [],
  students = [],
  universities = [],
  auth,
  selectedStudentId,
  selectedApplicationId,
  setSelectedApplicationId,
  onRefresh,
  onUniversitiesRefresh,
  setGlobalError,
  onOpenStudent,
}) {
  const [showForm, setShowForm] = useState(false);
  const [showUniversityForm, setShowUniversityForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState(getInitialApplicationForm(selectedStudentId));
  const [universityForm, setUniversityForm] = useState(getInitialUniversityForm());
  const [submitting, setSubmitting] = useState(false);
  const [universitySubmitting, setUniversitySubmitting] = useState(false);

  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((student) => {
      map.set(String(student.id), student);
    });
    return map;
  }, [students]);

  const applicationStats = useMemo(() => buildApplicationStats(applications), [applications]);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    const normalizedFilter = String(statusFilter || '').toLowerCase();

    return applications.filter((app) => {
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
        normalizedFilter === 'all' || status === normalizedFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter, studentMap]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateUniversity(field, value) {
    setUniversityForm((prev) => ({ ...prev, [field]: value }));
  }

  function openApplicationForm() {
    setForm((prev) => ({
      ...prev,
      student_id: prev.student_id || selectedStudentId || '',
    }));
    setShowForm(true);
  }

  function closeApplicationForm() {
    setShowForm(false);
    setShowUniversityForm(false);
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const sid = form.student_id || selectedStudentId;
      if (!sid) throw new Error('Select a student first');
      if (!form.university_id) throw new Error('Select a university first');

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
      setForm(getInitialApplicationForm(sid));

      await onRefresh();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUniversity(e) {
    e.preventDefault();
    setUniversitySubmitting(true);

    try {
      const payload = {
        name: universityForm.name.trim(),
        country: universityForm.country.trim(),
        city: universityForm.city.trim() || null,
        category: universityForm.category,
      };

      if (!payload.name || !payload.country) {
        throw new Error('University name and country are required');
      }

      if (!UNIVERSITY_CATEGORIES.includes(payload.category)) {
        throw new Error('Select a valid university partner type');
      }

      const created = await apiFetch('/api/universities/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (onUniversitiesRefresh) {
        await onUniversitiesRefresh();
      }

      if (created?.id) {
        update('university_id', String(created.id));
      }

      setUniversityForm(getInitialUniversityForm());
      setShowUniversityForm(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setUniversitySubmitting(false);
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
    <div className="view-stack applications-workspace">
      <SectionCard
        title={auth.role === 'student' ? 'My Applications' : 'Applications'}
        subtitle="Track student applications, offers, visa stages, and pending work."
        actions={
          auth.role !== 'student' && (
            <button className="btn-primary app-primary-action" onClick={openApplicationForm}>
              <IconPlus />
              <span>Add Application</span>
            </button>
          )
        }
        noPad
      >
        <div className="app-shell-header">
          <div className="applications-stats-grid">
            {applicationStats.map((stat) => (
              <div className={`application-stat application-stat-${stat.tone}`} key={stat.label}>
                <span className="application-stat-label">{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.helper}</small>
              </div>
            ))}
          </div>

          <div className="applications-command-bar">
            <label className="applications-search" aria-label="Search applications">
              <IconSearch />
              <input
                type="text"
                placeholder="Search ACK, student, university, or program"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <label className="applications-filter-field">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                {APPLICATION_STATUS.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="section-body applications-section-body">
          {filteredApplications.length === 0 ? (
            <div className="empty-state empty-state-soft applications-empty-state">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
                  />
                </svg>
              </div>
              <h3>No applications found</h3>
              <p>
                {applications.length === 0
                  ? auth.role === 'student'
                    ? 'Your applications will appear here.'
                    : 'Add the first student application to start tracking progress.'
                  : 'Try changing your search or status filter.'}
              </p>
              {auth.role !== 'student' && applications.length === 0 && (
                <button className="btn-primary app-primary-action" onClick={openApplicationForm}>
                  <IconPlus />
                  <span>Add Application</span>
                </button>
              )}
            </div>
          ) : (
            <AppliedProgramsTableView
              applications={filteredApplications}
              totalApplications={applications.length}
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
        <Modal title="Add New Application" onClose={closeApplicationForm}>
          <div className="application-form-intro">
            <strong>Application Details</strong>
            <span>Select the student and university, then capture the program and fee details.</span>
          </div>

          <form className="form-grid application-form-grid" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Student</span>
              <select
                className="field-select"
                value={form.student_id || selectedStudentId || ''}
                onChange={(e) => update('student_id', e.target.value)}
                required
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {getStudentName(student)} ({student.email})
                  </option>
                ))}
              </select>
            </label>

            <div className="field application-university-field">
              <div className="field-label-row">
                <span className="field-label">University</span>
                {auth.role !== 'student' && (
                  <button
                    type="button"
                    className="inline-tool-btn"
                    onClick={() => setShowUniversityForm(true)}
                  >
                    <IconPlus />
                    <span>Add</span>
                  </button>
                )}
              </div>
              <select
                className="field-select"
                value={form.university_id}
                onChange={(e) => update('university_id', e.target.value)}
                required
              >
                <option value="">
                  {universities.length ? 'Select university' : 'No universities added yet'}
                </option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </select>
            </div>

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
              placeholder="2026"
              min="1900"
              max="2200"
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
              min="0"
              step="0.01"
              value={form.tuition_fee}
              onChange={(e) => update('tuition_fee', e.target.value)}
            />

            <TextInput
              label="Currency"
              value={form.currency}
              onChange={(e) => update('currency', e.target.value.toUpperCase())}
              maxLength="3"
            />

            <TextInput
              label="Application Fee"
              type="number"
              min="0"
              step="0.01"
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
              <button type="button" className="btn-outline" onClick={closeApplicationForm}>
                Cancel
              </button>
              <button className="btn-primary app-primary-action" disabled={submitting}>
                {submitting ? (
                  'Creating...'
                ) : (
                  <>
                    <IconCheck />
                    <span>Create Application</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showUniversityForm && (
        <Modal title="Add University" onClose={() => setShowUniversityForm(false)}>
          <div className="application-form-intro">
            <strong>University Details</strong>
            <span>This will be available immediately in the application form.</span>
          </div>

          <form className="form-grid application-form-grid" onSubmit={submitUniversity}>
            <TextInput
              label="University Name"
              value={universityForm.name}
              onChange={(e) => updateUniversity('name', e.target.value)}
              required
            />

            <TextInput
              label="Country"
              value={universityForm.country}
              onChange={(e) => updateUniversity('country', e.target.value)}
              required
            />

            <TextInput
              label="City"
              value={universityForm.city}
              onChange={(e) => updateUniversity('city', e.target.value)}
            />

            <label className="field">
              <span className="field-label">Partner Type</span>
              <select
                className="field-select"
                value={universityForm.category}
                onChange={(e) => updateUniversity('category', e.target.value)}
                required
              >
                {UNIVERSITY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {formatLabel(category)}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-actions field-full">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowUniversityForm(false)}
              >
                Cancel
              </button>

              <button className="btn-primary app-primary-action" disabled={universitySubmitting}>
                {universitySubmitting ? (
                  'Saving...'
                ) : (
                  <>
                    <IconCheck />
                    <span>Add University</span>
                  </>
                )}
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
  totalApplications,
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
    students.forEach((student) => {
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
              <th>ACK No.</th>
              <th>Date Created</th>
              <th>Student</th>
              <th>LS Assignee</th>
              <th>University</th>
              <th>Program</th>
              <th>Intake</th>
              <th>Created By</th>
              <th>Status</th>
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
                      onClick={(e) => {
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

                  <td className="table-date-cell">{formatCreatedAt(app.created_at)}</td>

                  <td>
                    <div className="table-primary-cell">
                      <span className="cell-title">{getStudentName(student)}</span>
                      <span className="cell-subtitle">{student?.email || '-'}</span>
                    </div>
                  </td>
                  <td>{getLsAssigneeName(student)}</td>
                  <td>
                    <div className="table-primary-cell">
                      <span className="cell-title">{app.university?.name || '-'}</span>
                      <span className="cell-subtitle">{app.university?.country || '-'}</span>
                    </div>
                  </td>

                  <td>
                    <div className="table-primary-cell">
                      <span className="cell-title">{app.course_name || '-'}</span>
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
                        aria-label={`Delete application ${buildAckNo(app)}`}
                        title="Delete application"
                      >
                        {isDeleting ? (
                          'Deleting...'
                        ) : (
                          <>
                            <IconTrash />
                            <span>Delete</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="table-action-placeholder">-</span>
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
        total={totalApplications}
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

function getInitialApplicationForm(studentId = '') {
  return {
    student_id: studentId || '',
    university_id: '',
    course_name: '',
    intake_month: '',
    intake_year: '',
    application_deadline: '',
    tuition_fee: '',
    currency: 'USD',
    application_fee: '',
    notes: '',
  };
}

function getInitialUniversityForm() {
  return {
    name: '',
    country: '',
    city: '',
    category: 'global',
  };
}

function buildApplicationStats(applications) {
  const list = applications || [];
  const activeStatuses = new Set([
    'initiated',
    'pending_from_student',
    'pending_from_ls',
    'application_on_hold',
    'funds_approved',
    'deferral',
    'fee_paid',
    'tuition_payment_not_done',
  ]);
  const offerStatuses = new Set(['conditional_offer', 'unconditional_offer', 'offer_accepted']);
  const visaStatuses = new Set(['visa_applied', 'visa_approved', 'visa_rejected']);

  const active = list.filter((app) => activeStatuses.has(normalizeStatus(app.application_status))).length;
  const offers = list.filter((app) => offerStatuses.has(normalizeStatus(app.application_status))).length;
  const visa = list.filter((app) => visaStatuses.has(normalizeStatus(app.application_status))).length;

  return [
    {
      label: 'Total Applications',
      value: list.length,
      helper: 'All tracked programs',
      tone: 'neutral',
    },
    {
      label: 'Active Pipeline',
      value: active,
      helper: 'In progress now',
      tone: 'blue',
    },
    {
      label: 'Offers',
      value: offers,
      helper: 'Conditional or accepted',
      tone: 'green',
    },
    {
      label: 'Visa Stage',
      value: visa,
      helper: 'Visa activity',
      tone: 'orange',
    },
  ];
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase();
}

function getStudentName(student) {
  if (!student) return '-';
  const fullName = [student.first_name, student.last_name].filter(Boolean).join(' ').trim();
  return fullName || student.email || '-';
}

function getLsAssigneeName(student) {
  if (!student) return '-';

  return (
    student.counsellor_name ||
    student.counsellor?.full_name ||
    student.assigned_counsellor_name ||
    '-'
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
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatIntake(month, year) {
  const text = [month, year].filter(Boolean).join(' ').trim();
  return text || '-';
}

function getCreatedByLabel(app, auth) {
  if (auth?.role === 'student') return 'Student';
  if (auth?.role === 'admin') return 'Admin';
  if (auth?.role === 'counsellor') return 'Counsellor';
  return '-';
}

function clampText(value, limit = 40) {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function getStatusColor(status) {
  const map = {
    accepted: 'green',
    unconditional_offer: 'green',
    offer_accepted: 'green',
    visa_approved: 'green',
    funds_approved: 'green',
    rejected: 'red',
    withdrawn: 'gray',
    visa_rejected: 'red',
    under_review: 'orange',
    conditional_offer: 'orange',
    waitlisted: 'orange',
    application_on_hold: 'orange',
    deferral: 'orange',
    pending_from_student: 'orange',
    pending_from_ls: 'orange',
    applied: 'blue',
    shortlisted: 'blue',
    initiated: 'blue',
    fee_paid: 'blue',
    visa_applied: 'blue',
  };

  return map[normalizeStatus(status)] || 'gray';
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-9 0 1 16h8l1-16" />
    </svg>
  );
}

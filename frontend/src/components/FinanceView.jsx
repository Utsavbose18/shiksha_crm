import { useState, useEffect, useRef, useCallback } from 'react';
import { SectionCard, Badge, TextInput, TextArea, Modal } from './UI';
import {
  formatDate,
  formatLabel,
  formatCurrency,
  apiFetch,
  PAYMENT_STATUSES,
  API_BASE_URL,
  storage,
} from '../utils';

const PAYMENT_TYPES = [
  'IELTS', 'TOEFL', 'Duolingo', 'GRE', 'GMAT',
  'French', 'German', 'Japanese','DMIT',
  'visa_fee', 'service_fee', 'accommodation', 'forex', 'other',
];

const PAYMENT_MODES = ['bank transfers', 'UPI', 'Cheque'];
const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'NZD', 'SGD'];
const PAGE_SIZE = 15;

const EMPTY_FORM = {
  student_type: 'registered',
  student_id: '',
  manual_student_name: '',
  application_id: '',
  amount: '',
  paid_amount: '',
  currency: 'INR',
  payment_type: '',
  payment_mode: '',
  due_date: '',
  status: 'pending',
  payment_date: new Date().toISOString().slice(0, 10),
  reference: '',
  notes: '',
};

// ── Student Type Toggle ───────────────────────────────────────────────────────
function StudentTypeToggle({ value, onChange }) {
  return (
    <div
      className="field-full"
      style={{
        display: 'flex',
        gap: 0,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--sap-border, #e2e8f0)',
        width: 'fit-content',
        marginBottom: 4,
      }}
    >
      {[
        { key: 'registered', label: '🎓 Registered Student' },
        { key: 'walkin',     label: '🚶 Walk-in / Manual' },
      ].map(opt => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          style={{
            padding: '7px 18px',
            fontSize: 13,
            fontWeight: value === opt.key ? 700 : 400,
            cursor: 'pointer',
            border: 'none',
            background: value === opt.key
              ? 'var(--sap-brand, #0070f3)'
              : 'var(--color-background-secondary, #f8fafc)',
            color: value === opt.key ? '#fff' : 'var(--color-text-secondary, #64748b)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Invoice Download ──────────────────────────────────────────────────────────
async function downloadInvoicePDF(paymentId, setError) {
  try {
    const token = storage.token || localStorage.getItem('access_token');
    if (!token) { alert('Please login again'); return; }

    const response = await fetch(`${API_BASE_URL}/api/payments/${paymentId}/invoice`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      localStorage.removeItem('access_token');
      alert('Session expired. Please login again.');
      window.location.href = '/login';
      return;
    }

    if (!response.ok) {
      let detail = `Download failed (${response.status})`;
      try { const e = await response.json(); detail = e.detail || detail; } catch {}
      throw new Error(detail);
    }

    const blob = await response.blob();
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;

    const cd    = response.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    a.download  = match ? match[1].replace(/['"]/g, '') : `Invoice_${paymentId}.pdf`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Invoice download error:', err);
    if (setError) setError(err.message || 'Invoice download failed');
    else alert(`Invoice download failed: ${err.message}`);
  }
}

// ── Invoice Button ────────────────────────────────────────────────────────────
function InvoiceButton({ payment, students, setGlobalError }) {
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  async function handleDownload() {
    setLoading(true);
    await downloadInvoicePDF(payment.id, setGlobalError);
    setLoading(false);
  }

  const studentName = payment.manual_student_name || (() => {
     const s = (students||[]).find(x => String(x.id) === String(payment.student_id));
     return s ? `${s.first_name} ${s.last_name}` : `Student #${payment.student_id}`;
  })();

  return (
    <>
      <button
        title="Preview & Actions"
        onClick={() => setShowPreview(true)}
        disabled={loading}
        style={{
          background: loading ? '#d1fae5' : '#ecfdf5',
          border: '1px solid #10b981',
          borderRadius: 6,
          padding: '5px 9px',
          cursor: loading ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: '#059669',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '⏳' : '📄'} {loading ? 'Wait...' : 'Invoice'}
      </button>

      {showPreview && (
          <Modal title={`Invoice Preview (#${payment.id})`} onClose={() => setShowPreview(false)}>
             <div className="p-4 bg-gray-50 border rounded-lg mb-4 text-sm font-mono whitespace-pre-wrap leading-relaxed relative text-gray-800">
               <div><strong>Student:</strong> {studentName}</div>
               <div><strong>Service:</strong> {formatLabel(payment.payment_type)}</div>
               <div><strong>Amount:</strong> {formatCurrency(payment.amount, payment.currency)}</div>
               <div><strong>Paid:</strong> {formatCurrency(payment.paid_amount || 0, payment.currency)}</div>
               <div><strong>Status:</strong> {formatLabel(payment.status)}</div>
               <div><strong>Date:</strong> {formatDate(payment.payment_date)}</div>
               {payment.reference && <div><strong>Reference:</strong> {payment.reference}</div>}
             </div>
             <div className="flex gap-2 justify-end">
                <button
                  onClick={handleDownload} disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-blue-700 transition"
                >
                  {loading ? 'Generating...' : '📥 Download PDF'}
                </button>
             </div>
          </Modal>
      )}
    </>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ payment, students, onClose, onSaved, setGlobalError }) {
  const isEdit = !!payment;

  const initStudentType = isEdit
    ? (payment.manual_student_name ? 'walkin' : 'registered')
    : 'registered';

  const [form, setForm] = useState(
    isEdit
      ? {
          student_type:        initStudentType,
          student_id:          String(payment.student_id || ''),
          manual_student_name: payment.manual_student_name || '',
          amount:              String(payment.amount || ''),
          paid_amount:         String(payment.paid_amount || ''),
          currency:            payment.currency || 'INR',
          payment_type:        payment.payment_type || '',
          payment_mode:        payment.payment_mode || '',
          status:              payment.status || 'pending',
          payment_date:        payment.payment_date ? payment.payment_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          due_date:            payment.due_date ? payment.due_date.slice(0, 10) : '',
          reference:           payment.reference || '',
          notes:               payment.notes || '',
        }
      : { ...EMPTY_FORM }
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const isPartial   = form.status === 'partial';
  const isWalkin    = form.student_type === 'walkin';
  const totalAmount = parseFloat(form.amount) || 0;
  const paidAmount  = parseFloat(form.paid_amount) || 0;
  const pendingAmt  = isPartial ? Math.max(0, totalAmount - paidAmount) : 0;

  function update(field, value) {
    if (field === 'student_type') {
      setForm(p => ({
        ...p,
        student_type:        value,
        student_id:          value === 'registered' ? p.student_id : '',
        manual_student_name: value === 'walkin'     ? p.manual_student_name : '',
      }));
    } else {
      setForm(p => ({ ...p, [field]: value }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isEdit) {
      if (isWalkin && !form.manual_student_name.trim()) {
        setError('Please enter the student / client name.'); return;
      }
      if (!isWalkin && !form.student_id) {
        setError('Please select a registered student.'); return;
      }
      if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
        setError('Please enter a valid total amount.'); return;
      }
      if (!form.payment_type) {
        setError('Please select a payment type.'); return;
      }
    }

    if (isPartial) {
      if (!form.paid_amount || isNaN(Number(form.paid_amount)) || Number(form.paid_amount) <= 0) {
        setError('Please enter the amount already paid.'); return;
      }
      if (Number(form.paid_amount) >= Number(form.amount)) {
        setError('Paid amount must be less than total amount for partial status.'); return;
      }
    }

    setSubmitting(true);
    try {
      let savedId;

      if (isEdit) {
        // const patchPayload = {
        //   status:       form.status,
        //   payment_date: form.payment_date || null,
        //   reference:    form.reference    || null,
        //   payment_mode: form.payment_mode || null,
        //   paid_amount:  form.status === 'done' ? Number(form.amount) : form.status === 'partial' ? Number(form.paid_amount) : 0,
        //   notes:        form.notes        || null,
        //   due_date:     form.due_date     || null,
        // };
        // if (payment.manual_student_name) {
        //   patchPayload.manual_student_name = form.manual_student_name || null;
        // }

        const patchPayload = {
        status:       form.status,
        payment_date: form.payment_date || null,
        reference:    form.reference    || null,
        payment_mode: form.payment_mode || null,
        notes:        form.notes        || null,
        due_date:     form.due_date     || null,
      };

      // Only include paid_amount when status is done or partial
      if (form.status === 'done') {
        patchPayload.paid_amount = Number(form.amount);
      } else if (form.status === 'partial') {
        patchPayload.paid_amount = Number(form.paid_amount);
      }
      // pending → don't send paid_amount at all, backend keeps existing value

      if (payment.manual_student_name) {
        patchPayload.manual_student_name = form.manual_student_name || null;
      }
        await apiFetch(`/api/payments/${payment.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload),
        });
        savedId = payment.id;
      } else {
        const createPayload = {
          student_id:          isWalkin ? null : Number(form.student_id),
          manual_student_name: isWalkin ? form.manual_student_name.trim() : null,
          amount:              Number(form.amount),
          paid_amount:         form.status === 'done' ? Number(form.amount) : form.status === 'partial' ? Number(form.paid_amount) : 0,
          currency:            form.currency,
          payment_type:        form.payment_type,
          payment_mode:        form.payment_mode || null,
          status:              form.status,
          payment_date:        form.payment_date || null,
          due_date:            form.due_date     || null,
          reference:           form.reference    || null,
          notes:               form.notes        || null,
        };
        const created = await apiFetch('/api/payments/', {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });
        savedId = created?.id;
      }

      onSaved();

      if ((form.status === 'done' || form.status === 'partial') && savedId) {
        setTimeout(() => downloadInvoicePDF(savedId, setGlobalError), 700);
      }
    } catch (err) {
      setError(err.message || 'Failed to save payment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit Payment #${payment.id}` : 'Record Payment'} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-error field-full" style={{ marginBottom: 0 }}>{error}</div>
        )}

        {!isEdit && (
          <div className="field-full" style={{ marginBottom: 2 }}>
            <span className="field-label" style={{ display: 'block', marginBottom: 6 }}>Student Type *</span>
            <StudentTypeToggle value={form.student_type} onChange={v => update('student_type', v)} />
          </div>
        )}

        {!isEdit && !isWalkin && (
          <label className="field">
            <span className="field-label">Registered Student *</span>
            <select
              className="field-select"
              value={form.student_id}
              onChange={e => update('student_id', e.target.value)}
              required
            >
              <option value="">Select student</option>
              {(students || []).map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.email})
                </option>
              ))}
            </select>
          </label>
        )}

        {!isEdit && isWalkin && (
          <label className="field">
            <span className="field-label">Client / Student Name *</span>
            <input
              className="field-input"
              type="text"
              value={form.manual_student_name}
              onChange={e => update('manual_student_name', e.target.value)}
              placeholder="e.g. Rahul Sharma"
              required
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #94a3b8)', marginTop: 3 }}>
              This client is not registered in the system.
            </span>
          </label>
        )}

        {isEdit && (
          <label className="field field-full">
            <span className="field-label">Student</span>
            <input
              className="field-input"
              type="text"
              value={
                payment.manual_student_name
                  ? `${payment.manual_student_name} (Walk-in)`
                  : (() => {
                      const s = (students || []).find(st => String(st.id) === String(payment.student_id));
                      return s ? `${s.first_name} ${s.last_name}` : `Student #${payment.student_id}`;
                    })()
              }
              readOnly
              style={{ background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', cursor: 'not-allowed' }}
            />
          </label>
        )}

        {!isEdit && (
          <label className="field">
            <span className="field-label">Service Type *</span>
            <select
              className="field-select"
              value={form.payment_type}
              onChange={e => update('payment_type', e.target.value)}
              required
            >
              <option value="">Select type</option>
              {PAYMENT_TYPES.map(t => (
                <option key={t} value={t}>{formatLabel(t)}</option>
              ))}
            </select>
          </label>
        )}

        {!isEdit && (
          <>
            <TextInput
              label="Total Amount *"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={e => update('amount', e.target.value)}
              required
            />
            <label className="field">
              <span className="field-label">Currency</span>
              <select className="field-select" value={form.currency} onChange={e => update('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </>
        )}

        <label className="field">
          <span className="field-label">Status</span>
          <select className="field-select" value={form.status} onChange={e => update('status', e.target.value)}>
            {PAYMENT_STATUSES.map(s => (
              <option key={s} value={s}>{s === 'done' ? 'Paid' : formatLabel(s)}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Payment Mode</span>
          <select className="field-select" value={form.payment_mode} onChange={e => update('payment_mode', e.target.value)}>
            <option value="">Select mode</option>
            {PAYMENT_MODES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        {isPartial && (
          <div className="field-full" style={{
            background: 'var(--color-background-warning, #fffbeb)',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}>
            <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 500, color: '#92400e', marginBottom: 2 }}>
              Partial payment breakdown
            </div>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Amount Paid *</span>
              <input
                className="field-input"
                type="number"
                min="0"
                step="0.01"
                value={form.paid_amount}
                onChange={e => update('paid_amount', e.target.value)}
                placeholder="0.00"
                required
              />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Pending Amount</span>
              <input
                className="field-input"
                type="text"
                value={totalAmount > 0 && paidAmount > 0 ? pendingAmt.toFixed(2) : '—'}
                readOnly
                style={{ background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', cursor: 'not-allowed' }}
              />
            </label>
            {totalAmount > 0 && paidAmount > 0 && paidAmount < totalAmount && (
              <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                <div style={{ height: 6, borderRadius: 4, background: '#fde68a', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.min(100, (paidAmount / totalAmount) * 100).toFixed(1)}%`,
                    background: '#16a34a', borderRadius: 4, transition: 'width 0.2s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#92400e', marginTop: 4 }}>
                  <span style={{ color: '#16a34a', fontWeight: 500 }}>Paid: {((paidAmount / totalAmount) * 100).toFixed(0)}%</span>
                  <span style={{ fontWeight: 500 }}>Pending: {((pendingAmt / totalAmount) * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {(form.status === 'done' || form.status === 'partial') && (
          <div className="field-full" style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#166534',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>📄</span>
            <span>Invoice PDF will be <b>automatically generated and downloaded</b> when you save.</span>
          </div>
        )}

        <TextInput
          label="Payment Date"
          type="date"
          value={form.payment_date}
          onChange={e => update('payment_date', e.target.value)}
        />
        <TextInput
          label="Due Date"
          type="date"
          value={form.due_date}
          onChange={e => update('due_date', e.target.value)}
        />

        <TextInput
          label="Transaction ID"
          value={form.reference}
          onChange={e => update('reference', e.target.value)}
          placeholder="UTR / Receipt No."
        />

        <TextArea
          label="Notes"
          rows={2}
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="Any additional notes..."
        />

        <div className="form-actions field-full">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update Payment' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ payment, onClose, onDeleted, setGlobalError }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/payments/${payment.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setGlobalError(err.message);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal title="Delete Payment" onClose={onClose}>
      <div style={{ padding: '0.5rem 0 1.25rem' }}>
        <p style={{ color: 'var(--sap-text)', marginBottom: '0.5rem' }}>
          Are you sure you want to delete this payment record?
        </p>
        <div style={{
          background: 'var(--sap-negative-light, #fef2f2)', border: '1px solid #f5b5b5',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--sap-negative, #dc2626)',
        }}>
          <strong>{formatCurrency(payment.amount, payment.currency)}</strong>
          {' — '}
          {formatLabel(payment.payment_type)}
          {payment.reference ? ` (Ref: ${payment.reference})` : ''}
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>This action cannot be undone.</p>
      </div>
      <div className="form-actions field-full">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          style={{ background: 'var(--sap-negative, #dc2626)', borderColor: 'var(--sap-negative, #dc2626)' }}
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting...' : 'Yes, Delete'}
        </button>
      </div>
    </Modal>
  );
}

// ── Finance Summary Cards ─────────────────────────────────────────────────────
function FinanceSummary({ payments }) {
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const received = payments.reduce((sum, p) => {
    if (p.status === 'done') return sum + Number(p.amount || 0);
    if (p.status === 'partial') return sum + Number(p.paid_amount || 0);
    return sum;
  }, 0);

  const pendingAmount = payments.reduce((sum, p) => {
    if (p.status === 'pending') return sum + Number(p.amount || 0);
    if (p.status === 'partial')
      return sum + (Number(p.amount || 0) - Number(p.paid_amount || 0));
    return sum;
  }, 0);

  const cards = [
    { label: 'Total Recorded', value: formatCurrency(total),         color: '#4338ca', bg: '#eef2ff' },
    { label: 'Received',       value: formatCurrency(received),      color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Pending',        value: formatCurrency(pendingAmount),  color: '#d97706', bg: '#fffbeb' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}22`, borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            {c.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Partial Amount Cell ───────────────────────────────────────────────────────
function PartialAmountCell({ payment }) {
  const total   = Number(payment.amount     || 0);
  const paid    = Number(payment.paid_amount || 0);
  const pending = Math.max(0, total - paid);
  const pct     = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
        {formatCurrency(total, payment.currency)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 11, marginBottom: 5 }}>
        <span style={{ color: '#16a34a', fontWeight: 500 }}>Paid: {formatCurrency(paid, payment.currency)}</span>
        <span style={{ color: '#d97706', fontWeight: 500 }}>Due: {formatCurrency(pending, payment.currency)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: '#fde68a', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct.toFixed(1)}%`,
          background: '#16a34a', borderRadius: 3,
        }} />
      </div>
    </div>
  );
}

// ── Due Date Cell ─────────────────────────────────────────────────────────────
function DueDateCell({ dueDate }) {
  if (!dueDate) return '—';

  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);

  if (isNaN(due.getTime())) return '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diff < 0)  return ` Overdue (${formatDate(dueDate)})`;
  if (diff === 0) return ' Today';
  if (diff === 1) return ' Tomorrow';
  if (diff <= 7)  return ` In ${diff} days`;
  return ` ${formatDate(dueDate)}`;
}

// ── Pagination Controls ───────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * PAGE_SIZE + 1;
  const endItem   = Math.min(currentPage * PAGE_SIZE, totalItems);

  // Build page number array with ellipsis logic
  function getPageNumbers() {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end   = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  const btnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    transition: 'all 0.15s',
    userSelect: 'none',
  };

  const btnActive = {
    ...btnBase,
    background: 'var(--sap-brand, #0070f3)',
    borderColor: 'var(--sap-brand, #0070f3)',
    color: '#fff',
    fontWeight: 700,
  };

  const btnDisabled = {
    ...btnBase,
    opacity: 0.4,
    cursor: 'not-allowed',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 16,
      paddingTop: 14,
      borderTop: '1px solid #f1f5f9',
    }}>
      {/* Info text */}
      <span style={{ fontSize: 12, color: '#6b7280' }}>
        Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> entries
      </span>

      {/* Page buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* ← Prev arrow */}
        <button
          style={currentPage === 1 ? btnDisabled : btnBase}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous page"
        >
          {/* Left chevron SVG */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, idx) =>
          page === '...'
            ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#9ca3af', fontSize: 13 }}>…</span>
            )
            : (
              <button
                key={page}
                style={page === currentPage ? btnActive : btnBase}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            )
        )}

        {/* → Next arrow */}
        <button
          style={currentPage === totalPages ? btnDisabled : btnBase}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Next page"
        >
          {/* Right chevron SVG */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main Finance View ─────────────────────────────────────────────────────────
export function FinanceView({ students, setGlobalError }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(false);

  const [filterStudentName, setFilterStudentName] = useState('');
  const [filterStatus,      setFilterStatus]      = useState('');

  // ── Pagination state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreate,    setShowCreate]    = useState(false);
  const [editPayment,   setEditPayment]   = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);

  const debounceRef   = useRef(null);
  const isFirstRender = useRef(true);

  // ── Computed pagination values ────────────────────────────────────────────
  const totalPages   = Math.ceil(payments.length / PAGE_SIZE);
  const pagedPayments = payments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 whenever filters or payments change
  function resetPage() { setCurrentPage(1); }

  // ── Load payments ─────────────────────────────────────────────────────────
  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStudentName.trim()) params.set('student_name', filterStudentName.trim());
      if (filterStatus)             params.set('status', filterStatus);
      const q    = params.toString() ? `?${params}` : '';
      const data = await apiFetch(`/api/payments/${q}`);

      if (Array.isArray(data)) {
        setPayments(data);
      } else if (data && typeof data === 'object') {
        const arr = data.items || data.payments || data.results || [];
        setPayments(Array.isArray(arr) ? arr : []);
      } else {
        setPayments([]);
      }
      resetPage(); // always go back to page 1 on fresh load
    } catch (err) {
      setGlobalError(err.message);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [filterStudentName, filterStatus]);

  useEffect(() => { loadPayments(); }, []);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadPayments, 300);
    return () => clearTimeout(debounceRef.current);
  }, [filterStudentName, filterStatus]);

  function handleSaved()   { setShowCreate(false); setEditPayment(null); loadPayments(); }
  function handleDeleted() { setDeletePayment(null); loadPayments(); }

  function resolveStudentName(payment) {
    if (payment.manual_student_name) {
      return (
        <span>
          {payment.manual_student_name}
          <span style={{
            marginLeft: 5, fontSize: 10, fontWeight: 600,
            background: '#fef9c3', color: '#854d0e',
            border: '1px solid #fde047', borderRadius: 4,
            padding: '1px 5px', verticalAlign: 'middle',
          }}>
            Walk-in
          </span>
        </span>
      );
    }
    const s = (students || []).find(st => String(st.id) === String(payment.student_id));
    return s ? `${s.first_name} ${s.last_name}` : `#${payment.student_id}`;
  }

  return (
    <div className="view-stack">
      <SectionCard
        title="Finance"
        subtitle="Track payments — fees, deposits, and disbursements"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Record Payment
          </button>
        }
      >
        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 240, marginBottom: 0 }}>
            <span className="field-label">Search by Student Name</span>
            <div style={{ position: 'relative' }}>
              <input
                className="field-input"
                type="text"
                placeholder="Type a name…"
                value={filterStudentName}
                onChange={e => setFilterStudentName(e.target.value)}
                style={{ paddingLeft: 32 }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary, #94a3b8)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {filterStudentName && (
                <button type="button" onClick={() => setFilterStudentName('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary, #94a3b8)', fontSize: 14, lineHeight: 1, padding: 0 }}
                  title="Clear">✕</button>
              )}
            </div>
          </label>

          <label className="field" style={{ minWidth: 160, marginBottom: 0 }}>
            <span className="field-label">Filter by Status</span>
            <select className="field-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {PAYMENT_STATUSES.map(s => (
                <option key={s} value={s}>{s === 'done' ? 'Paid' : formatLabel(s)}</option>
              ))}
            </select>
          </label>

          {(filterStudentName || filterStatus) && (
            <button className="btn-outline" style={{ alignSelf: 'flex-end', fontSize: 12 }}
              onClick={() => { setFilterStudentName(''); setFilterStatus(''); }}>
              Clear Filters
            </button>
          )}
        </div>

        {/* ── Summary cards (always computed over ALL payments, not just current page) ── */}
        {payments.length > 0 && <FinanceSummary payments={payments} />}

        {/* ── Table meta row ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          fontSize: 12,
          color: '#6b7280',
        }}>
          <div>
            {payments.length > 0 && (
              <span>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                {' '}·{' '}
                <strong>{payments.length}</strong> total record{payments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {PAGE_SIZE} rows per page
          </div>
        </div>

        {/* ── Table ── */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Service Type</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Mode</th>
                <th>Transaction ID</th>
                <th>Notes</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="11" className="text-center text-muted" style={{ padding: '2rem' }}>Loading...</td>
                </tr>
              )}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan="11" className="text-center text-muted" style={{ padding: '2rem' }}>No payments found</td>
                </tr>
              )}
              {!loading && pagedPayments.map(p => (
                <tr key={p.id}>
                  <td className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.id}</td>
                  <td style={{ fontWeight: 500 }}>{resolveStudentName(p)}</td>
                  <td>{formatLabel(p.payment_type)}</td>
                  <td><DueDateCell dueDate={p.due_date} /></td>
                  <td>
                    {p.status === 'partial' && p.paid_amount != null
                      ? <PartialAmountCell payment={p} />
                      : <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.amount, p.currency)}</span>
                    }
                  </td>
                  <td><Badge value={p.status === 'done' ? 'paid' : p.status} /></td>
                  <td className="text-muted">{formatDate(p.payment_date)}</td>
                  <td className="text-muted">{p.payment_mode || '—'}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{p.reference || '—'}</td>
                  <td className="text-muted" style={{ fontSize: 12, maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4' }}>
                    {p.notes || '—'}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {(p.status === 'done' || p.status === 'partial') && (
                        <InvoiceButton payment={p} students={students} setGlobalError={setGlobalError} />
                      )}
                      <button
                        title="Edit payment"
                        onClick={() => setEditPayment(p)}
                        style={{ background: 'var(--sap-brand-light)', border: '1px solid var(--sap-brand-mid)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--sap-brand)', fontSize: 12, fontWeight: 600 }}
                      >
                        Edit
                      </button>
                      <button
                        title="Delete payment"
                        onClick={() => setDeletePayment(p)}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #f5b5b5',
                          borderRadius: 6,
                          padding: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#dc2626',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={payments.length}
          onPageChange={setCurrentPage}
        />
      </SectionCard>

      {showCreate && (
        <PaymentModal
          payment={null}
          students={students}
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
          setGlobalError={setGlobalError}
        />
      )}

      {editPayment && (
        <PaymentModal
          payment={editPayment}
          students={students}
          onClose={() => setEditPayment(null)}
          onSaved={handleSaved}
          setGlobalError={setGlobalError}
        />
      )}

      {deletePayment && (
        <DeleteConfirmModal
          payment={deletePayment}
          onClose={() => setDeletePayment(null)}
          onDeleted={handleDeleted}
          setGlobalError={setGlobalError}
        />
      )}
    </div>
  );
}

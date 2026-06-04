import React, { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';

const API_BASE = import.meta.env.VITE_API_URL;
import { apiFetch, formatLabel, formatDate, formatDateTime } from '../utils';
import StudentNotesSection from './StudentNotesSection';


// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#f0f2f8', surface: '#ffffff', surfaceAlt: '#f8f9fc',
  border: '#e2e8f2', borderStrong: '#c8d3e8',
  accent: '#4f46e5', accentHover: '#4338ca', accentLight: '#eef2ff', accentMid: '#c7d2fe',
  red: '#dc2626', redLight: '#fef2f2',
  amber: '#d97706', amberLight: '#fffbeb',
  green: '#059669', greenLight: '#ecfdf5',
  blue: '#0284c7', blueLight: '#e0f2fe',
  text: '#0f172a', textMid: '#374151', textLight: '#6b7280', muted: '#9ca3af',
};

// ─── ACK HELPERS (mirrored from ApplicationsView) ─────────────────────────────
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
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── INTAKE OPTIONS ───────────────────────────────────────────────────────────
const intakeMonthOptions = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const currentYearForIntake = new Date().getFullYear();
const intakeYearOptions = Array.from({ length: 6 }, (_, i) => String(currentYearForIntake + i));

// ─── VALIDATION HELPERS ─────────────────────────────────────────────

const isValidPhone = (val) => !val || /^[0-9]{10}$/.test(val);
const isValidPincode = (val) => !val || /^[0-9]+$/.test(val);
const isValidEmail = (val) => !val || /^[^\s@]+@[^\s@]+\.com$/.test(val);
const isNotFutureDate = (date) => { if (!date) return true; return new Date(date) <= new Date(); };
const isEndAfterStart = (start, end) => { if (!start || !end) return true; return new Date(end) > new Date(start); };
const isEndYearAfterStart = (startYear, endYear) => { if (!startYear || !endYear) return true; return parseInt(endYear) >= parseInt(startYear); };
const isValidScore = (val, min, max) => {
  if (val === '' || val === null || val === undefined) return true;
  const num = Number(val);
  if (isNaN(num)) return false;
  if (min != null && num < min) return false;
  if (max != null && num > max) return false;
  return true;
};

// ─── FIELD ────────────────────────────────────────────────────────────────────
const Field = React.memo(function Field({ label, full, span, value, onChange, validate, errorMsg, type = 'text', options, required, disabled, placeholder, hint, min, max, step }) {
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const base = {
    fontSize: 13, padding: '9px 12px',
    background: disabled ? C.surfaceAlt : '#fff',
    border: `1.5px solid ${error ? C.red : focused ? C.accent : C.border}`,
    borderRadius: 8, width: '100%', boxSizing: 'border-box',
    outline: 'none', color: disabled ? C.textLight : C.text,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: focused ? `0 0 0 3px ${error ? '#fef2f2' : C.accentLight}` : 'none',
    cursor: disabled ? 'not-allowed' : 'auto',
  };
  const colSpan = full ? '1 / -1' : span ? `span ${span}` : undefined;

  const handleChange = (e) => {
    const val = e.target.value;
    if (validate) {
      const valid = validate(val);
      setError(valid ? '' : errorMsg || 'Invalid input');
    }
    onChange(val);
  };

  return (
    <div style={{ gridColumn: colSpan, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', gap: 4, alignItems: 'center' }}>
        {label}{required && <span style={{ color: C.red }}>*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea value={value || ''} onChange={handleChange} placeholder={placeholder || `Enter ${label.toLowerCase()}`} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...base, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }} />
      ) : options ? (
        <select value={value || ''} onChange={handleChange} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...base, cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <option value="">— Select —</option>
          {options.map(o => typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} defaultValue={value ?? ''} onChange={handleChange}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          min={min} max={max} step={step} style={base} />
      )}
      {hint && <div style={{ fontSize: 11, color: C.muted }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>{error}</div>}
    </div>
  );
});

// ─── AUTOFILL-AWARE FIELD ─────────────────────────────────────────────────────
function AutofillField({ label, full, span, value, onChange, type = 'text', options, required, disabled, placeholder, hint, validate, errorMsg, min, max, step }) {
  const prevValueRef = useRef(value);
  const [mountKey, setMountKey] = useState(0);
  useEffect(() => {
    if (value !== prevValueRef.current) { prevValueRef.current = value; setMountKey(k => k + 1); }
  }, [value]);
  return (
    <Field key={mountKey} label={label} full={full} span={span} value={value}
      onChange={(v) => { prevValueRef.current = v; onChange(v); }}
      type={type} options={options} required={required} disabled={disabled}
      placeholder={placeholder} hint={hint} validate={validate} errorMsg={errorMsg} min={min} max={max} step={step} />
  );
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────
function SectionCard({ id, sectionRef, icon, title, badge, badgeColor, children, action }) {
  const colors = {
    red: { bg: C.redLight, text: C.red }, amber: { bg: C.amberLight, text: C.amber },
    green: { bg: C.greenLight, text: C.green }, blue: { bg: C.blueLight, text: C.blue },
  };
  const bc = colors[badgeColor] || colors.blue;
  return (
    <div ref={sectionRef} id={id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', scrollMarginTop: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</span>
        {badge && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: bc.text, background: bc.bg, padding: '3px 10px', borderRadius: 20 }}>{badge}</span>}
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── SIDE NAV ─────────────────────────────────────────────────────────────────
function SideNav({ sections, activeSection, onNav }) {
  return (
    <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 90, alignSelf: 'flex-start' }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Navigate</div>
        {sections.map(s => (
          <button key={s.id} onClick={() => onNav(s.id)}
            style={{ width: '100%', background: activeSection === s.id ? C.accentLight : 'transparent', border: 'none', borderLeft: `3px solid ${activeSection === s.id ? C.accent : 'transparent'}`, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: activeSection === s.id ? C.accent : C.textMid }}>{s.title}</span>
            {s.dot === 'red' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} />}
            {s.dot === 'amber' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />}
            {s.dot === 'green' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const colors = {
    success: { bg: C.greenLight, color: C.green, border: '#a7f3d0' },
    error: { bg: C.redLight, color: C.red, border: '#fecaca' },
    info: { bg: C.accentLight, color: C.accent, border: C.accentMid },
  };
  const c = colors[toast.type] || colors.info;
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', background: c.bg, color: c.color, border: `1px solid ${c.border}`, maxWidth: 340, animation: 'fadeUp 0.2s ease' }}>
      {toast.msg}
    </div>
  );
}

// ─── SPINNER ──────────────────────────────────────────────────────────────────
function Spinner({ size = 18 }) {
  return <div style={{ width: size, height: size, border: `2px solid ${C.accentMid}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />;
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  shortlisted: { bg: C.blueLight, text: C.blue }, applied: { bg: '#dbeafe', text: '#1d4ed8' },
  under_review: { bg: C.amberLight, text: C.amber }, conditional_offer: { bg: '#f3e8ff', text: '#7c3aed' },
  unconditional_offer: { bg: '#ecfdf5', text: C.green }, accepted: { bg: C.greenLight, text: C.green },
  rejected: { bg: C.redLight, text: C.red }, waitlisted: { bg: '#fef3c7', text: '#92400e' },
  withdrawn: { bg: '#f3f4f6', text: '#6b7280' }, not_applied: { bg: '#f3f4f6', text: '#6b7280' },
  visa_applied: { bg: C.blueLight, text: C.blue }, visa_approved: { bg: C.greenLight, text: C.green },
  visa_rejected: { bg: C.redLight, text: C.red },
};
function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#f3f4f6', text: '#374151' };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.text }}>{(status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>;
}

// ─── ACADEMIC LEVELS ──────────────────────────────────────────────────────────
const ACADEMIC_LEVELS = [
  { value: '10th', label: '10th Standard' }, { value: '12th', label: '12th Standard' },
  { value: 'diploma', label: 'Diploma' }, { value: 'ug', label: 'Under-Graduate (UG)' },
  { value: 'pg', label: 'Post-Graduate (PG)' },
];
const LEVEL_ORDER = { '10th': 0, '12th': 1, diploma: 1, ug: 2, pg: 3 };

// ─── ACADEMIC ENTRY FORM ──────────────────────────────────────────────────────
function AcademicEntryForm({ entry, onChange, onSave, onDelete, saving, isNew }) {
  const level = entry.level || '';
  const isSchool = ['10th', '12th', 'diploma'].includes(level);
  const isHigher = ['ug', 'pg'].includes(level);
  const currentYear = new Date().getFullYear();
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '12px 16px', background: C.surfaceAlt, display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ACADEMIC_LEVELS.find(l => l.value === level)?.label || 'New Qualification'}</span>
        {entry.is_highest && <span style={{ fontSize: 11, fontWeight: 700, background: C.accentLight, color: C.accent, padding: '2px 8px', borderRadius: 12 }}>Highest</span>}
        {!isNew && onDelete && <button onClick={onDelete} style={{ marginLeft: 'auto', background: C.redLight, color: C.red, border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>}
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Level" value={entry.level} onChange={v => onChange('level', v)} options={ACADEMIC_LEVELS} required />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
          <input type="checkbox" checked={!!entry.is_highest} onChange={e => onChange('is_highest', e.target.checked)} id={`highest_${entry.id || 'new'}`} />
          <label htmlFor={`highest_${entry.id || 'new'}`} style={{ fontSize: 13, color: C.textMid, cursor: 'pointer' }}>Mark as highest qualification</label>
        </div>
        <Field label="Institution Name" value={entry.institution} onChange={v => onChange('institution', v)} required />
        {isSchool && <Field label="Board / University" value={entry.board_university} onChange={v => onChange('board_university', v)} required />}
        {isHigher && <>
          <Field label="Degree Name" value={entry.degree_name} onChange={v => onChange('degree_name', v)} placeholder="e.g. B.Tech, MBA" required />
          <Field label="Field of Study" value={entry.field_of_study} onChange={v => onChange('field_of_study', v)} required />
          <Field label="Specialization" value={entry.specialization} onChange={v => onChange('specialization', v)} />
        </>}
        {['12th', 'diploma'].includes(level) && <Field label="Stream" value={entry.stream} onChange={v => onChange('stream', v)} options={['Science', 'Commerce', 'Arts', 'Vocational', 'Other']} />}
        <Field label="Country" value={entry.country} onChange={v => onChange('country', v)} />
        <Field label="Start Year" value={entry.start_year} onChange={v => onChange('start_year', v)} type="number" placeholder="2018" max={currentYear} validate={v => !v || parseInt(v) <= currentYear} errorMsg="Start year cannot be in the future" />
        <Field label="End Year" value={entry.end_year} onChange={v => onChange('end_year', v)} type="number" placeholder="2022" max={currentYear}
          validate={v => { if (!v) return true; if (parseInt(v) > currentYear) return false; if (entry.start_year && parseInt(v) < parseInt(entry.start_year)) return false; return true; }}
          errorMsg={entry.end_year && parseInt(entry.end_year) > currentYear ? 'End year cannot be in the future' : 'End year must be after or equal to start year'} />
        <Field label="Percentage / CGPA" value={entry.percentage_cgpa} onChange={v => onChange('percentage_cgpa', v)} type="number" min={0}
          max={entry.grading_scale === 'percentage' ? 100 : entry.grading_scale === 'cgpa-10' ? 10 : entry.grading_scale === 'cgpa-4' ? 4 : undefined}
          validate={v => { if (!v) return true; const num = parseFloat(v); if (entry.grading_scale === 'percentage') return num >= 0 && num <= 100; if (entry.grading_scale === 'cgpa-10') return num >= 0 && num <= 10; if (entry.grading_scale === 'cgpa-4') return num >= 0 && num <= 4; return true; }}
          errorMsg={entry.grading_scale === 'percentage' ? 'Percentage must be between 0 and 100' : entry.grading_scale === 'cgpa-10' ? 'CGPA must be between 0 and 10' : entry.grading_scale === 'cgpa-4' ? 'CGPA must be between 0 and 4' : 'Invalid score'} />
        <Field label="Grading Scale" value={entry.grading_scale} onChange={v => onChange('grading_scale', v)} options={['percentage', 'cgpa-10', 'cgpa-4', 'grade']} />
        <Field label="Backlogs" value={entry.backlogs} onChange={v => onChange('backlogs', v)} type="number" placeholder="0" min={0} validate={v => !v || parseInt(v) >= 0} errorMsg="Backlogs cannot be negative" />
      </div>
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onSave} disabled={saving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
          {saving && <Spinner size={14} />}{isNew ? 'Add Qualification' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── WORK ENTRY FORM ──────────────────────────────────────────────────────────
function WorkEntryForm({ entry, onChange, onSave, onDelete, saving, isNew }) {
  const handleCompanyName = useCallback((v) => onChange('company_name', v), [onChange]);
  const today = new Date().toISOString().split('T')[0];
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '12px 16px', background: C.surfaceAlt, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{entry.company_name || 'New Experience'}{entry.job_title ? ` — ${entry.job_title}` : ''}</span>
        {!isNew && onDelete && <button onClick={onDelete} style={{ marginLeft: 'auto', background: C.redLight, color: C.red, border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>}
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Company Name" value={entry.company_name} onChange={handleCompanyName} required />
        <Field label="Job Title" value={entry.job_title} onChange={v => onChange('job_title', v)} required />
        <Field label="Employment Type" value={entry.employment_type} onChange={v => onChange('employment_type', v)} options={['full-time', 'part-time', 'internship', 'contract', 'freelance']} />
        <Field label="Country" value={entry.country} onChange={v => onChange('country', v)} />
        <Field label="Start Date" value={entry.start_date} onChange={v => onChange('start_date', v)} type="date" max={today} validate={v => !v || new Date(v) <= new Date()} errorMsg="Start date cannot be in the future" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Field label="End Date" value={entry.end_date} onChange={v => onChange('end_date', v)} type="date" disabled={!!entry.is_current} max={today}
            validate={v => { if (!v || entry.is_current) return true; if (new Date(v) > new Date()) return false; if (entry.start_date && new Date(v) <= new Date(entry.start_date)) return false; return true; }}
            errorMsg={entry.end_date && new Date(entry.end_date) > new Date() ? 'End date cannot be in the future' : 'End date must be after start date'} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!entry.is_current} onChange={e => { onChange('is_current', e.target.checked); if (e.target.checked) onChange('end_date', ''); }} />
            <span style={{ fontSize: 12, color: C.textMid }}>Currently working here</span>
          </label>
        </div>
        <Field label="Description / Responsibilities" value={entry.description} onChange={v => onChange('description', v)} type="textarea" full />
      </div>
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onSave} disabled={saving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
          {saving && <Spinner size={14} />}{isNew ? 'Add Experience' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── SCORE INPUTS ─────────────────────────────────────────────────────────────
function ScoreInputs({ testType, sectionScores, onChange }) {
  if (!testType?.sections?.length) return null;
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
      {testType.sections.map(sec => {
        const val = sectionScores?.[sec.key] ?? '';
        const hasError = val !== '' && !isValidScore(val, sec.min, sec.max);
        return (
          <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{sec.label}</label>
            <input type="number" step={sec.step || 1} min={sec.min} max={sec.max} value={val}
              onChange={e => { const raw = e.target.value; let clamped = raw; if (raw !== '' && sec.max != null && parseFloat(raw) > sec.max) clamped = String(sec.max); if (raw !== '' && sec.min != null && parseFloat(raw) < sec.min) clamped = String(sec.min); onChange(sec.key, clamped); }}
              placeholder={sec.min != null && sec.max != null ? `${sec.min}–${sec.max}` : sec.label}
              style={{ fontSize: 13, padding: '9px 12px', border: `1.5px solid ${hasError ? C.red : C.border}`, borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxShadow: hasError ? `0 0 0 3px ${C.redLight}` : 'none' }} />
            {hasError && <div style={{ fontSize: 11, color: C.red }}>Must be {sec.min}–{sec.max}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── CUSTOM FIELD INPUT ───────────────────────────────────────────────────────
function CustomFieldInput({ field, value, onChange, readOnly, disabled }) {
  const { field_type, field_name, placeholder, dropdown_options } = field;
  const isDisabled = readOnly || disabled;
  if (readOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{field_name}</label>
        <div style={{ fontSize: 13, padding: '9px 12px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, minHeight: 36 }}>
          {value || <span style={{ color: C.muted }}>—</span>}
        </div>
      </div>
    );
  }
  if (field_type === 'yes_no') return <Field label={field_name} value={value} onChange={onChange} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} required={field.is_required} disabled={isDisabled} />;
  if (field_type === 'dropdown') return <Field label={field_name} value={value} onChange={onChange} options={(dropdown_options || []).map(o => ({ value: o, label: o }))} placeholder={placeholder} required={field.is_required} disabled={isDisabled} />;
  if (field_type === 'long_text') return <Field label={field_name} value={value} onChange={onChange} type="textarea" placeholder={placeholder} required={field.is_required} full disabled={isDisabled} />;
  if (field_type === 'integer') return <Field label={field_name} value={value} onChange={onChange} type="number" placeholder={placeholder} required={field.is_required} disabled={isDisabled} />;
  if (field_type === 'float') return <Field label={field_name} value={value} onChange={onChange} type="number" placeholder={placeholder} required={field.is_required} disabled={isDisabled} />;
  return <Field label={field_name} value={value} onChange={onChange} type="text" placeholder={placeholder} required={field.is_required} disabled={isDisabled} />;
}

// ─── INLINE ADMIN FIELD ADDER ─────────────────────────────────────────────────
function InlineAdminFieldAdder({ sectionKey, studentId, showToast, onFieldCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ field_name: '', field_type: 'text', placeholder: '', is_required: false, dropdown_options: [], section_key: sectionKey, student_id: studentId });
  const [dropOpt, setDropOpt] = useState('');
  const set = k => v => setForm(p => ({ ...p, [k]: v }));
  const addDropOpt = () => { if (!dropOpt.trim()) return; setForm(p => ({ ...p, dropdown_options: [...(p.dropdown_options || []), dropOpt.trim()] })); setDropOpt(''); };
  const removeDropOpt = (i) => setForm(p => ({ ...p, dropdown_options: p.dropdown_options.filter((_, j) => j !== i) }));
  const save = async () => {
    if (!form.field_name.trim()) return;
    setSaving(true);
    try {
      const payload = { field_name: form.field_name, field_type: form.field_type, placeholder: form.placeholder, is_required: form.is_required, dropdown_options: form.field_type === 'dropdown' ? form.dropdown_options : null, section_key: sectionKey, student_id: studentId, sort_order: 0 };
      const created = await apiFetch('/api/admin/custom-fields', { method: 'POST', body: JSON.stringify(payload) });
      showToast(`Field "${created.field_name}" added`, 'success');
      setForm({ field_name: '', field_type: 'text', placeholder: '', is_required: false, dropdown_options: [], section_key: sectionKey, student_id: studentId });
      setDropOpt(''); setOpen(false);
      onFieldCreated && onFieldCreated(created);
    } catch (e) { showToast(e.message, 'error'); }
    setSaving(false);
  };
  if (!open) return (
    <div style={{ gridColumn: '1 / -1', paddingTop: 4 }}>
      <button onClick={() => setOpen(true)} style={{ background: 'none', border: `1.5px dashed ${C.accentMid}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Custom Field
      </button>
    </div>
  );
  return (
    <div style={{ gridColumn: '1 / -1', border: `1.5px solid ${C.accentMid}`, borderRadius: 12, overflow: 'hidden', background: C.accentLight }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>⚙ Add Field — {sectionKey === 'pre_application' ? 'Pre-Application' : 'Post-Application'}</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 16 }}>✕</button>
      </div>
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Field Name" value={form.field_name} onChange={set('field_name')} required placeholder="e.g. IELTS Score, LinkedIn URL" />
        <Field label="Field Type" value={form.field_type} onChange={set('field_type')} options={[{ value: 'text', label: 'Text' }, { value: 'long_text', label: 'Long Text' }, { value: 'integer', label: 'Integer' }, { value: 'float', label: 'Float / Decimal' }, { value: 'yes_no', label: 'Yes / No' }, { value: 'dropdown', label: 'Dropdown' }]} />
        <Field label="Placeholder hint" value={form.placeholder} onChange={set('placeholder')} placeholder="Optional placeholder text" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={!!form.is_required} onChange={e => set('is_required')(e.target.checked)} />Required field
          </label>
        </div>
        {form.field_type === 'dropdown' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Dropdown Options</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(form.dropdown_options || []).map((opt, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', color: C.accent, border: `1px solid ${C.accentMid}`, padding: '3px 8px', borderRadius: 16, fontSize: 12 }}>
                  {opt}<button onClick={() => removeDropOpt(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={dropOpt} onChange={e => setDropOpt(e.target.value)} placeholder="Type an option and press Add…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDropOpt(); } }}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={addDropOpt} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.accentMid}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setOpen(false)} style={{ background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={!form.field_name.trim() || saving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !form.field_name.trim() ? 0.5 : 1 }}>
          {saving && <Spinner size={12} />} Save Field
        </button>
      </div>
    </div>
  );
}

// ─── TEST TYPE MANAGER ────────────────────────────────────────────────────────
function TestTypeManager({ showToast }) {
  const [testTypes, setTestTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTT, setEditingTT] = useState(null);
  const [savingTT, setSavingTT] = useState(false);
  const [newTT, setNewTT] = useState({ name: '', description: '', is_active: true, has_overall_score: true, overall_score_label: 'Overall Score', overall_score_min: '', overall_score_max: '', overall_score_step: 1, has_expiry: true, validity_years: '', sections: [] });
  const [newSection, setNewSection] = useState({ key: '', label: '', min: '', max: '', step: 1 });

  useEffect(() => {
    apiFetch('/api/admin/test-types?include_inactive=true').then(d => setTestTypes(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const addSection = () => {
    if (!newSection.key || !newSection.label) return;
    setNewTT(p => ({ ...p, sections: [...p.sections, { ...newSection, min: newSection.min !== '' ? parseFloat(newSection.min) : null, max: newSection.max !== '' ? parseFloat(newSection.max) : null, step: parseFloat(newSection.step) || 1 }] }));
    setNewSection({ key: '', label: '', min: '', max: '', step: 1 });
  };
  const removeSection = idx => setNewTT(p => ({ ...p, sections: p.sections.filter((_, i) => i !== idx) }));

  const saveTT = async () => {
    if (!newTT.name) return;
    setSavingTT(true);
    try {
      const payload = { ...newTT, overall_score_min: newTT.overall_score_min !== '' ? parseFloat(newTT.overall_score_min) : null, overall_score_max: newTT.overall_score_max !== '' ? parseFloat(newTT.overall_score_max) : null, overall_score_step: parseFloat(newTT.overall_score_step) || 1, validity_years: newTT.validity_years !== '' ? parseInt(newTT.validity_years) : null, sections: newTT.sections.length ? newTT.sections : null };
      if (editingTT) {
        const updated = await apiFetch(`/api/admin/test-types/${editingTT}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setTestTypes(prev => prev.map(t => t.id === editingTT ? updated : t)); setEditingTT(null); showToast('Test type updated', 'success');
      } else {
        const created = await apiFetch('/api/admin/test-types', { method: 'POST', body: JSON.stringify(payload) });
        setTestTypes(prev => [...prev, created]); showToast('Test type created', 'success');
      }
      setNewTT({ name: '', description: '', is_active: true, has_overall_score: true, overall_score_label: 'Overall Score', overall_score_min: '', overall_score_max: '', overall_score_step: 1, has_expiry: true, validity_years: '', sections: [] });
    } catch (e) { showToast(e.message, 'error'); }
    setSavingTT(false);
  };

  const deleteTT = async (id) => {
    if (!confirm('Delete this test type?')) return;
    try { await apiFetch(`/api/admin/test-types/${id}`, { method: 'DELETE' }); setTestTypes(prev => prev.filter(t => t.id !== id)); showToast('Test type deleted', 'success'); } catch (e) { showToast(e.message, 'error'); }
  };
  const editTT = tt => { setEditingTT(tt.id); setNewTT({ name: tt.name, description: tt.description || '', is_active: tt.is_active, has_overall_score: tt.has_overall_score, overall_score_label: tt.overall_score_label, overall_score_min: tt.overall_score_min ?? '', overall_score_max: tt.overall_score_max ?? '', overall_score_step: tt.overall_score_step, has_expiry: tt.has_expiry, validity_years: tt.validity_years ?? '', sections: tt.sections || [] }); };
  const toggleActive = async tt => {
    try { const updated = await apiFetch(`/api/admin/test-types/${tt.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !tt.is_active }) }); setTestTypes(prev => prev.map(t => t.id === tt.id ? updated : t)); showToast(`Test type ${updated.is_active ? 'activated' : 'deactivated'}`, 'success'); } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: C.accentLight, borderBottom: `1px solid ${C.accentMid}`, fontSize: 13, fontWeight: 700, color: C.accent }}>{editingTT ? '✏️ Edit Test Type' : '+ Create New Test Type'}</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Test Name" value={newTT.name} onChange={v => setNewTT(p => ({ ...p, name: v }))} required placeholder="e.g. IELTS, GRE, TOEFL" />
          <Field label="Description" value={newTT.description} onChange={v => setNewTT(p => ({ ...p, description: v }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 22, gridColumn: '1 / -1' }}>
            {[['has_overall_score', 'Has Overall Score'], ['has_expiry', 'Has Expiry'], ['is_active', 'Active']].map(([k, lbl]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={!!newTT[k]} onChange={e => setNewTT(p => ({ ...p, [k]: e.target.checked }))} />{lbl}
              </label>
            ))}
          </div>
          {newTT.has_overall_score && <>
            <Field label="Overall Score Label" value={newTT.overall_score_label} onChange={v => setNewTT(p => ({ ...p, overall_score_label: v }))} placeholder="e.g. Band Score" />
            <Field label="Min Score" value={newTT.overall_score_min} onChange={v => setNewTT(p => ({ ...p, overall_score_min: v }))} type="number" />
            <Field label="Max Score" value={newTT.overall_score_max} onChange={v => setNewTT(p => ({ ...p, overall_score_max: v }))} type="number" />
            <Field label="Step" value={newTT.overall_score_step} onChange={v => setNewTT(p => ({ ...p, overall_score_step: v }))} type="number" placeholder="0.5" />
          </>}
          {newTT.has_expiry && <Field label="Validity (Years)" value={newTT.validity_years} onChange={v => setNewTT(p => ({ ...p, validity_years: v }))} type="number" placeholder="2" />}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 8 }}>Sections / Subtests</div>
            {newTT.sections.map((sec, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, padding: '7px 10px', background: C.surfaceAlt, borderRadius: 7 }}>
                <span style={{ fontSize: 12, flex: 1, color: C.text }}>{sec.label} <span style={{ color: C.muted }}>({sec.key})</span> · {sec.min}–{sec.max} step:{sec.step}</span>
                <button onClick={() => removeSection(idx)} style={{ background: C.redLight, color: C.red, border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 70px 70px auto', gap: 6, alignItems: 'end' }}>
              {[{ label: 'Key', val: newSection.key, key: 'key', ph: 'listening' }, { label: 'Label', val: newSection.label, key: 'label', ph: 'Listening' }, { label: 'Min', val: newSection.min, key: 'min', ph: '0' }, { label: 'Max', val: newSection.max, key: 'max', ph: '9' }, { label: 'Step', val: newSection.step, key: 'step', ph: '0.5' }].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>{f.label}</label>
                  <input value={f.val} onChange={e => setNewSection(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1.5px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              ))}
              <button onClick={addSection} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}>+ Add</button>
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editingTT && <button onClick={() => { setEditingTT(null); setNewTT({ name: '', description: '', is_active: true, has_overall_score: true, overall_score_label: 'Overall Score', overall_score_min: '', overall_score_max: '', overall_score_step: 1, has_expiry: true, validity_years: '', sections: [] }); }} style={{ background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>}
          <button onClick={saveTT} disabled={!newTT.name || savingTT} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: !newTT.name ? 0.5 : 1 }}>
            {savingTT && <Spinner size={13} />}{editingTT ? 'Update' : 'Create Test Type'}
          </button>
        </div>
      </div>
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
        : testTypes.length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: C.muted }}>No test types yet</div>
        : testTypes.map(tt => (
          <div key={tt.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', background: tt.is_active ? '#fff' : C.surfaceAlt }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: tt.is_active ? C.text : C.muted }}>{tt.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: tt.is_active ? C.greenLight : C.surfaceAlt, color: tt.is_active ? C.green : C.muted }}>{tt.is_active ? 'Active' : 'Inactive'}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => editTT(tt)} style={{ background: C.accentLight, color: C.accent, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => toggleActive(tt)} style={{ background: tt.is_active ? C.amberLight : C.greenLight, color: tt.is_active ? C.amber : C.green, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{tt.is_active ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => deleteTT(tt.id)} style={{ background: C.redLight, color: C.red, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textLight }}>
              {tt.has_overall_score && <span>{tt.overall_score_label}: {tt.overall_score_min}–{tt.overall_score_max} · </span>}
              {tt.sections?.length > 0 && <span>Sections: {tt.sections.map(s => s.label).join(', ')} · </span>}
              {tt.has_expiry && <span>Valid: {tt.validity_years}yr</span>}
            </div>
          </div>
        ))}
    </div>
  );
}

import { DocumentsTab } from './DocumentsTab';

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
function ChatPanel({ title, subtitle, messages, loadingMsgs, chatMsg, setChatMsg, chatFile, setChatFile, chatEndRef, canManage, onSend, studentId, sectionId }) {
  const chatFileRef = useRef(null);
  const textareaRef = useRef(null);

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setChatFile(file);
        return;
      }
    }
  };

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{subtitle}</div>}
      </div>

      <div style={{ minHeight: 200, maxHeight: 300, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loadingMsgs ? <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div>
          : messages.length === 0 ? <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: 20 }}>No messages yet</div>
          : messages.map(msg => {
              const isMe = canManage ? (msg.sender_type === 'user') : (msg.sender_type === 'student');
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%', padding: '10px 14px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? C.accent : C.surfaceAlt,
                    color: isMe ? '#fff' : C.text,
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {msg.message && (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.message}</div>
                    )}
                    {msg.attachment_name && (
                      <div style={{
                        marginTop: msg.message ? 8 : 0,
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 10px', borderRadius: 8,
                        background: isMe ? 'rgba(255,255,255,0.15)' : C.border,
                        fontSize: 12,
                      }}>
                        <span>📎</span>
                        <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.attachment_name}</span>
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('crm_access_token');
                              const res = await fetch(
                                `${API_BASE}/api/students/${studentId}/applications/${sectionId}/messages/${msg.id}/attachment`,
                                token ? { headers: { Authorization: `Bearer ${token}` } } : {}
                              );
                              if (!res.ok) throw new Error('Download failed');
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url; a.download = msg.attachment_name;
                              document.body.appendChild(a); a.click(); a.remove();
                              URL.revokeObjectURL(url);
                            } catch (err) { console.error('Download error:', err); }
                          }}
                          style={{
                            background: isMe ? 'rgba(255,255,255,0.2)' : C.accentLight,
                            color: isMe ? '#fff' : C.accent,
                            border: 'none', borderRadius: 6,
                            padding: '3px 9px', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                          }}
                        >↓ Download</button>
                      </div>
                    )}
                    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>{formatDateTime(msg.created_at)}</div>
                  </div>
                </div>
              );
            })}
        <div ref={chatEndRef} />
      </div>

      {chatFile && (
        <div style={{
          padding: '8px 14px', borderTop: `1px solid ${C.border}`,
          background: C.accentLight, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {chatFile.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(chatFile)} alt="preview" style={{ height: 40, width: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: 20 }}>📎</span>
          )}
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatFile.name}</span>
          <span style={{ fontSize: 11, color: C.textLight, flexShrink: 0 }}>
            {chatFile.size < 1024 * 1024 ? `${Math.round(chatFile.size / 1024)} KB` : `${(chatFile.size / (1024 * 1024)).toFixed(1)} MB`}
          </span>
          <button onClick={() => { setChatFile(null); if (chatFileRef.current) chatFileRef.current.value = ''; }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
      )}

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <input ref={chatFileRef} type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setChatFile(e.target.files[0]); }} />
        <button onClick={() => chatFileRef.current?.click()} title="Attach file"
          style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', cursor: 'pointer', color: C.textLight, flexShrink: 0, fontSize: 16, lineHeight: 1 }}>📎</button>
        <textarea ref={textareaRef} value={chatMsg}
          onChange={e => { setChatMsg(e.target.value); autoResize(e.target); }}
          onKeyDown={handleKeyDown} onPaste={handlePaste}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5, overflowY: 'auto', minHeight: 40, maxHeight: 160 }} />
        <button onClick={onSend} disabled={!chatMsg.trim() && !chatFile}
          style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!chatMsg.trim() && !chatFile) ? 0.5 : 1, flexShrink: 0, alignSelf: 'flex-end' }}>Send</button>
      </div>

      <div style={{ padding: '0 14px 8px', fontSize: 11, color: C.muted }}>
        Enter to send · Shift+Enter for new line · Paste images or files directly
      </div>
    </div>
  );
}

// ─── COLLAPSIBLE SECTION ──────────────────────────────────────────────────────
function CollapsibleSection({ title, defaultOpen = true, C, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.surfaceAlt, border: 'none', borderBottom: open ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}

// ─── APPLICATIONS TAB ─────────────────────────────────────────────────────────
function ApplicationsTab({
  studentId, showToast, isAdmin, isCounsellor,
  customFieldDefs, customFieldValues, setCustomFieldValues,
  onCustomFieldCreated, userRole,
  initialApplicationId,
  onRefresh,
}) {
  const canManage = isAdmin || isCounsellor;
  const [appMode, setAppMode] = useState('pre');
  const [apps, setApps] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfSaving, setCfSaving] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatFile, setChatFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [paymentMode, setPaymentMode] = useState('');
  const [customPaymentMode, setCustomPaymentMode] = useState('');
  const [offerFieldId, setOfferFieldId] = useState(null);

  // ── FIX: consistent state keys matching addApp payload ──
  const [newApp, setNewApp] = useState({
    university_id: '',
    program: '',       // → course_name in API
    intake: '',        // → intake_month in API
    year: '',          // → intake_year in API
    notes: '',
    representative: '',
    representative_other: '',
  });

  const chatEndRef = useRef(null);

  const preAppFields  = (customFieldDefs || []).filter(f => f.section_key === 'pre_application'  && (f.is_active ?? true));
  const postAppFields = (customFieldDefs || []).filter(f => f.section_key === 'post_application' && (f.is_active ?? true));

  useEffect(() => {
    if (!studentId) return;
    Promise.all([
      apiFetch(`/api/students/${studentId}/applications/`),
      canManage ? apiFetch('/api/universities/?') : Promise.resolve([]),
      apiFetch(`/api/students/${studentId}/documents/fields/`),
    ]).then(([a, u, docFields]) => {
      setApps(Array.isArray(a) ? a : []);
      setUniversities(Array.isArray(u) ? u : []);
      if (a?.length) setSelectedId(a[0].id);
      const offerField = Array.isArray(docFields) ? docFields.find(f => f.doc_type === 'offer_letter' && f.is_active) : null;
      setOfferFieldId(offerField?.id || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [studentId]);

  const selected = useMemo(() => apps.find(a => a.id === selectedId), [apps, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMsgs(true);
    apiFetch(`/api/students/${studentId}/applications/${selectedId}/messages`)
      .then(m => { setMessages(Array.isArray(m) ? m : []); setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); })
      .catch(() => setMessages([])).finally(() => setLoadingMsgs(false));
    apiFetch(`/api/notifications/read-by-application/${selectedId}`, { method: 'PATCH' }).catch(() => {});
  }, [selectedId, studentId]);

  useEffect(() => {
    if (!initialApplicationId || apps.length === 0) return;
    const match = apps.find(a => a.id === initialApplicationId);
    if (match) { setSelectedId(match.id); setAppMode('post'); }
  }, [initialApplicationId, apps]);

  const addApp = async () => {
    if (!newApp.university_id) { showToast('University is required', 'error'); return; }
    if (!newApp.program?.trim()) { showToast('Course / Program is required', 'error'); return; }
    setSaving(true);
    try {
      const created = await apiFetch(`/api/students/${studentId}/applications/`, {
        method: 'POST',
        body: JSON.stringify({
          university_id: parseInt(newApp.university_id),
          intake_month: newApp.intake || null,
          intake_year: newApp.year ? parseInt(newApp.year) : null,
          course_name: newApp.program || '',
          notes: newApp.notes || null,
          representative: newApp.representative === 'others' ? newApp.representative_other : newApp.representative || null,
        }),
      });

      if (preAppFields.length > 0) {
        const values = preAppFields.map(f => ({ field_id: f.id, value: customFieldValues[f.id] || '' }));
        await apiFetch(`/api/students/${studentId}/custom-fields`, { method: 'PUT', body: JSON.stringify({ values }) }).catch(() => {});
      }

      setApps(prev => [created, ...prev]);
      setSelectedId(created.id);
      setShowNewForm(false);
      // Reset form with correct keys
      setNewApp({ university_id: '', program: '', intake: '', year: '', notes: '', representative: '', representative_other: '' });
      showToast('Application created', 'success');
      if (typeof onRefresh === 'function') onRefresh();
    } catch (e) { showToast(e.message, 'error'); }
    setSaving(false);
  };

  const updateStatus = async (field, value) => {
    if (!selectedId || !canManage) return;
    try {
      const updated = await apiFetch(`/api/students/${studentId}/applications/${selectedId}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
      setApps(prev => prev.map(a => a.id === selectedId ? { ...a, ...updated } : a));
      if (typeof onRefresh === 'function') onRefresh();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const updateAppField = async (appId, field, value) => {
  if (!canManage) return;
  try {
    const updated = await apiFetch(`/api/students/${studentId}/applications/${appId}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...updated } : a));
    if (typeof onRefresh === 'function') onRefresh();
  } catch (e) { showToast(e.message, 'error'); }
};

  const saveCustomFields = async (sectionKey) => {
    if (!studentId) return;
    const fieldsForSection = sectionKey === 'pre_application' ? preAppFields : postAppFields;
    const values = fieldsForSection.map(f => ({ field_id: f.id, value: customFieldValues[f.id] || '' }));
    setCfSaving(true);
    try { await apiFetch(`/api/students/${studentId}/custom-fields`, { method: 'PUT', body: JSON.stringify({ values }) }); showToast('Fields saved', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    setCfSaving(false);
  };

  const sendMsg = async () => {
    if (!chatMsg.trim() && !chatFile) return;
    if (!selectedId) return;
    try {
      const form = new FormData();
      form.append('message', chatMsg || '');
      if (chatFile) form.append('file', chatFile);
      const msg = await apiFetch(`/api/students/${studentId}/applications/${selectedId}/messages`, { method: 'POST', body: form });
      setMessages(prev => [...prev, msg]); setChatMsg(''); setChatFile(null);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) { showToast(e.message, 'error'); }
  };

  // ── STUDENT VIEW ──
  if (!canManage) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '0 16px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, display: 'flex' }}>
            <button style={{ background: 'none', border: 'none', padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.accent, borderBottom: `2.5px solid ${C.accent}`, fontFamily: 'inherit' }}>My Applications</button>
          </div>
        </div>
        {apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎓</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>No applications yet</div>
            <div style={{ fontSize: 13 }}>Your counsellor will add university applications for you.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {apps.map(app => (
              <div key={app.id} onClick={() => setSelectedId(app.id === selectedId ? null : app.id)}
                style={{ border: `1.5px solid ${selectedId === app.id ? C.accent : C.border}`, borderRadius: 12, padding: 16, cursor: 'pointer', background: selectedId === app.id ? C.accentLight : '#fff', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{app.university?.name}</div>
                <div style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>{app.course_name}</div>
                {app.representative && (
                  <div style={{ fontSize: 12, color: C.textLight, marginBottom: 8 }}>👤 {app.representative}</div>
                )}                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}><StatusBadge status={app.application_status} />{app.visa_status !== 'not_applied' && <StatusBadge status={app.visa_status} />}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                  {app.university?.country && <span>{app.university.country}</span>}
                  {(app.intake_month || app.intake_year) && <span>📅 {[app.intake_month, app.intake_year].filter(Boolean).join(' ')}</span>}
                  {app.tuition_fee && <span>💰 {app.currency} {app.tuition_fee?.toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedId && selected && postAppFields.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Additional Information — {selected.university?.name}</div>
              <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>Please fill in the fields below</div>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {postAppFields.map(field => <CustomFieldInput key={field.id} field={field} value={customFieldValues[field.id] || ''} onChange={v => setCustomFieldValues(p => ({ ...p, [field.id]: v }))} readOnly={false} disabled={false} />)}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => saveCustomFields('post_application')} disabled={cfSaving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {cfSaving && <Spinner size={14} />} Save
              </button>
            </div>
          </div>
        )}
        {selectedId && selected &&
          <ChatPanel
            title={`Student Chat — ${selected.university?.name}`}
            subtitle={selected.course_name}
            messages={messages} loadingMsgs={loadingMsgs}
            chatMsg={chatMsg} setChatMsg={setChatMsg}
            chatFile={chatFile} setChatFile={setChatFile}
            chatEndRef={chatEndRef} canManage={canManage}
            onSend={sendMsg} studentId={studentId} sectionId={selectedId}
          />
        }
      </div>
    );
  }

  // ── PRE-APPLICATION VIEW ──
  const PreApplicationView = (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        onClick={() => setShowNewForm(v => !v)}
        style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
      >
        {showNewForm ? '✕ Cancel' : '+ Add Application'}
      </button>

      {showNewForm && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
            New Application
          </div>

          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* University dropdown — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field
                label="University"
                value={newApp.university_id}
                onChange={v => setNewApp(p => ({ ...p, university_id: v }))}
                options={universities.map(u => ({
                  value: String(u.id),
                  label: `${u.name}${u.country ? ` • ${u.country}` : ''}`,
                }))}
                required
              />
            </div>

            {/* Course — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field
                label="Course / Program"
                value={newApp.program}
                onChange={v => setNewApp(p => ({ ...p, program: v }))}
                placeholder="e.g. MSc Computer Science"
                required
              />
            </div>

            {/* Intake Month */}
            <Field
              label="Intake Month"
              value={newApp.intake}
              onChange={v => setNewApp(p => ({ ...p, intake: v }))}
              options={intakeMonthOptions}
            />

            {/* Intake Year */}
            <Field
              label="Intake Year"
              value={newApp.year}
              onChange={v => setNewApp(p => ({ ...p, year: v }))}
              options={intakeYearOptions}
            />

            {/* Notes — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Field
                  label="Notes"
                  value={newApp.notes}
                  onChange={v => setNewApp(p => ({ ...p, notes: v }))}
                  placeholder="Optional notes"
                />
              </div>

              {/* Representative */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Field
                  label="Representative"
                  value={newApp.representative}
                  onChange={v => setNewApp(p => ({ ...p, representative: v, representative_other: v !== 'others' ? '' : p.representative_other }))}
                  options={[
                    { value: 'kings', label: 'Kings' },
                    { value: 'global', label: 'Global' },
                    { value: 'superiors', label: 'Superiors' },
                    { value: 'lz', label: 'LZ' },
                    { value: 'others', label: 'Others' },
                  ]}
                />
              </div>

              {newApp.representative === 'others' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field
                    label="Specify Representative"
                    value={newApp.representative_other}
                    onChange={v => setNewApp(p => ({ ...p, representative_other: v }))}
                    placeholder="Enter representative name"
                    required
                  />
                </div>
              )}

            {preAppFields.length > 0 && (
              <>
                <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>Additional Application Fields</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>Fill these fields while starting the application.</div>
                </div>
                {preAppFields.map(field => (
                  <CustomFieldInput
                    key={field.id} field={field}
                    value={customFieldValues[field.id] || ''}
                    onChange={v => setCustomFieldValues(p => ({ ...p, [field.id]: v }))}
                  />
                ))}
              </>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              {isAdmin && (
                <InlineAdminFieldAdder
                  sectionKey="pre_application"
                  studentId={studentId}
                  showToast={showToast}
                  onFieldCreated={onCustomFieldCreated}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={addApp} disabled={saving}
                style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {saving && <Spinner size={14} />} Create Application
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                style={{ background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>No applications yet</div>
          <div style={{ fontSize: 13 }}>Click "+ Add Application" to shortlist universities</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {apps.map(app => (
            <div key={app.id} onClick={() => { setSelectedId(app.id); setAppMode('post'); }}
              style={{ border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 16, cursor: 'pointer', background: '#fff', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{app.university?.name}</div>
              <div style={{ fontSize: 12, color: C.textLight, marginBottom: 6 }}>{app.course_name}</div>
              {app.representative && (
                <div style={{ fontSize: 12, color: C.textLight, marginBottom: 8 }}> {app.representative}</div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <StatusBadge status={app.application_status} />
                {app.visa_status !== 'not_applied' && <StatusBadge status={app.visa_status} />}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                {app.university?.country && <span>{app.university.country}</span>}
                {(app.intake_month || app.intake_year) && <span>{[app.intake_month, app.intake_year].filter(Boolean).join(' ')}</span>}
                {app.tuition_fee && <span>{app.currency} {app.tuition_fee?.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
const REASON_REQUIRED_STATUSES = [
              'rejected',
              'case_closed',
              'withdrawn',
              'application_on_hold',
              'waitlisted'
            ];

const showVisaFields = [
  "fee_paid",
  "visa_applied",
  "visa_approved",
  "visa_rejected"
].includes(selected?.application_status);

const showPaymentMode = selected?.application_status === "fee_paid";


  const PostApplicationView = (
    apps.length === 0 ? (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>No applications yet</div>
        <div style={{ fontSize: 13 }}>Switch to Pre-Application to add universities first.</div>
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 600 }}>
        <div style={{ borderRight: `1px solid ${C.border}`, background: C.surfaceAlt, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          {apps.map(app => (
            // <div key={app.id} onClick={() => setSelectedId(app.id)}
            //   style={{ border: `1.5px solid ${selectedId === app.id ? C.accent : C.border}`, borderRadius: 12, padding: 14, cursor: 'pointer', background: selectedId === app.id ? C.accentLight : '#fff', transition: 'all 0.15s' }}>
            //   <div style={{ fontSize: 13, fontWeight: 700, color: selectedId === app.id ? C.accent : C.text, marginBottom: 4, lineHeight: 1.3 }}>{app.university?.name || 'University'}</div>
            // <div style={{ fontSize: 12, color: C.textLight, marginBottom: app.representative ? 4 : 6 }}>{app.course_name}</div>
            // {app.representative && (
            //   <div style={{ fontSize: 12, color: C.textLight, marginBottom: 6 }}> {app.representative}</div>
            // )}
            // <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}></div>       
            //    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><StatusBadge status={app.application_status} />{app.visa_status !== 'not_applied' && <StatusBadge status={app.visa_status} />}</div>
            // </div>
            <div key={app.id} onClick={() => setSelectedId(app.id)}
  style={{ border: `1.5px solid ${selectedId === app.id ? C.accent : C.border}`, borderRadius: 12, padding: 14, cursor: 'pointer', background: selectedId === app.id ? C.accentLight : '#fff', transition: 'all 0.15s' }}>
  
  {/* ACK Number + Date row */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.accentLight, padding: '2px 7px', borderRadius: 6, letterSpacing: '0.04em' }}>
      {buildAckNo(app)}
    </span>
    <span style={{ fontSize: 10, color: C.muted }}>
      {formatCreatedAt(app.created_at)}
    </span>
  </div>

  <div style={{ fontSize: 13, fontWeight: 700, color: selectedId === app.id ? C.accent : C.text, marginBottom: 4, lineHeight: 1.3 }}>{app.university?.name || 'University'}</div>
  <div style={{ fontSize: 12, color: C.textLight, marginBottom: app.representative ? 4 : 6 }}>{app.course_name}</div>
  {app.representative && (
    <div style={{ fontSize: 12, color: C.textLight, marginBottom: 6 }}>{app.representative}</div>
  )}

  
{/* Priority badge — display only */}
{app.priority && (
  <div style={{ marginBottom: 6 }}>
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background:
        app.priority === '1st' ? '#fef9c3' :
        app.priority === '2nd' ? '#e0f2fe' : '#f3e8ff',
      color:
        app.priority === '1st' ? '#854d0e' :
        app.priority === '2nd' ? '#075985' : '#6b21a8',
    }}>
      {app.priority === '1st' ? '' : app.priority === '2nd' ? '' : ''} {app.priority} Priority
    </span>
  </div>
)}
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    <StatusBadge status={app.application_status} />
    {app.visa_status !== 'not_applied' && <StatusBadge status={app.visa_status} />}
  </div>
</div>
          ))}
        </div>
        {selected && (
          <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
  <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{selected.university?.name}</div>
  {selected.priority && (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background:
        selected.priority === '1st' ? '#fef9c3' :
        selected.priority === '2nd' ? '#e0f2fe' : '#f3e8ff',
      color:
        selected.priority === '1st' ? '#854d0e' :
        selected.priority === '2nd' ? '#075985' : '#6b21a8',
    }}>
      {selected.priority === '1st' ? '' : selected.priority === '2nd' ? '' : ''} {selected.priority} Priority
    </span>
  )}
  {/* Priority dropdown — top right */}
  <div style={{ marginLeft: 'auto' }}>
    <select
      value={selected.priority || ''}
      onChange={e => updateStatus('priority', e.target.value)}
      style={{
        fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
        border: `1.5px solid ${
          selected.priority === '1st' ? '#d97706' :
          selected.priority === '2nd' ? '#0284c7' :
          selected.priority === '3rd' ? '#7c3aed' : C.border
        }`,
        fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
        background:
          selected.priority === '1st' ? '#fef9c3' :
          selected.priority === '2nd' ? '#e0f2fe' :
          selected.priority === '3rd' ? '#f3e8ff' : '#fff',
        color:
          selected.priority === '1st' ? '#854d0e' :
          selected.priority === '2nd' ? '#075985' :
          selected.priority === '3rd' ? '#6b21a8' : C.textMid,
      }}
    >
      <option value="">— Priority —</option>
      <option value="1st"> 1st Priority</option>
      <option value="2nd"> 2nd Priority</option>
      <option value="3rd">🥉 3rd Priority</option>
    </select>
  </div>
</div>
<div style={{ fontSize: 14, color: C.textLight, marginBottom: 10 }}>
  {selected.course_name} · {[selected.intake_month, selected.intake_year].filter(Boolean).join(' ') || 'Intake TBD'}
  {selected.representative && <span style={{ marginLeft: 10 }}> {selected.representative}</span>}
</div>         
              </div>

            <CollapsibleSection title="Application Details" defaultOpen={true} C={C}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Application Status</div>
                  <select value={selected.application_status} onChange={e => updateStatus('application_status', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                    {['initiated','pending_from_student','pending_from_LS','conditional_offer','unconditional_offer','case_closed','application_on_hold','funds_approved','offer_accepted','rejected','waitlisted', 'deferral','fee_paid','tuition_payment_not_done', 'visa_applied', 'visa_rejected','visa_approved']
                      .map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                  {REASON_REQUIRED_STATUSES.includes(selected.application_status) && (
                    <div style={{ marginTop: 10 }}>
                      <input type="text" placeholder="Enter reason"
                        value={selected.status_reason || ''}
                        onChange={e => updateStatus('status_reason', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13 }} />
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Application Deadline</div>
                  <input type="date" value={selected.application_deadline || ''} onChange={e => updateStatus('application_deadline', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Course Start Date</div>
                  <input type="date" value={selected.course_start_date || ''} onChange={e => updateStatus('course_start_date', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Course End Date</div>
                  <input type="date" value={selected.course_end_date || ''} onChange={e => updateStatus('course_end_date', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Tuition Fee</div>
                  <input type="number" value={selected.tuition_fee || ''} onChange={e => updateStatus('tuition_fee', e.target.value ? parseFloat(e.target.value) : null)} placeholder="e.g. 52000" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Currency</div>
                  <select value={selected.currency || 'USD'} onChange={e => updateStatus('currency', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                    {['USD','CAD','AUD','GBP','EUR','INR','NZD'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Duration (months)</div>
                  <input type="number" value={selected.course_duration_months || ''} onChange={e => updateStatus('course_duration_months', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 24" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Scholarship Amount</div>
                  <input type="number" value={selected.scholarship_amount || ''} onChange={e => updateStatus('scholarship_amount', e.target.value ? parseFloat(e.target.value) : null)} placeholder="e.g. 5000" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                {showVisaFields && (
                  <>
                    {/* Visa Applied Date */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                        Visa Applied Date
                      </div>
                      <input
                        type="date"
                        value={selected.visa_applied_date || ''}
                        onChange={e => updateStatus('visa_applied_date', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: `1.5px solid ${C.border}`,
                          fontSize: 13
                        }}
                      />
                    </div>

                    {/* Visa Decision Date */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                        Visa Decision Date
                      </div>
                      <input
                        type="date"
                        value={selected.visa_decision_date || ''}
                        onChange={e => updateStatus('visa_decision_date', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: `1.5px solid ${C.border}`,
                          fontSize: 13
                        }}
                      />
                    </div>
                  </>
                )}
                
              {showPaymentMode && (() => {
                  const fixedModes = ['flywire', 'canvera', 'forex', 'loan'];
                  const isOthers = selected.payment_mode && !fixedModes.includes(selected.payment_mode);
                  const selectValue = isOthers ? 'others' : (selected.payment_mode || '');

                  return (
                    <>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                          Payment Mode
                        </div>
                        <select
                          value={selectValue}
                          onChange={e => {
                            if (e.target.value === 'others') {
                              updateStatus('payment_mode', '');
                            } else {
                              updateStatus('payment_mode', e.target.value);
                            }
                          }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                        >
                          <option value="">Select Payment Mode</option>
                          <option value="flywire">Flywire</option>
                          <option value="canvera">Canvera</option>
                          <option value="forex">Forex</option>
                          <option value="loan">Loan</option>
                          <option value="others">Others</option>
                        </select>
                      </div>

                      {(isOthers || selected.payment_mode === '') && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                            Specify Payment Mode
                          </div>
                          <input
                            type="text"
                            placeholder="Enter payment mode"
                            value={isOthers ? selected.payment_mode : ''}
                            onChange={e => updateStatus('payment_mode', e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}

               {/* Custom fields — inline, same grid style */}
                {postAppFields.map(field => (
                  <CustomFieldInput key={field.id} field={field} value={customFieldValues[field.id] || ''}
                    onChange={v => setCustomFieldValues(p => ({ ...p, [field.id]: v }))} />
                ))}

                {/* Admin: add new custom field — spans full width */}
                {isAdmin && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <InlineAdminFieldAdder sectionKey="post_application" studentId={studentId} showToast={showToast} onFieldCreated={onCustomFieldCreated} />
                  </div>
                )}

              </div>
              {postAppFields.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => saveCustomFields('post_application')} disabled={cfSaving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                    {cfSaving && <Spinner size={13} />} Save Fields
                  </button>
                </div>
              )}
            </CollapsibleSection>


            {selected.notes && (
              <div style={{ background: C.amberLight, border: `1px solid #fde68a`, borderRadius: 10, padding: 14, fontSize: 13, color: C.amber, whiteSpace: 'pre-wrap' }}>
                {selected.notes}
              </div>
            )}

            <ChatPanel
              title={`Student Chat — ${selected.university?.name}`}
              subtitle={selected.course_name}
              messages={messages} loadingMsgs={loadingMsgs}
              chatMsg={chatMsg} setChatMsg={setChatMsg}
              chatFile={chatFile} setChatFile={setChatFile}
              chatEndRef={chatEndRef} canManage={canManage}
              onSend={sendMsg} studentId={studentId} sectionId={selectedId}
            />
          </div>
        )}
      </div>
    )
  );

  if (loading) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}><Spinner size={32} /></div>;

  return (
    <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '0 20px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, display: 'flex', alignItems: 'center' }}>
        {[{ id: 'pre', label: '1 · Apply to Programs' }, { id: 'post', label: '2 · Applied Programs' }].map(t => (
          <button key={t.id} onClick={() => setAppMode(t.id)}
            style={{ background: 'none', border: 'none', padding: '14px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: appMode === t.id ? C.accent : C.textLight, borderBottom: `2.5px solid ${appMode === t.id ? C.accent : 'transparent'}`, fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', padding: '8px 0' }}>
          <span style={{ fontSize: 12, color: C.textLight }}>{apps.length} application{apps.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {appMode === 'pre' ? PreApplicationView : PostApplicationView}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function StudentProfileModal({
  studentId: propStudentId,
  student: propStudent = {},
  onClose = () => {},
  onTabChange = () => {},
  isAdmin = false,
  isCounsellor = false,
  userRole = '',
  initialTab = 'profile',
  initialApplicationId = null,
  onRefresh,
}) {
  const studentId = propStudentId || propStudent.id;
  const isStudent = !isAdmin && !isCounsellor;

  // 'auto' means: start on Profile, but flip to Applications once data loads
  // if the core personal-info fields are filled. Other initialTab values are
  // honoured as-is.
  const autoTabResolveRef = useRef(initialTab === 'auto');
  const [activeTab, setActiveTab] = useState(initialTab === 'auto' ? 'profile' : initialTab);
  const [activeSection, setActiveSection] = useState('personal');
  const [extracting, setExtracting] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState(propStudent);
  const [loading, setLoading] = useState(true);

  const [academics, setAcademics] = useState([]);
  const [workExps, setWorkExps] = useState([]);
  const [testScores, setTestScores] = useState([]);
  const [testTypes, setTestTypes] = useState([]);

  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});

  const [personalForm, setPersonalForm] = useState({});
  const personalFormRef = useRef({});
  const [autofillVersion, setAutofillVersion] = useState(0);

  const [newAcademic, setNewAcademic] = useState({ level: '', institution: '', is_highest: false });
  const [newWork, setNewWork] = useState({ company_name: '', job_title: '', is_current: false });
  const [newTest, setNewTest] = useState({ test_type_id: '', test_date: '', overall_score: '', section_scores: {}, status: 'pending' });
  const [editingAcademic, setEditingAcademic] = useState(null);
  const [editingWork, setEditingWork] = useState(null);
  const [academicSaving, setAcademicSaving] = useState(null);
  const [workSaving, setWorkSaving] = useState(null);
  const [testSaving, setTestSaving] = useState(null);
  const [editingAcademicData, setEditingAcademicData] = useState({});
  const [editingWorkData, setEditingWorkData] = useState({});

  const showToast = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); }, []);
  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    onTabChange(tab);
  }, [onTabChange]);
  const setFormField = useCallback((key, value) => { personalFormRef.current[key] = value; setPersonalForm(p => ({ ...p, [key]: value })); }, []);
  const fieldChange = useCallback((key) => (value) => { personalFormRef.current[key] = value; }, []);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    const promises = [
      apiFetch(`/api/students/${studentId}`),
      apiFetch(`/api/students/${studentId}/academic`),
      apiFetch(`/api/students/${studentId}/work`),
      apiFetch(`/api/students/${studentId}/tests`),
      apiFetch('/api/admin/test-types?active_only=true'),
    ];
    if (isAdmin) { promises.push(apiFetch(`/api/admin/custom-fields/student/${studentId}?active_only=true`), apiFetch(`/api/students/${studentId}/custom-field-values`)); }
    Promise.all(promises).then((results) => {
      const [s, a, w, t, tt, cf, cfv] = results;
      const p = s || propStudent;
      setStudent(p);
      const form = {
        first_name: p.first_name || '', middle_name: p.middle_name || '', last_name: p.last_name || '',
        date_of_birth: p.date_of_birth || '', gender: p.gender || '', marital_status: p.marital_status || '',
        nationality: p.nationality || '', citizenship: p.citizenship || '',
        dual_citizenship: p.dual_citizenship || false, phone: p.phone || '',
        mailing_address1: p.mailing_address1 || '', mailing_address2: p.mailing_address2 || '',
        mailing_city: p.mailing_city || '', mailing_state: p.mailing_state || '',
        mailing_country: p.mailing_country || '', mailing_pincode: p.mailing_pincode || '',
        same_as_mailing: p.same_as_mailing || false,
        permanent_address1: p.permanent_address1 || '', permanent_address2: p.permanent_address2 || '',
        permanent_city: p.permanent_city || '', permanent_state: p.permanent_state || '',
        permanent_country: p.permanent_country || '', permanent_pincode: p.permanent_pincode || '',
        passport_number: p.passport_number || '', passport_issue_country: p.passport_issue_country || '',
        passport_issue_date: p.passport_issue_date || '', passport_expiry: p.passport_expiry || '',
        city_of_birth: p.city_of_birth || '', country_of_birth: p.country_of_birth || '',
        living_in_other_country: p.living_in_other_country || false, living_country: p.living_country || '',
        applied_for_immigration: p.applied_for_immigration || false,
        serious_medical_condition: p.serious_medical_condition || false,
        medical_condition_details: p.medical_condition_details || '',
        visa_refusal: p.visa_refusal || false, visa_refusal_details: p.visa_refusal_details || '',
        visa_refusal_countries: p.visa_refusal_countries || [],
        criminal_conviction: p.criminal_conviction || false, criminal_conviction_details: p.criminal_conviction_details || '',
        emergency_contact_name: p.emergency_contact_name || '', emergency_contact_email: p.emergency_contact_email || '',
        emergency_contact_phone: p.emergency_contact_phone || '', emergency_contact_relation: p.emergency_contact_relation || '',
        lead_status: p.lead_status || '', counsellor_id: p.counsellor_id || null,
      };
      personalFormRef.current = form;
      setPersonalForm(form);
      setAutofillVersion(v => v + 1);
      setAcademics(Array.isArray(a) ? a : []);
      setWorkExps(Array.isArray(w) ? w : []);
      setTestScores(Array.isArray(t) ? t : []);
      setTestTypes(Array.isArray(tt) ? tt : []);
      if (isAdmin) {
        setCustomFieldDefs(Array.isArray(cf) ? cf : []);
        const valMap = {};
        if (Array.isArray(cfv)) cfv.forEach(v => { valMap[v.field_id] = v.value_text || ''; });
        setCustomFieldValues(valMap);
      }
    }).catch(e => { showToast('Failed to load student data', 'error'); console.error(e); }).finally(() => {
      setLoading(false);
      // Auto-redirect to Applications tab if profile is sufficiently filled.
      // Only runs once per modal open, and only when caller asked for 'auto'.
      if (autoTabResolveRef.current) {
        autoTabResolveRef.current = false;
        const f = personalFormRef.current || {};
        const profileFilled = Boolean(
          f.first_name && f.last_name && f.date_of_birth && f.nationality && f.phone
        );
        if (profileFilled) changeTab('applications');
      }
    });
  }, [studentId, isAdmin]);

  useEffect(() => {
    if (isAdmin || !studentId) return;
    Promise.all([apiFetch(`/api/students/${studentId}/post-application-fields`), apiFetch(`/api/students/${studentId}/custom-field-values`)]).then(([cf, cfv]) => {
      setCustomFieldDefs(Array.isArray(cf) ? cf : []);
      const valMap = {};
      if (Array.isArray(cfv)) cfv.forEach(v => { valMap[v.field_id] = v.value_text || ''; });
      setCustomFieldValues(valMap);
    }).catch(() => {});
  }, [studentId, isAdmin]);

  const savePersonal = async () => {
    if (!studentId) return;
    const p = personalFormRef.current;
    const missing = [];
    if (!p.first_name?.trim()) missing.push('First Name');
    if (!p.last_name?.trim()) missing.push('Last Name');
    if (!p.date_of_birth?.trim()) missing.push('Date of Birth');
    if (!p.passport_number?.trim()) missing.push('Passport Number');
    if (!p.passport_expiry?.trim()) missing.push('Passport Expiry Date');
    if (missing.length > 0) { showToast(`Please fill in the required fields: ${missing.join(', ')}`, 'error'); setActiveSection('personal'); return; }
    setSaving(true);
    try {
      const payload = { ...p };
      if (isStudent) { delete payload.lead_status; delete payload.counsellor_id; }
      const updated = await apiFetch(`/api/students/${studentId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setStudent(updated); showToast('Profile saved successfully', 'success');
    } catch (e) {
      let msg = e.message || 'Failed to save profile';
      try { const parsed = JSON.parse(msg); if (Array.isArray(parsed)) { msg = parsed.map(err => { const field = err.loc?.[err.loc.length - 1] || ''; const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); return `${fieldLabel}: ${err.msg}`; }).join(' | '); } } catch { if (msg.includes('date_from_datetime_parsing') || msg.includes('input is too short')) { msg = 'Date of Birth is required and must be a valid date (dd-mm-yyyy)'; } }
      showToast(msg, 'error');
    }
    setSaving(false);
  };

  const handleCustomFieldCreated = useCallback(async (newField) => {
    try { const cf = await apiFetch(`/api/admin/custom-fields/student/${studentId}?active_only=true`); setCustomFieldDefs(Array.isArray(cf) ? cf : []); }
    catch { setCustomFieldDefs(prev => [...prev, newField]); }
  }, [studentId]);

  const saveAcademic = async (entry, isNew) => {
    const key = entry.id || 'new'; setAcademicSaving(key);
    try {
      if (isNew) {
        const res = await apiFetch(`/api/students/${studentId}/academic`, { method: 'POST', body: JSON.stringify(entry) });
        const newEntry = res.data || res;
        setAcademics(prev => [...prev, newEntry].sort((a, b) => (LEVEL_ORDER[a.level] || 0) - (LEVEL_ORDER[b.level] || 0)));
        setNewAcademic({ level: '', institution: '', is_highest: false });
        if (res.warnings?.length) showToast(`⚠ ${res.warnings.join('; ')}`, 'info'); else showToast('Qualification added', 'success');
      } else {
        const updated = await apiFetch(`/api/students/${studentId}/academic/${entry.id}`, { method: 'PATCH', body: JSON.stringify(entry) });
        setAcademics(prev => prev.map(a => a.id === entry.id ? updated : a)); setEditingAcademic(null); setEditingAcademicData({}); showToast('Qualification updated', 'success');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setAcademicSaving(null);
  };

  const deleteAcademic = async (id) => {
    if (!confirm('Delete this qualification?')) return;
    try { await apiFetch(`/api/students/${studentId}/academic/${id}`, { method: 'DELETE' }); setAcademics(prev => prev.filter(a => a.id !== id)); showToast('Qualification deleted', 'success'); } catch (e) { showToast(e.message, 'error'); }
  };

  const saveWork = async (entry, isNew) => {
    if (!entry.company_name?.trim()) { showToast('Company Name is required', 'error'); return; }
    if (!entry.job_title?.trim()) { showToast('Job Title is required', 'error'); return; }
    if (!entry.start_date?.trim()) { showToast('Start Date is required', 'error'); return; }
    if (!entry.is_current && !entry.end_date?.trim()) { showToast('End Date is required when not currently working here', 'error'); return; }
    const payload = { ...entry, start_date: entry.start_date?.trim() || null, end_date: entry.is_current ? null : (entry.end_date?.trim() || null) };
    const key = entry.id || 'new'; setWorkSaving(key);
    try {
      if (isNew) { const res = await apiFetch(`/api/students/${studentId}/work`, { method: 'POST', body: JSON.stringify(payload) }); setWorkExps(prev => [res, ...prev]); setNewWork({ company_name: '', job_title: '', is_current: false }); showToast('Experience added', 'success'); }
      else { const updated = await apiFetch(`/api/students/${studentId}/work/${entry.id}`, { method: 'PATCH', body: JSON.stringify(payload) }); setWorkExps(prev => prev.map(w => w.id === entry.id ? updated : w)); setEditingWork(null); setEditingWorkData({}); showToast('Experience updated', 'success'); }
    } catch (e) { showToast(e.message, 'error'); }
    setWorkSaving(null);
  };

  const deleteWork = async (id) => {
    if (!confirm('Delete this work experience?')) return;
    try { await apiFetch(`/api/students/${studentId}/work/${id}`, { method: 'DELETE' }); setWorkExps(prev => prev.filter(w => w.id !== id)); showToast('Experience deleted', 'success'); } catch (e) { showToast(e.message, 'error'); }
  };

  const saveTest = async (entry, isNew) => {
    setTestSaving(entry.id || 'new');
    try {
      const payload = { ...entry, test_type_id: parseInt(entry.test_type_id), overall_score: entry.overall_score ? parseFloat(entry.overall_score) : null };
      if (isNew) { const res = await apiFetch(`/api/students/${studentId}/tests`, { method: 'POST', body: JSON.stringify(payload) }); setTestScores(prev => [res, ...prev]); setNewTest({ test_type_id: '', test_date: '', overall_score: '', section_scores: {}, status: 'pending' }); showToast('Test score added', 'success'); }
      else { const updated = await apiFetch(`/api/students/${studentId}/tests/${entry.id}`, { method: 'PATCH', body: JSON.stringify(payload) }); setTestScores(prev => prev.map(t => t.id === entry.id ? updated : t)); showToast('Test score updated', 'success'); }
    } catch (e) { showToast(e.message, 'error'); }
    setTestSaving(null);
  };

  const deleteTest = async (id) => {
    if (!confirm('Delete this test score?')) return;
    try { await apiFetch(`/api/students/${studentId}/tests/${id}`, { method: 'DELETE' }); setTestScores(prev => prev.filter(t => t.id !== id)); showToast('Test score deleted', 'success'); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleAutofill = useCallback(async (sectionId, file, preExtracted) => {
    setExtracting(sectionId); showToast('Reading document with AI…', 'info');
    try {
      let extracted = preExtracted;
      if (!extracted) { showToast('AI extraction is not configured for this workspace yet.', 'warning'); return; }
      if (!extracted) return;
      const fieldMap = { passport: { passport_number: 'passport_number', issue_date: 'passport_issue_date', expiry_date: 'passport_expiry', issue_country: 'passport_issue_country', city_of_birth: 'city_of_birth', country_of_birth: 'country_of_birth', date_of_birth: 'date_of_birth', nationality: 'nationality' } };
      const map = fieldMap[sectionId] || {};
      let count = 0;
      if (sectionId === 'passport') { for (const [k, fk] of Object.entries(map)) { if (extracted[k]) { setFormField(fk, String(extracted[k])); count++; } } }
      setAutofillVersion(v => v + 1); showToast(`✅ Auto-filled ${count} field${count !== 1 ? 's' : ''}`, 'success');
    } catch (e) { showToast(`Could not extract: ${e.message}`, 'error'); } finally { setExtracting(null); }
  }, [showToast, setFormField]);

  const refs = {
    personal: useRef(), mailing: useRef(), permanent: useRef(), passport: useRef(),
    nationality: useRef(), background: useRef(), emergency: useRef(),
    academic: useRef(), work: useRef(), tests: useRef(),
  };

  const scrollTo = (id) => { changeTab('profile'); setActiveSection(id); setTimeout(() => refs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };

  const pf = personalForm;
  const today = new Date().toISOString().split('T')[0];
  const selectedTestTypeForNew = testTypes.find(t => t.id === parseInt(newTest.test_type_id));
  const displayName = [student?.first_name, student?.last_name].filter(Boolean).join(' ') || student?.email || 'Student';
  const initial = (student?.first_name?.[0] || '?').toUpperCase();

  const sections = [
    { id: 'personal', title: 'Personal Info', dot: !pf.first_name || !pf.date_of_birth ? 'red' : 'green' },
    { id: 'mailing', title: 'Mailing Address', dot: !pf.mailing_city ? 'amber' : 'green' },
    { id: 'permanent', title: 'Permanent Address', dot: !pf.permanent_city ? 'amber' : 'green' },
    { id: 'passport', title: 'Passport', dot: !pf.passport_number ? 'red' : 'green' },
    { id: 'nationality', title: 'Nationality', dot: !pf.nationality ? 'amber' : 'green' },
    { id: 'background', title: 'Background', dot: 'amber' },
    { id: 'emergency', title: 'Emergency', dot: !pf.emergency_contact_name ? 'amber' : 'green' },
    { id: 'academic', title: 'Academic', dot: academics.length === 0 ? 'red' : 'green' },
    { id: 'work', title: 'Work Exp', dot: workExps.length === 0 ? 'amber' : 'green' },
    { id: 'tests', title: 'Tests', dot: testScores.length === 0 ? 'red' : 'green' },
  ];

  const tabs = [
    { id: 'profile', label: '1 · Profile' },
    { id: 'applications', label: '2 · Applications' },
    { id: 'documents', label: '3 · Documents' },
    { id: 'notes', label: '4 · LetzStudy Notes' },
  ];

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center' }}><Spinner size={40} /><div style={{ marginTop: 16, color: C.textLight, fontSize: 14 }}>Loading student profile…</div></div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 500, overflowY: 'auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button { transition: opacity 0.15s; }
        button:hover { opacity: 0.88; }
      `}</style>
      <Toast toast={toast} />

      {/* TOP NAV */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 32px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, height: 52 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textDecoration: 'underline' }}>← Back</button>
          <span style={{ color: C.muted }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{displayName}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {activeTab === 'profile' && (
              <button onClick={savePersonal} disabled={saving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
                {saving && <Spinner size={13} />}Save Profile
              </button>
            )}
            <button onClick={onClose} style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: C.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Close</button>
          </div>
        </div>
      </div>

      {/* PROFILE HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '18px 32px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.accentLight, color: C.accent, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{displayName}</div>
              <div style={{ fontSize: 13, color: C.textLight, marginTop: 2, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span>✉ {student?.email}</span>
                {student?.phone && <span>+91 {student.phone}</span>}
                <span>Letzstudy email: {student.letzstudy_email}</span>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: student?.lead_status === 'converted' ? C.greenLight : C.amberLight, color: student?.lead_status === 'converted' ? C.green : C.amber }}>{(student?.lead_status || 'lead').toUpperCase()}</span>
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => changeTab(tab.id)}
                style={{ background: 'none', border: 'none', padding: '12px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: activeTab === tab.id ? C.accent : C.textLight, borderBottom: `2.5px solid ${activeTab === tab.id ? C.accent : 'transparent'}`, marginBottom: -1, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 32px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ══ PROFILE TAB ══ */}
        {activeTab === 'profile' && (
          <>
            <SideNav sections={sections} activeSection={activeSection} onNav={scrollTo} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SectionCard sectionRef={refs.personal} id="personal" title="Personal Information" badge={!pf.first_name || !pf.date_of_birth ? 'Incomplete' : 'Complete'} badgeColor={!pf.first_name ? 'red' : 'green'}>
                <Field label="First Name" value={pf.first_name} onChange={v => { fieldChange('first_name')(v); setPersonalForm(p => ({...p, first_name: v})); }} required />
                <Field label="Middle Name" value={pf.middle_name} onChange={fieldChange('middle_name')} />
                <Field label="Last Name" value={pf.last_name} onChange={v => { fieldChange('last_name')(v); setPersonalForm(p => ({...p, last_name: v})); }} required />
                <Field label="Email" value={student?.email} onChange={() => {}} disabled validate={isValidEmail} errorMsg="Email must contain @ and end with .com" />
                <Field label="Letzstudy email" value={student?.letzstudy_email} onChange={() => {}} disabled validate={isValidEmail} errorMsg="Email must contain @ and end with .com" />
                <Field label="Phone" value={pf.phone} onChange={fieldChange('phone')} type="tel" validate={isValidPhone} errorMsg="Phone must be exactly 10 digits" />
                <Field label="Date of Birth" value={pf.date_of_birth} onChange={v => setFormField('date_of_birth', v)} type="date" required max={today} validate={v => !v || new Date(v) <= new Date()} errorMsg="Date of birth cannot be in the future" />
                <Field label="Gender" value={pf.gender} onChange={v => setFormField('gender', v)} options={['Male', 'Female', 'Non-binary', 'Prefer not to say']} />
                <Field label="Marital Status" value={pf.marital_status} onChange={v => setFormField('marital_status', v)} options={['Single', 'Married', 'Divorced', 'Widowed']} />
                {isAdmin && <Field label="Lead Status" value={pf.lead_status} onChange={v => setFormField('lead_status', v)} options={['converted', 'hot', 'warm','cold', 'lost']} />}
              </SectionCard>

              <SectionCard sectionRef={refs.permanent} id="permanent" title="Permanent Address">
                <Field label="Address Line 1" value={pf.permanent_address1} onChange={fieldChange('permanent_address1')} full disabled={!!pf.same_as_mailing} />
                <Field label="Address Line 2" value={pf.permanent_address2} onChange={fieldChange('permanent_address2')} full disabled={!!pf.same_as_mailing} />
                <Field label="City" value={pf.permanent_city} onChange={fieldChange('permanent_city')} disabled={!!pf.same_as_mailing} />
                <Field label="State / Province" value={pf.permanent_state} onChange={fieldChange('permanent_state')} disabled={!!pf.same_as_mailing} />
                <Field label="Country" value={pf.permanent_country} onChange={fieldChange('permanent_country')} disabled={!!pf.same_as_mailing} />
                <Field label="Pincode / ZIP" value={pf.permanent_pincode} onChange={fieldChange('permanent_pincode')} disabled={!!pf.same_as_mailing} validate={isValidPincode} errorMsg="Pincode must contain digits only" />
              </SectionCard>

              <SectionCard sectionRef={refs.mailing} id="mailing" title="Mailing Address"
                action={
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.textMid }}>
                    <input type="checkbox" checked={!!pf.same_as_permanent} onChange={e => {
                      const v = e.target.checked; const ref = personalFormRef.current;
                      const updates = { same_as_permanent: v };
                      if (v) Object.assign(updates, { mailing_address1: ref.permanent_address1, mailing_address2: ref.permanent_address2, mailing_city: ref.permanent_city, mailing_state: ref.permanent_state, mailing_country: ref.permanent_country, mailing_pincode: ref.permanent_pincode });
                      Object.entries(updates).forEach(([k, val]) => setFormField(k, val));
                    }} />
                    Same as permanent
                  </label>
                }>
                <Field label="Address Line 1" value={pf.mailing_address1} onChange={fieldChange('mailing_address1')} full disabled={!!pf.same_as_permanent} />
                <Field label="Address Line 2" value={pf.mailing_address2} onChange={fieldChange('mailing_address2')} full disabled={!!pf.same_as_permanent} />
                <Field label="City" value={pf.mailing_city} onChange={fieldChange('mailing_city')} disabled={!!pf.same_as_permanent} />
                <Field label="State / Province" value={pf.mailing_state} onChange={fieldChange('mailing_state')} disabled={!!pf.same_as_permanent} />
                <Field label="Country" value={pf.mailing_country} onChange={fieldChange('mailing_country')} disabled={!!pf.same_as_permanent} />
                <Field label="Pincode / ZIP" value={pf.mailing_pincode} onChange={fieldChange('mailing_pincode')} disabled={!!pf.same_as_permanent} />
              </SectionCard>

              <SectionCard sectionRef={refs.passport} id="passport" title="Passport & Travel" badge={!pf.passport_number ? 'Incomplete' : 'Complete'} badgeColor={!pf.passport_number ? 'red' : 'green'}>
                <AutofillField key={`passport_number-${autofillVersion}`} label="Passport Number" value={personalFormRef.current.passport_number ?? pf.passport_number ?? ''} onChange={fieldChange('passport_number')} required />
                <AutofillField key={`passport_issue_country-${autofillVersion}`} label="Issue Country" value={personalFormRef.current.passport_issue_country ?? pf.passport_issue_country ?? ''} onChange={fieldChange('passport_issue_country')} />
                <AutofillField key={`passport_issue_date-${autofillVersion}`} label="Issue Date" value={personalFormRef.current.passport_issue_date ?? pf.passport_issue_date ?? ''} onChange={fieldChange('passport_issue_date')} type="date" max={today} validate={v => !v || new Date(v) <= new Date()} errorMsg="Issue date cannot be in the future" />
                <AutofillField key={`passport_expiry-${autofillVersion}`} label="Expiry Date" value={personalFormRef.current.passport_expiry ?? pf.passport_expiry ?? ''} onChange={fieldChange('passport_expiry')} type="date" required
                  validate={v => { if (!v) return true; const issueDate = personalFormRef.current.passport_issue_date || pf.passport_issue_date; if (issueDate && new Date(v) <= new Date(issueDate)) return false; return true; }}
                  errorMsg="Expiry date must be after the issue date" />
                <AutofillField key={`city_of_birth-${autofillVersion}`} label="City of Birth" value={personalFormRef.current.city_of_birth ?? pf.city_of_birth ?? ''} onChange={fieldChange('city_of_birth')} />
                <AutofillField key={`country_of_birth-${autofillVersion}`} label="Country of Birth" value={personalFormRef.current.country_of_birth ?? pf.country_of_birth ?? ''} onChange={fieldChange('country_of_birth')} />
              </SectionCard>

              <SectionCard sectionRef={refs.nationality} id="nationality" title="Nationality & Citizenship">
                <AutofillField key={`nationality-${autofillVersion}`} label="Nationality" value={personalFormRef.current.nationality ?? pf.nationality ?? ''} onChange={fieldChange('nationality')} />
                <Field label="Citizenship" value={pf.citizenship} onChange={fieldChange('citizenship')} />
                <Field label="Citizen of more than one country?" value={pf.dual_citizenship ? 'yes' : 'no'} onChange={v => setFormField('dual_citizenship', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                <Field label="Living & studying in another country?" value={pf.living_in_other_country ? 'yes' : 'no'} onChange={v => setFormField('living_in_other_country', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                {pf.living_in_other_country && <Field label="Which country?" value={pf.living_country} onChange={fieldChange('living_country')} />}
              </SectionCard>

              {/* Academic */}
              <div ref={refs.academic} id="academic" style={{ scrollMarginTop: 90 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Academic Qualifications</div>
                  <span style={{ fontSize: 12, color: C.textLight }}>{academics.length} qualifications · Add lowest level first</span>
                </div>
                {academics.map(entry => (
                  editingAcademic === entry.id ? (
                    <AcademicEntryForm key={entry.id} entry={{ ...entry, ...editingAcademicData }} isNew={false}
                      onChange={(k, v) => setEditingAcademicData(p => ({ ...p, [k]: v }))}
                      onSave={() => saveAcademic({ ...entry, ...editingAcademicData }, false)}
                      onDelete={isAdmin || isCounsellor ? () => deleteAcademic(entry.id) : undefined}
                      saving={academicSaving === entry.id} />
                  ) : (
                    <div key={entry.id} onClick={() => { setEditingAcademic(entry.id); setEditingAcademicData({ ...entry }); }}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)} onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ACADEMIC_LEVELS.find(l => l.value === entry.level)?.label || entry.level}</span>
                          {entry.is_highest && <span style={{ fontSize: 11, fontWeight: 700, background: C.accentLight, color: C.accent, padding: '2px 8px', borderRadius: 12 }}>Highest</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{entry.institution}{entry.board_university ? ` · ${entry.board_university}` : ''}{entry.degree_name ? ` · ${entry.degree_name}` : ''}{entry.field_of_study ? ` (${entry.field_of_study})` : ''}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{[entry.start_year, entry.end_year].filter(Boolean).join(' – ')}{entry.percentage_cgpa ? ` · ${entry.percentage_cgpa} ${entry.grading_scale || ''}` : ''}{entry.backlogs ? ` · ${entry.backlogs} backlogs` : ''}{entry.country ? ` · ${entry.country}` : ''}</div>
                      </div>
                      <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>Edit ›</span>
                    </div>
                  )
                ))}
                {editingAcademic === null && <AcademicEntryForm entry={newAcademic} isNew={true} onChange={(k, v) => setNewAcademic(p => ({ ...p, [k]: v }))} onSave={() => saveAcademic(newAcademic, true)} saving={academicSaving === 'new'} />}
              </div>

              {/* Work */}
              <div ref={refs.work} id="work" style={{ scrollMarginTop: 90 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Work Experience</div>
                  <span style={{ fontSize: 12, color: C.textLight }}>{workExps.length} entries</span>
                </div>
                {workExps.map(entry => (
                  editingWork === entry.id ? (
                    <WorkEntryForm key={entry.id} entry={{ ...entry, ...editingWorkData }} isNew={false}
                      onChange={(k, v) => setEditingWorkData(p => ({ ...p, [k]: v }))}
                      onSave={() => saveWork({ ...entry, ...editingWorkData }, false)}
                      onDelete={() => deleteWork(entry.id)} saving={workSaving === entry.id} />
                  ) : (
                    <div key={entry.id} onClick={() => { setEditingWork(entry.id); setEditingWorkData({ ...entry }); }}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)} onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{entry.job_title} <span style={{ fontWeight: 400, color: C.textLight }}>at</span> {entry.company_name}</div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{entry.employment_type}{entry.country ? ` · ${entry.country}` : ''}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{formatDate(entry.start_date)} – {entry.is_current ? 'Present' : formatDate(entry.end_date)}</div>
                      </div>
                      <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>Edit ›</span>
                    </div>
                  )
                ))}
                {editingWork === null && <WorkEntryForm entry={newWork} isNew={true} onChange={(k, v) => setNewWork(p => ({ ...p, [k]: v }))} onSave={() => saveWork(newWork, true)} saving={workSaving === 'new'} />}
              </div>

              {/* Tests */}
              <div ref={refs.tests} id="tests" style={{ scrollMarginTop: 90 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Test Scores</div>
                  <span style={{ fontSize: 12, color: C.textLight }}>{testScores.length} tests added</span>
                </div>
                {testScores.map(ts => (
                  <div key={ts.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ padding: '12px 16px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ts.test_type_ref?.name || `Test #${ts.test_type_id}`}</span>
                      <span style={{ fontSize: 12, color: ts.status === 'completed' ? C.green : C.amber, fontWeight: 600 }}>{ts.status}</span>
                      {ts.expiry_date && <span style={{ fontSize: 11, color: C.textLight }}>Expires: {formatDate(ts.expiry_date)}</span>}
                      <div style={{ marginLeft: 'auto' }}><button onClick={() => deleteTest(ts.id)} style={{ background: C.redLight, color: C.red, border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Delete</button></div>
                    </div>
                    <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                      {ts.test_type_ref?.has_overall_score && (
                        <div style={{ padding: '10px 12px', background: C.accentLight, borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>{ts.test_type_ref?.overall_score_label || 'Overall'}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{ts.overall_score ?? '—'}</div>
                        </div>
                      )}
                      {ts.section_scores && Object.entries(ts.section_scores).map(([k, v]) => {
                        const secDef = ts.test_type_ref?.sections?.find(s => s.key === k);
                        return (
                          <div key={k} style={{ padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>{secDef?.label || k}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{v}</div>
                          </div>
                        );
                      })}
                      <div style={{ padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: C.textLight }}>Test Date</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 }}>{formatDate(ts.test_date)}</div>
                      </div>
                      {ts.expiry_date && (
                        <div style={{ padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                          <div style={{ fontSize: 11, color: C.textLight }}>Expiry</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 }}>{formatDate(ts.expiry_date)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>+ Add Test Score</div>
                  {testTypes.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>No test types configured.{isAdmin ? ' Add them in the Admin Config tab.' : ' Contact admin to add test types.'}</div>
                  ) : (
                    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Test Type *</label>
                        <select value={newTest.test_type_id} onChange={e => setNewTest(p => ({ ...p, test_type_id: e.target.value, section_scores: {} }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                          <option value="">Select test type</option>
                          {testTypes.map(tt => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                        </select>
                      </div>
                      <Field label="Status" value={newTest.status} onChange={v => setNewTest(p => ({ ...p, status: v }))} options={[{ value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }, { value: 'expired', label: 'Expired' }]} />
                      <Field label="Test Date" value={newTest.test_date} onChange={v => setNewTest(p => ({ ...p, test_date: v }))} type="date" max={today} validate={v => !v || new Date(v) <= new Date()} errorMsg="Test date cannot be in the future" />
                      {selectedTestTypeForNew?.has_expiry && (
                        <Field label="Expiry Date" value={newTest.expiry_date} onChange={v => setNewTest(p => ({ ...p, expiry_date: v }))} type="date"
                          validate={v => { if (!v) return true; if (newTest.test_date && new Date(v) <= new Date(newTest.test_date)) return false; return true; }}
                          errorMsg="Expiry date must be after the test date" />
                      )}
                      {selectedTestTypeForNew?.has_overall_score && (
                        <Field label={selectedTestTypeForNew.overall_score_label || 'Overall Score'} value={newTest.overall_score}
                          onChange={v => { let clamped = v; if (v !== '' && selectedTestTypeForNew.overall_score_max != null && parseFloat(v) > selectedTestTypeForNew.overall_score_max) clamped = String(selectedTestTypeForNew.overall_score_max); if (v !== '' && selectedTestTypeForNew.overall_score_min != null && parseFloat(v) < selectedTestTypeForNew.overall_score_min) clamped = String(selectedTestTypeForNew.overall_score_min); setNewTest(p => ({ ...p, overall_score: clamped })); }}
                          type="number" min={selectedTestTypeForNew.overall_score_min} max={selectedTestTypeForNew.overall_score_max} step={selectedTestTypeForNew.overall_score_step}
                          validate={v => isValidScore(v, selectedTestTypeForNew.overall_score_min, selectedTestTypeForNew.overall_score_max)}
                          errorMsg={`Score must be between ${selectedTestTypeForNew.overall_score_min} and ${selectedTestTypeForNew.overall_score_max}`}
                          placeholder={selectedTestTypeForNew.overall_score_min != null && selectedTestTypeForNew.overall_score_max != null ? `${selectedTestTypeForNew.overall_score_min}–${selectedTestTypeForNew.overall_score_max}` : 'Score'} />
                      )}
                      {selectedTestTypeForNew?.sections?.length > 0 && (
                        <ScoreInputs testType={selectedTestTypeForNew} sectionScores={newTest.section_scores} onChange={(key, val) => setNewTest(p => ({ ...p, section_scores: { ...p.section_scores, [key]: parseFloat(val) || '' } }))} />
                      )}
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => saveTest(newTest, true)} disabled={!newTest.test_type_id || testSaving === 'new'} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: !newTest.test_type_id ? 0.5 : 1 }}>
                      {testSaving === 'new' && <Spinner size={14} />}Add Test Score
                    </button>
                  </div>
                </div>
              </div>

              <SectionCard sectionRef={refs.background} id="background" title="Background Information">
                <Field label="Applied for immigration into any country?" value={pf.applied_for_immigration ? 'yes' : 'no'} onChange={v => setFormField('applied_for_immigration', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                <Field label="Any serious medical condition?" value={pf.serious_medical_condition ? 'yes' : 'no'} onChange={v => setFormField('serious_medical_condition', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                {pf.serious_medical_condition && <Field label="Medical condition details" value={pf.medical_condition_details} onChange={v => setFormField('medical_condition_details', v)} type="textarea" full />}
                <Field label="Visa refused by any country?" value={pf.visa_refusal ? 'yes' : 'no'} onChange={v => setFormField('visa_refusal', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                {pf.visa_refusal && <>
                  <Field label="Visa refusal details" value={pf.visa_refusal_details} onChange={v => setFormField('visa_refusal_details', v)} type="textarea" full />
                  <Field label="Visa refusal countries (comma separated)" value={Array.isArray(pf.visa_refusal_countries) ? pf.visa_refusal_countries.join(', ') : ''} onChange={v => { const arr = v.split(',').map(s => s.trim()).filter(Boolean); setFormField('visa_refusal_countries', arr); }} full />
                </>}
                <Field label="Criminal conviction?" value={pf.criminal_conviction ? 'yes' : 'no'} onChange={v => setFormField('criminal_conviction', v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                {pf.criminal_conviction && <Field label="Conviction details" value={pf.criminal_conviction_details} onChange={v => setFormField('criminal_conviction_details', v)} type="textarea" full />}
              </SectionCard>

              <SectionCard sectionRef={refs.emergency} id="emergency" title="Emergency Contact">
                <Field label="Contact Name" value={pf.emergency_contact_name} onChange={fieldChange('emergency_contact_name')} />
                <Field label="Relation" value={pf.emergency_contact_relation} onChange={v => setFormField('emergency_contact_relation', v)} options={['Parent', 'Sibling', 'Spouse', 'Guardian', 'Friend', 'Other']} />
                <Field label="Phone" value={pf.emergency_contact_phone} onChange={fieldChange('emergency_contact_phone')} type="tel" validate={isValidPhone} errorMsg="Phone must be exactly 10 digits" />
                <Field label="Email" value={pf.emergency_contact_email} onChange={fieldChange('emergency_contact_email')} type="email" validate={isValidEmail} errorMsg="Email must contain @ and end with .com" />
              </SectionCard>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, paddingBottom: 32 }}>
                <button onClick={onClose} style={{ padding: '10px 20px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={savePersonal} disabled={saving} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {saving && <Spinner size={14} />}Save All Changes
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'applications' && (
          <ApplicationsTab
            studentId={studentId} showToast={showToast} isAdmin={isAdmin} isCounsellor={isCounsellor}
            userRole={userRole} customFieldDefs={customFieldDefs} customFieldValues={customFieldValues}
            setCustomFieldValues={setCustomFieldValues} onCustomFieldCreated={handleCustomFieldCreated}
            initialApplicationId={initialApplicationId} onRefresh={onRefresh}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab studentId={studentId} showToast={showToast} isAdmin={isAdmin} isCounsellor={isCounsellor} />
        )}

        {activeTab === 'notes' && <StudentNotesSection studentId={studentId} />}
      </div>
    </div>
  );
}

export default StudentProfileModal;

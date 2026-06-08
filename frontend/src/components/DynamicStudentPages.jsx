import { useMemo, useState } from 'react';
import { apiFetch, formatLabel } from '../utils';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'integer', label: 'Integer' },
  { value: 'float', label: 'Decimal Number' },
  { value: 'date', label: 'Date' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
];

export function mapDynamicValues(items = []) {
  return items.reduce((acc, item) => {
    acc[item.field_id] = item.value ?? '';
    return acc;
  }, {});
}

export function groupDynamicPageFields(fields = []) {
  const groups = new Map();
  fields
    .filter(field => field && (field.is_active ?? true))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.form_field_id ?? 0) - (b.form_field_id ?? 0))
    .forEach(field => {
      const sectionName = field.section_name || 'Additional Information';
      if (!groups.has(sectionName)) groups.set(sectionName, []);
      groups.get(sectionName).push(field);
    });
  return Array.from(groups.entries()).map(([sectionName, sectionFields]) => ({ sectionName, fields: sectionFields }));
}

export async function saveDynamicPageValues(studentId, pages = [], values = {}) {
  const fields = pages.flatMap(page => page.fields || []);
  const payload = {
    values: fields.map(field => ({ field_id: field.id, value: values[field.id] ?? '' })),
  };
  return apiFetch(`/api/student-dynamic-pages/students/${studentId}/values`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function DynamicPageCreator({ open, onClose, onCreated, showToast }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await apiFetch('/api/student-dynamic-pages', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
        }),
      });
      setForm({ name: '', description: '' });
      showToast?.('Page created', 'success');
      onCreated?.(created);
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Create Dynamic Page" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <ModalField label="Page Name" required>
          <input
            value={form.name}
            onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Visa Details"
            style={inputStyle}
            required
          />
        </ModalField>
        <ModalField label="Description">
          <textarea
            value={form.description}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            placeholder="Optional admin note"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </ModalField>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
          <button disabled={saving || !form.name.trim()} style={primaryButtonStyle}>{saving ? 'Creating...' : 'Create Page'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

export function DynamicStudentPageView({
  page,
  pages,
  studentId,
  values,
  setValues,
  isAdmin,
  showToast,
  onPagesChanged,
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [savingValues, setSavingValues] = useState(false);
  const groups = useMemo(() => groupDynamicPageFields(page?.fields || []), [page]);

  async function saveValues() {
    setSavingValues(true);
    try {
      await saveDynamicPageValues(studentId, pages, values);
      showToast?.('Dynamic page fields saved', 'success');
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setSavingValues(false);
    }
  }

  if (!page) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>{page.name}</h2>
          {page.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{page.description}</p>}
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setBuilderOpen(true)} style={outlineAccentButtonStyle}>
            + Add Section / Field
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #c8d3e8', borderRadius: 12, padding: 36, textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#374151', marginBottom: 6 }}>No sections yet</div>
          <div style={{ fontSize: 13 }}>Tenant admins can add section headers and fields for this page.</div>
        </div>
      ) : (
        groups.map(group => (
          <section key={group.sectionName} style={{ background: '#fff', border: '1px solid #e2e8f2', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid #e2e8f2', background: '#f8f9fc' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{group.sectionName}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#eef2ff', padding: '3px 9px', borderRadius: 20 }}>{group.fields.length} field{group.fields.length === 1 ? '' : 's'}</span>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {group.fields.map(field => (
                <DynamicFieldInput
                  key={field.id}
                  field={field}
                  value={values[field.id] || ''}
                  onChange={value => setValues(prev => ({ ...prev, [field.id]: value }))}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {page.fields?.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={saveValues} disabled={savingValues} style={primaryButtonStyle}>
            {savingValues ? 'Saving...' : 'Save Page Fields'}
          </button>
        </div>
      )}

      <SectionFieldBuilder
        open={builderOpen}
        page={page}
        onClose={() => setBuilderOpen(false)}
        onSaved={async updated => {
          setBuilderOpen(false);
          await onPagesChanged?.(updated);
        }}
        showToast={showToast}
      />
    </div>
  );
}

function DynamicFieldInput({ field, value, onChange }) {
  const fieldType = field.field_type || 'text';
  const label = field.field_label;
  const required = !!field.is_required;
  const commonProps = {
    value: value || '',
    onChange: event => onChange(event.target.value),
    placeholder: field.placeholder || '',
    required,
    style: inputStyle,
  };

  if (fieldType === 'dropdown' || fieldType === 'yes_no') {
    const options = fieldType === 'yes_no'
      ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
      : (field.options_json || []).map(item => ({ value: item, label: item }));
    return (
      <ModalField label={label} required={required}>
        <select {...commonProps}>
          <option value="">Select</option>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </ModalField>
    );
  }

  if (fieldType === 'long_text') {
    return (
      <ModalField label={label} required={required} full>
        <textarea {...commonProps} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
      </ModalField>
    );
  }

  const htmlType = {
    integer: 'number',
    float: 'number',
    number: 'number',
    date: 'date',
    email: 'email',
    url: 'url',
  }[fieldType] || 'text';

  return (
    <ModalField label={label} required={required}>
      <input {...commonProps} type={htmlType} step={fieldType === 'float' || fieldType === 'number' ? '0.01' : undefined} />
    </ModalField>
  );
}

function SectionFieldBuilder({ open, page, onClose, onSaved, showToast }) {
  const sectionOptions = useMemo(() => {
    const names = new Set((page?.fields || []).map(field => field.section_name).filter(Boolean));
    return Array.from(names);
  }, [page]);
  const [form, setForm] = useState(getBlankFieldForm(sectionOptions[0]));
  const [optionText, setOptionText] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addOption() {
    const next = optionText.trim();
    if (!next || form.options_json.includes(next)) return;
    setForm(prev => ({ ...prev, options_json: [...prev.options_json, next] }));
    setOptionText('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.section_name.trim() || !form.field_label.trim()) return;
    if (form.field_type === 'dropdown' && form.options_json.length < 2) {
      showToast?.('Dropdown fields need at least 2 options', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch(`/api/student-dynamic-pages/${page.id}/fields`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          section_name: form.section_name.trim(),
          field_label: form.field_label.trim(),
          placeholder: form.placeholder.trim() || null,
          options_json: form.field_type === 'dropdown' ? form.options_json : null,
          sort_order: page.fields?.length || 0,
        }),
      });
      setForm(getBlankFieldForm(form.section_name));
      showToast?.('Field added', 'success');
      onSaved?.(updated);
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Add Field - ${page.name}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ModalField label="Section Header" required>
          <input
            list={`dynamic-sections-${page.id}`}
            value={form.section_name}
            onChange={event => update('section_name', event.target.value)}
            placeholder="e.g. Visa History"
            style={inputStyle}
            required
          />
          <datalist id={`dynamic-sections-${page.id}`}>
            {sectionOptions.map(section => <option key={section} value={section} />)}
          </datalist>
        </ModalField>
        <ModalField label="Field Name" required>
          <input
            value={form.field_label}
            onChange={event => update('field_label', event.target.value)}
            placeholder="e.g. Previous Visa Refusal"
            style={inputStyle}
            required
          />
        </ModalField>
        <ModalField label="Field Type">
          <select value={form.field_type} onChange={event => update('field_type', event.target.value)} style={inputStyle}>
            {FIELD_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </ModalField>
        <ModalField label="Placeholder Hint">
          <input
            value={form.placeholder}
            onChange={event => update('placeholder', event.target.value)}
            placeholder="Optional placeholder text"
            style={inputStyle}
          />
        </ModalField>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          <input type="checkbox" checked={form.is_required} onChange={event => update('is_required', event.target.checked)} />
          Required field
        </label>
        {form.field_type === 'dropdown' && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ModalField label="Dropdown Options">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 28 }}>
                {form.options_json.map(option => (
                  <span key={option} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', borderRadius: 14, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>
                    {option}
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, options_json: prev.options_json.filter(item => item !== option) }))} style={{ border: 0, background: 'transparent', color: 'inherit', fontWeight: 800 }}>x</button>
                  </span>
                ))}
              </div>
            </ModalField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                value={optionText}
                onChange={event => setOptionText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addOption();
                  }
                }}
                placeholder="Type an option"
                style={inputStyle}
              />
              <button type="button" onClick={addOption} style={secondaryButtonStyle}>Add Option</button>
            </div>
          </div>
        )}
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
          <button disabled={saving || !form.section_name.trim() || !form.field_label.trim()} style={primaryButtonStyle}>
            {saving ? 'Saving...' : 'Save Field'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div onClick={event => event.target === event.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(15, 23, 42, 0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 'min(760px, 96vw)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f2', boxShadow: '0 24px 70px rgba(15, 23, 42, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid #e2e8f2' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, border: '1px solid #e2e8f2', borderRadius: 8, background: '#fff', color: '#6b7280', fontWeight: 800 }}>x</button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalField({ label, required, full, children }) {
  return (
    <label style={{ gridColumn: full ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function getBlankFieldForm(defaultSection = '') {
  return {
    section_name: defaultSection || '',
    field_label: '',
    field_type: 'text',
    placeholder: '',
    help_text: '',
    is_required: false,
    options_json: [],
  };
}

const inputStyle = {
  width: '100%',
  minHeight: 38,
  padding: '9px 12px',
  border: '1.5px solid #e2e8f2',
  borderRadius: 8,
  outline: 'none',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#0f172a',
  background: '#fff',
};

const primaryButtonStyle = {
  minHeight: 36,
  padding: '8px 16px',
  border: 0,
  borderRadius: 8,
  background: '#4f46e5',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryButtonStyle = {
  minHeight: 36,
  padding: '8px 14px',
  border: '1px solid #e2e8f2',
  borderRadius: 8,
  background: '#fff',
  color: '#374151',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const outlineAccentButtonStyle = {
  minHeight: 36,
  padding: '8px 14px',
  border: '1px dashed #c7d2fe',
  borderRadius: 8,
  background: '#eef2ff',
  color: '#4f46e5',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

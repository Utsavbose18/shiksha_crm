import React, { useState, useRef, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils';

const API_BASE = import.meta.env.VITE_API_URL;

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#f0f2f8', surface: '#ffffff', surfaceAlt: '#f8f9fc',
  border: '#e2e8f2', borderStrong: '#c8d3e8',
  accent: '#4f46e5', accentHover: '#4338ca', accentLight: '#eef2ff', accentMid: '#c7d2fe',
  red: '#dc2626', redLight: '#fef2f2',
  amber: '#d97706', amberLight: '#fffbeb',
  green: '#059669', greenLight: '#ecfdf5',
  blue: '#0284c7', blueLight: '#e0f2fe',
  purple: '#7c3aed', purpleLight: '#f5f3ff',
  text: '#0f172a', textMid: '#374151', textLight: '#6b7280', muted: '#9ca3af',
};

// ─── CATEGORY METADATA ────────────────────────────────────────────────────────
const CATEGORY_META = {
  academic:   { label: 'Education'              },
  language:   { label: 'Language & Test Scores' },
  financial:  { label: 'Financial'              },
  visa:       { label: 'Visa'                   },
  supporting: { label: 'Supporting'             },
  other:      { label: 'Other'                  },
};
const CATEGORY_ORDER = ['academic', 'language', 'financial', 'visa', 'supporting', 'other'];

// ─── LETZSTUDY CATEGORY METADATA ─────────────────────────────────────────────
const LETZSTUDY_CATEGORY_META = {
  visa:      { label: 'Admission & Visa' },
  financial: { label: 'Financial'        },
  other:     { label: 'Other'            },
};
const LETZSTUDY_CATEGORY_ORDER = ['visa', 'financial', 'other'];

const LETZ_TAG = '__letzstudy__';

const OCR_ENABLED_DOC_TYPES = new Set([
  'passport', 'marksheet_10', 'marksheet_12', 'diploma_transcripts',
  'ug_degree_transcripts', 'masters_transcript', 'cv',
  'ielts', 'toefl', 'pte', 'duolingo', 'gre', 'gmat', 'sat', 'act', 'offer_letter',
]);

const ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
  'image/tiff', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const EDUCATION_LEVELS = [
  { value: 'below_10th', label: 'Below 10th',  visibleDocTypes: new Set([]) },
  { value: '10th',       label: '10th / SSC',   visibleDocTypes: new Set(['marksheet_10','sop','lor','cv']) },
  { value: '12th',       label: '12th / HSC',   visibleDocTypes: new Set(['marksheet_10','marksheet_12','transfer_cert','moi_cert','sop','lor','cv']) },
  { value: 'diploma',    label: 'Diploma',       visibleDocTypes: new Set(['marksheet_10','marksheet_12','diploma_cert','diploma_transcripts','transfer_cert','moi_cert','backlog_cert','sop','lor','cv']) },
  { value: 'bachelor',   label: "Bachelor's",    visibleDocTypes: new Set(['marksheet_10','marksheet_12','ug_degree_cert','ug_degree_transcripts','ug_provisional_cert','transfer_cert','moi_cert','backlog_cert','sop','lor','cv']) },
  { value: 'master',     label: "Master's",      visibleDocTypes: new Set(['marksheet_10','marksheet_12','ug_degree_cert','ug_degree_transcripts','masters_cert','masters_transcript','provisional_cert','transfer_cert','moi_cert','backlog_cert','diploma_cert','diploma_transcripts','sop','lor','cv']) },
  { value: 'phd',        label: 'PhD',           visibleDocTypes: new Set(['marksheet_10','marksheet_12','ug_degree_cert','ug_degree_transcripts','masters_cert','masters_transcript','provisional_cert','transfer_cert','moi_cert','backlog_cert','diploma_cert','diploma_transcripts','phd_cert','sop','lor','cv']) },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function Spinner({ size = 16 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${C.accentMid}`, borderTopColor: C.accent,
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  );
}

function stripLetzTag(instructions) {
  if (!instructions) return '';
  return instructions.startsWith(LETZ_TAG) ? instructions.slice(LETZ_TAG.length) : instructions;
}

// ─── ACTIVE DOCUMENT CARD ─────────────────────────────────────────────────────
function ActiveDocCard({
  field, isAdmin, onUpload, onDownload, onView, onDeleteFile, onDeleteField,
  uploading, downloading, viewing, uploaderName, stripTag,
}) {
  const fileInputRef = useRef();
  const hasFiles = field.files?.length > 0;
  const isOcr = OCR_ENABLED_DOC_TYPES.has(field.doc_type);
  const isUploading = uploading === field.id;

  const displayInstructions = stripTag ? stripLetzTag(field.instructions) : field.instructions;

  const metaRow = (label, value) => value ? (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: '18px' }}>
      <span style={{ fontWeight: 700, color: C.textMid, whiteSpace: 'nowrap', minWidth: 130 }}>{label}</span>
      <span style={{ color: C.textLight }}>{value}</span>
    </div>
  ) : null;

  return (
    <div style={{
      border: `1px solid ${hasFiles ? '#86efac' : C.border}`,
      borderLeft: `3px solid ${hasFiles ? C.green : C.border}`,
      borderRadius: 8, background: hasFiles ? '#f0fdf4' : '#fff', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: hasFiles ? `1px solid ${C.border}` : 'none' }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{hasFiles ? '✅' : '⬜'}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>
          {field.label}
          {field.is_required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
          {isOcr && (
            <span style={{ fontSize: 9, fontWeight: 700, color: C.purple, background: C.purpleLight, border: `1px solid #ddd6fe`, padding: '1px 5px', borderRadius: 6, marginLeft: 6 }}>
              ✦ AUTOFILL
            </span>
          )}
        </span>

        {isUploading && (
          <span style={{ fontSize: 11, color: C.purple, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Spinner size={10} />{isOcr ? 'OCR scanning…' : 'Uploading…'}
          </span>
        )}

        <input ref={fileInputRef} type="file" multiple accept={ALLOWED_MIME.join(',')}
          style={{ display: 'none' }} disabled={isUploading}
          onChange={e => { if (e.target.files?.length) { onUpload(field, Array.from(e.target.files)); e.target.value = ''; } }} />

        {hasFiles && (
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
            style={{ background: '#fff', color: C.textMid, border: `1.5px solid ${C.borderStrong}`, borderRadius: 6, padding: '5px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isUploading ? <Spinner size={10} /> : '+ Upload More'}
          </button>
        )}

        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
          style={{ background: '#fff', color: C.textMid, border: `1.5px solid ${C.borderStrong}`, borderRadius: 6, padding: '5px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {isUploading ? <Spinner size={10} /> : <>&#8635; {hasFiles ? 'Replace' : 'Upload'}</>}
        </button>

        {/* ── DELETE FIELD BUTTON (staff only, shown when no files OR always for admin) ── */}
        {isAdmin && (
          <button
            onClick={() => onDeleteField(field)}
            title="Remove this document field"
            style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '5px 8px', cursor: 'pointer', color: C.red, fontSize: 13,
              flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center',
              opacity: 0.7, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
          >
            🗑
          </button>
        )}
      </div>

      {hasFiles && (
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayInstructions && metaRow('Institution(s) Required For:', displayInstructions)}
          {metaRow('Uploaded On:', fmtDateTime(field.files[0]?.created_at))}
          {metaRow('Uploaded By:', uploaderName || '—')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid, whiteSpace: 'nowrap' }}>
              Uploaded Files ({field.files.length}):
            </span>
            {field.files.map(f => {
              const isViewable = f.mime_type && (f.mime_type === 'application/pdf' || f.mime_type.startsWith('image/'));
              return (
                <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span onClick={() => isViewable && onView(f)}
                    style={{ fontSize: 12, color: isViewable ? C.accent : C.textMid, cursor: isViewable ? 'pointer' : 'default', textDecoration: isViewable ? 'underline' : 'none', fontWeight: 500 }}
                    title={f.stored_name}>
                    {f.stored_name}
                  </span>
                  {f.is_verified && <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>✓</span>}
                  <button onClick={() => onDeleteFile(f)} title="Delete file"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 13, padding: '0 1px', lineHeight: 1, flexShrink: 0 }}>
                    🗑
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENT SELECTOR DROPDOWN ───────────────────────────────────────────────
function DocumentSelectorDropdown({ fields, selectedIds, onToggle, onSelectAll, onDeselectAll, onAddCustom, savingCustom, highestEducation }) {
  const [open, setOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState(new Set(CATEGORY_ORDER));
  const [addingCustom, setAddingCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ label: '', category: 'other', is_required: false, instructions: '' });
  const dropdownRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const visibleAcademicTypes = (() => {
    if (!highestEducation) return null;
    const lv = EDUCATION_LEVELS.find(l => l.value === highestEducation);
    return lv ? lv.visibleDocTypes : null;
  })();

  const grouped = {};
  CATEGORY_ORDER.forEach(cat => { grouped[cat] = []; });
  fields.forEach(f => {
    if (f.category === 'academic' && visibleAcademicTypes && f.doc_type !== 'other' && !visibleAcademicTypes.has(f.doc_type)) return;
    const cat = f.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });

  const totalSelected = selectedIds.size;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ background: open ? C.accentLight : '#fff', border: `1.5px solid ${open ? C.accent : C.border}`, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 700, color: open ? C.accent : C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', width: '100%', justifyContent: 'space-between', transition: 'all 0.15s' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📂</span>
          <span>Documents</span>
          {totalSelected > 0 && <span style={{ background: C.accent, color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>{totalSelected} selected</span>}
        </span>
        <span style={{ fontSize: 11, color: C.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: C.surface, border: `1.5px solid ${C.accentMid}`, borderRadius: 14, zIndex: 200, boxShadow: '0 12px 40px rgba(79,70,229,0.15)', maxHeight: 540, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: C.accentLight }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.accent }}>Select Documents to Manage</span>
            <button onClick={onSelectAll} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
            <button onClick={onDeselectAll} style={{ background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Clear All</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {CATEGORY_ORDER.map(cat => {
              const catFields = grouped[cat] || [];
              const meta = CATEGORY_META[cat];
              const isCatOpen = openCategories.has(cat);
              const checkedCount = catFields.filter(f => selectedIds.has(f.id)).length;
              const allChecked = catFields.length > 0 && checkedCount === catFields.length;
              const someChecked = checkedCount > 0 && !allChecked;
              return (
                <div key={cat} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div onClick={() => setOpenCategories(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', background: isCatOpen ? '#f1f5ff' : '#fff', userSelect: 'none' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{meta.label}</span>
                    {catFields.length > 0 && (
                      <input type="checkbox" checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked; }}
                        onChange={e => { e.stopPropagation(); catFields.forEach(f => { const has = selectedIds.has(f.id); if (e.target.checked && !has) onToggle(f.id); else if (!e.target.checked && has) onToggle(f.id); }); }}
                        onClick={e => e.stopPropagation()}
                        style={{ accentColor: C.accent, width: 15, height: 15, cursor: 'pointer' }} />
                    )}
                    <span style={{ fontSize: 10, color: C.muted, transform: isCatOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', marginLeft: 4 }}>▼</span>
                  </div>
                  {isCatOpen && (
                    <div style={{ background: '#fafbff' }}>
                      {catFields.length === 0
                        ? <div style={{ padding: '10px 30px', fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No documents in this category</div>
                        : catFields.map(field => (
                          <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px 9px 36px', cursor: 'pointer', borderTop: `1px solid ${C.border}`, background: selectedIds.has(field.id) ? C.accentLight : 'transparent', transition: 'background 0.1s' }}>
                            <input type="checkbox" checked={selectedIds.has(field.id)} onChange={() => onToggle(field.id)}
                              style={{ accentColor: C.accent, width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, color: selectedIds.has(field.id) ? C.accent : C.text, fontWeight: selectedIds.has(field.id) ? 600 : 400 }}>{field.label}</span>
                            {field.files?.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenLight, padding: '2px 7px', borderRadius: 8, flexShrink: 0 }}>✓ {field.files.length}</span>}
                            {field.is_required && !field.files?.length && <span style={{ fontSize: 10, fontWeight: 700, color: C.red, flexShrink: 0 }}>required</span>}
                            {OCR_ENABLED_DOC_TYPES.has(field.doc_type) && <span style={{ fontSize: 9, fontWeight: 700, color: C.purple, background: C.purpleLight, border: `1px solid #ddd6fe`, padding: '1px 5px', borderRadius: 6, flexShrink: 0 }}>✦</span>}
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ padding: '12px 16px', background: '#fff' }}>
              {!addingCustom ? (
                <button onClick={() => setAddingCustom(true)}
                  style={{ background: 'none', border: `1.5px dashed ${C.accentMid}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.accent, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  + Add Custom Document
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>New Custom Document</div>
                  <input value={customForm.label} onChange={e => setCustomForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. NOC Letter, Affidavit" autoFocus
                    style={{ padding: '8px 12px', border: `1.5px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  <select value={customForm.category} onChange={e => setCustomForm(p => ({ ...p, category: e.target.value }))}
                    style={{ padding: '8px 12px', border: `1.5px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                    {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={customForm.is_required} onChange={e => setCustomForm(p => ({ ...p, is_required: e.target.checked }))} />
                    Mark as required
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { if (!customForm.label.trim()) return; onAddCustom({ ...customForm, doc_type: 'other', sort_order: 0 }); setCustomForm({ label: '', category: 'other', is_required: false, instructions: '' }); setAddingCustom(false); }}
                      disabled={!customForm.label.trim() || savingCustom}
                      style={{ flex: 1, background: C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !customForm.label.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {savingCustom && <Spinner size={11} />} Add Document
                    </button>
                    <button onClick={() => { setAddingCustom(false); setCustomForm({ label: '', category: 'other', is_required: false, instructions: '' }); }}
                      style={{ flex: 1, background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px', fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LETZSTUDY DOCUMENT SELECTOR DROPDOWN ────────────────────────────────────
function LetzStudyDocumentSelectorDropdown({ fields, selectedIds, onToggle, onSelectAll, onDeselectAll, onAddCustom, savingCustom }) {
  const [open, setOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState(new Set(LETZSTUDY_CATEGORY_ORDER));
  const [addingCustom, setAddingCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ label: '', category: 'visa', is_required: false });
  const dropdownRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const grouped = {};
  LETZSTUDY_CATEGORY_ORDER.forEach(cat => { grouped[cat] = []; });
  fields.forEach(f => {
    const cat = f.category && grouped[f.category] !== undefined ? f.category : 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });

  const totalSelected = selectedIds.size;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ background: open ? C.accentLight : '#fff', border: `1.5px solid ${open ? C.accent : C.border}`, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 700, color: open ? C.accent : C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', width: '100%', justifyContent: 'space-between', transition: 'all 0.15s' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📂</span>
          <span>Documents</span>
          {totalSelected > 0 && <span style={{ background: C.accent, color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>{totalSelected} selected</span>}
        </span>
        <span style={{ fontSize: 11, color: C.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: C.surface, border: `1.5px solid ${C.accentMid}`, borderRadius: 14, zIndex: 200, boxShadow: '0 12px 40px rgba(79,70,229,0.15)', maxHeight: 540, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: C.accentLight }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.accent }}>Select Documents to Manage</span>
            <button onClick={onSelectAll} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
            <button onClick={onDeselectAll} style={{ background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Clear All</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {LETZSTUDY_CATEGORY_ORDER.map(cat => {
              const catFields = grouped[cat] || [];
              const meta = LETZSTUDY_CATEGORY_META[cat];
              const isCatOpen = openCategories.has(cat);
              const checkedCount = catFields.filter(f => selectedIds.has(f.id)).length;
              const allChecked = catFields.length > 0 && checkedCount === catFields.length;
              const someChecked = checkedCount > 0 && !allChecked;
              return (
                <div key={cat} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div onClick={() => setOpenCategories(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', background: isCatOpen ? '#f1f5ff' : '#fff', userSelect: 'none' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{meta.label}</span>
                    <span style={{ fontSize: 11, color: C.textLight, marginRight: 4 }}>{checkedCount}/{catFields.length}</span>
                    {catFields.length > 0 && (
                      <input type="checkbox" checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked; }}
                        onChange={e => { e.stopPropagation(); catFields.forEach(f => { const has = selectedIds.has(f.id); if (e.target.checked && !has) onToggle(f.id); else if (!e.target.checked && has) onToggle(f.id); }); }}
                        onClick={e => e.stopPropagation()}
                        style={{ accentColor: C.accent, width: 15, height: 15, cursor: 'pointer' }} />
                    )}
                    <span style={{ fontSize: 10, color: C.muted, transform: isCatOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', marginLeft: 4 }}>▼</span>
                  </div>
                  {isCatOpen && (
                    <div style={{ background: '#fafbff' }}>
                      {catFields.length === 0
                        ? <div style={{ padding: '10px 30px', fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No documents yet — add one below</div>
                        : catFields.map(field => (
                          <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px 9px 36px', cursor: 'pointer', borderTop: `1px solid ${C.border}`, background: selectedIds.has(field.id) ? C.accentLight : 'transparent', transition: 'background 0.1s' }}>
                            <input type="checkbox" checked={selectedIds.has(field.id)} onChange={() => onToggle(field.id)}
                              style={{ accentColor: C.accent, width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, color: selectedIds.has(field.id) ? C.accent : C.text, fontWeight: selectedIds.has(field.id) ? 600 : 400 }}>{field.label}</span>
                            {field.files?.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenLight, padding: '2px 7px', borderRadius: 8, flexShrink: 0 }}>✓ {field.files.length}</span>}
                            {field.is_required && !field.files?.length && <span style={{ fontSize: 10, fontWeight: 700, color: C.red, flexShrink: 0 }}>required</span>}
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ padding: '12px 16px', background: '#fff' }}>
              {!addingCustom ? (
                <button onClick={() => setAddingCustom(true)}
                  style={{ background: 'none', border: `1.5px dashed ${C.accentMid}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.accent, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  + Add Custom Document
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>New Document</div>
                  <input value={customForm.label} onChange={e => setCustomForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. Offer Letter, I-20, Bank Statement" autoFocus
                    style={{ padding: '8px 12px', border: `1.5px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  <select value={customForm.category} onChange={e => setCustomForm(p => ({ ...p, category: e.target.value }))}
                    style={{ padding: '8px 12px', border: `1.5px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                    {LETZSTUDY_CATEGORY_ORDER.map(c => <option key={c} value={c}>{LETZSTUDY_CATEGORY_META[c].label}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={customForm.is_required} onChange={e => setCustomForm(p => ({ ...p, is_required: e.target.checked }))} />
                    Mark as required
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { if (!customForm.label.trim()) return; onAddCustom({ ...customForm, doc_type: 'other', sort_order: 0 }); setCustomForm({ label: '', category: 'visa', is_required: false }); setAddingCustom(false); }}
                      disabled={!customForm.label.trim() || savingCustom}
                      style={{ flex: 1, background: C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !customForm.label.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {savingCustom && <Spinner size={11} />} Add Document
                    </button>
                    <button onClick={() => { setAddingCustom(false); setCustomForm({ label: '', category: 'visa', is_required: false }); }}
                      style={{ flex: 1, background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px', fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EDUCATION LEVEL SELECTOR ─────────────────────────────────────────────────
function EducationLevelSelector({ value, onChange, saving }) {
  const current = EDUCATION_LEVELS.find(l => l.value === value);
  return (
    <div style={{ background: C.surface, border: `1.5px solid ${value ? C.accentMid : C.border}`, borderRadius: 10, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Highest Education Level</div>
        <div style={{ fontSize: 11, color: C.textLight, marginTop: 1 }}>{current ? current.label : 'Select to filter document checklist'}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {saving && <span style={{ fontSize: 11, color: C.purple, display: 'flex', alignItems: 'center', gap: 4 }}><Spinner size={11} />Saving…</span>}
        <div style={{ position: 'relative' }}>
          <select value={value || ''} onChange={e => onChange(e.target.value || null)} disabled={saving}
            style={{ appearance: 'none', WebkitAppearance: 'none', padding: '8px 32px 8px 12px', border: `1.5px solid ${value ? C.accentMid : C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: value ? C.accent : C.textMid, background: value ? C.accentLight : C.surfaceAlt, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', minWidth: 180 }}>
            <option value="">— Select level —</option>
            {EDUCATION_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10 }}>▼</span>
        </div>
      </div>
    </div>
  );
}

// ─── COUNTRY CHECKLIST MODAL ──────────────────────────────────────────────────
// Replaces the old CountryTemplateBar + ManageTemplatesModal with a single
// clean modal that handles apply, save, rename, and delete in one place.
function CountryChecklistModal({ open, onClose, studentId, selectedIds, onApplied, showToast }) {
  const [templates,     setTemplates]     = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [view,          setView]          = useState('apply');   // 'apply' | 'save' | 'manage'
  const [selectedTplId, setSelectedTplId] = useState('');
  const [replaceMode,   setReplaceMode]   = useState(true);
  const [applying,      setApplying]      = useState(false);
  const [savingCountry, setSavingCountry] = useState('');
  const [saving,        setSaving]        = useState(false);

  // Manage sub-state
  const [expandedId,    setExpandedId]    = useState(null);
  const [tplFields,     setTplFields]     = useState({});
  const [loadingFields, setLoadingFields] = useState(null);
  const [renamingId,    setRenamingId]    = useState(null);
  const [renameVal,     setRenameVal]     = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/country-templates/`);
      setTemplates(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) { loadTemplates(); setView('apply'); } }, [open, loadTemplates]);

  const expandTpl = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (tplFields[id]) return;
    setLoadingFields(id);
    try {
      const data = await apiFetch(`/api/country-templates/${id}`);
      setTplFields(prev => ({ ...prev, [id]: data.fields || [] }));
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
    finally { setLoadingFields(null); }
  };

  const handleApply = async () => {
    if (!selectedTplId) return;
    const tpl = templates.find(t => String(t.id) === String(selectedTplId));
    const label = tpl?.country || 'this checklist';
    if (replaceMode && !confirm(`Replace student's checklist with "${label}"?\n\nFields with uploaded files are always preserved.`)) return;
    setApplying(true);
    try {
      const updated = await apiFetch(
        `/api/country-templates/${selectedTplId}/apply-to-student/${studentId}?mode=${replaceMode ? 'replace' : 'merge'}`,
        { method: 'POST' }
      );
      const n = Array.isArray(updated) ? updated.length : 0;
      showToast(replaceMode ? `Applied "${label}" · ${n} doc(s)` : (n ? `Merged · ${n} total doc(s)` : 'Already up to date'), 'success');
      onApplied?.();
      onClose();
    } catch (e) { showToast(e.message || 'Apply failed', 'error'); }
    finally { setApplying(false); }
  };

  const handleSave = async () => {
    const country = savingCountry.trim();
    if (!country) { showToast('Enter a country name', 'error'); return; }
    if (selectedIds.size === 0) { showToast('Select at least one document first', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/country-templates/save-from-student/${studentId}`, {
        method: 'POST',
        body: JSON.stringify({ country, field_ids: [...selectedIds] }),
      });
      showToast(`Saved "${country}" checklist · ${selectedIds.size} doc(s)`, 'success');
      setSavingCountry('');
      loadTemplates();
      setView('apply');
    } catch (e) { showToast(e.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteTpl = async (tpl) => {
    if (!confirm(`Delete the "${tpl.country}" checklist? Applied students are not affected.`)) return;
    try {
      await apiFetch(`/api/country-templates/${tpl.id}`, { method: 'DELETE' });
      showToast(`Deleted "${tpl.country}"`, 'success');
      if (expandedId === tpl.id) setExpandedId(null);
      loadTemplates();
    } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
  };

  const submitRename = async (id) => {
    const name = renameVal.trim();
    if (!name) return;
    try {
      await apiFetch(`/api/country-templates/${id}`, { method: 'PATCH', body: JSON.stringify({ country: name }) });
      showToast(`Renamed to "${name}"`, 'success');
      setRenamingId(null);
      loadTemplates();
    } catch (e) { showToast(e.message || 'Rename failed', 'error'); }
  };

  const handleDeleteField = async (tplId, field) => {
    if (!confirm(`Remove "${field.label}" from this checklist?`)) return;
    try {
      await apiFetch(`/api/country-templates/${tplId}/fields/${field.id}`, { method: 'DELETE' });
      setTplFields(prev => ({ ...prev, [tplId]: (prev[tplId] || []).filter(f => f.id !== field.id) }));
      setTemplates(prev => prev.map(t => t.id === tplId ? { ...t, field_count: Math.max(0, (t.field_count || 1) - 1) } : t));
      showToast('Field removed', 'success');
    } catch (e) { showToast(e.message || 'Remove failed', 'error'); }
  };

  if (!open) return null;

  const TAB_BTN = (id, label) => (
    <button onClick={() => setView(id)} style={{
      flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700,
      background: view === id ? C.accent : 'transparent',
      color: view === id ? '#fff' : C.textLight,
      border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all 0.15s',
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, width: 'min(560px,100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🌍</span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.text }}>Country Document Checklists</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.textLight, padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        {/* Tab switcher */}
        <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 4, background: C.surfaceAlt }}>
          {TAB_BTN('apply',  '⬇ Apply')}
          {TAB_BTN('save',   '💾 Save Current')}
          {TAB_BTN('manage', '✏️ Manage')}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 18 }}>

          {/* ── APPLY TAB ── */}
          {view === 'apply' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: C.textLight }}>
                Pick a saved country checklist and apply it to this student.
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size={24} /></div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', background: C.surfaceAlt, borderRadius: 10, color: C.muted, fontSize: 13 }}>
                  No saved checklists yet.{' '}
                  <button onClick={() => setView('save')} style={{ background: 'none', border: 'none', color: C.accent, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Save one now →</button>
                </div>
              ) : (
                <>
                  {/* Country grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {templates.map(t => (
                      <button key={t.id} onClick={() => setSelectedTplId(String(t.id) === selectedTplId ? '' : String(t.id))}
                        style={{
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          border: `2px solid ${String(t.id) === selectedTplId ? C.accent : C.border}`,
                          background: String(t.id) === selectedTplId ? C.accentLight : '#fff',
                          transition: 'all 0.15s',
                        }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: String(t.id) === selectedTplId ? C.accent : C.text }}>{t.country}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.field_count} doc{t.field_count === 1 ? '' : 's'}</div>
                      </button>
                    ))}
                  </div>

                  {/* Mode */}
                  <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textMid, marginBottom: 2 }}>Apply Mode</div>
                    {[
                      { id: true,  label: 'Replace', desc: 'Student gets exactly the template — extras without files are removed' },
                      { id: false, label: 'Merge',   desc: 'Only add missing fields, preserve everything else' },
                    ].map(opt => (
                      <label key={String(opt.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                        <input type="radio" checked={replaceMode === opt.id} onChange={() => setReplaceMode(opt.id)}
                          style={{ accentColor: C.accent, marginTop: 2, flexShrink: 0 }} />
                        <span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{opt.label}</span>
                          <span style={{ fontSize: 11, color: C.textLight, marginLeft: 6 }}>{opt.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <button onClick={handleApply} disabled={!selectedTplId || applying}
                    style={{ background: selectedTplId ? C.accent : C.border, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: selectedTplId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}>
                    {applying ? <Spinner size={14} /> : '⬇'} {selectedTplId ? `Apply ${templates.find(t => String(t.id) === selectedTplId)?.country || ''}` : 'Select a country above'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── SAVE TAB ── */}
          {view === 'save' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: C.textLight }}>
                Save the <strong style={{ color: C.text }}>{selectedIds.size} currently-selected document{selectedIds.size === 1 ? '' : 's'}</strong> as a reusable checklist for a country.
              </div>

              {selectedIds.size === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 20px', background: C.amberLight, border: `1px solid #fde68a`, borderRadius: 10, color: C.amber, fontSize: 13, fontWeight: 600 }}>
                  ⚠️ Select at least one document from the main view first, then come back here.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      value={savingCountry}
                      onChange={e => setSavingCountry(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                      placeholder="Country name — e.g. Germany, UK, Canada"
                      autoFocus
                      style={{ flex: 1, padding: '10px 14px', border: `1.5px solid ${C.accentMid}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button onClick={handleSave} disabled={!savingCountry.trim() || saving}
                      style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: (!savingCountry.trim() || saving) ? 'not-allowed' : 'pointer', opacity: (!savingCountry.trim() || saving) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      {saving && <Spinner size={12} />} Save {selectedIds.size} doc{selectedIds.size === 1 ? '' : 's'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: C.textLight }}>
                    If a checklist for this country already exists it will be replaced. File contents are never copied.
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── MANAGE TAB ── */}
          {view === 'manage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size={24} /></div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: C.muted, fontSize: 13 }}>No saved checklists yet.</div>
              ) : templates.map(tpl => {
                const isExpanded = expandedId === tpl.id;
                const isRenaming = renamingId === tpl.id;
                const fields = tplFields[tpl.id] || [];
                return (
                  <div key={tpl.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isExpanded ? C.accentLight : '#fff' }}>
                      {isRenaming ? (
                        <>
                          <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') submitRename(tpl.id); if (e.key === 'Escape') setRenamingId(null); }}
                            autoFocus
                            style={{ flex: 1, padding: '5px 9px', border: `1.5px solid ${C.accentMid}`, borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                          <button onClick={() => submitRename(tpl.id)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setRenamingId(null)} style={{ background: '#fff', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 11px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => expandTpl(tpl.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.textLight, padding: 0, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▶</button>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: isExpanded ? C.accent : C.text }}>{tpl.country}</span>
                          <span style={{ fontSize: 11, color: C.textLight }}>{tpl.field_count} doc{tpl.field_count === 1 ? '' : 's'}</span>
                          <button onClick={() => { setRenamingId(tpl.id); setRenameVal(tpl.country); }}
                            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, color: C.textMid, cursor: 'pointer' }}>✏️</button>
                          <button onClick={() => handleDeleteTpl(tpl)}
                            style={{ background: 'none', border: `1px solid ${C.red}`, borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, color: C.red, cursor: 'pointer' }}>🗑</button>
                        </>
                      )}
                    </div>
                    {isExpanded && !isRenaming && (
                      <div style={{ background: C.surfaceAlt, borderTop: `1px solid ${C.border}` }}>
                        {loadingFields === tpl.id ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner size={16} /></div>
                        ) : fields.length === 0 ? (
                          <div style={{ padding: '10px 16px', fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No documents in this checklist.</div>
                        ) : fields.map(f => (
                          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: `1px solid ${C.border}` }}>
                            <span style={{ flex: 1, fontSize: 12, color: C.text }}>
                              {f.label}
                              {f.is_required && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
                              <span style={{ marginLeft: 8, fontSize: 10, color: C.muted, fontWeight: 600 }}>
                                {(CATEGORY_META[f.category] || LETZSTUDY_CATEGORY_META[f.category])?.label || f.category}
                              </span>
                            </span>
                            <button onClick={() => handleDeleteField(tpl.id, f)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 13, padding: '2px 4px' }} title="Remove from checklist">🗑</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 8 }}>
                Editing a checklist here does not affect documents already applied to existing students.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SHARED FILE HANDLERS ─────────────────────────────────────────────────────
function useFileHandlers({ studentId, setFields, showToast, applicationId }) {
  const [uploading,   setUploading]   = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [viewing,     setViewing]     = useState(null);

  const handleUpload = async (field, fileList) => {
    for (const file of fileList) {
      if (!ALLOWED_MIME.includes(file.type)) { showToast(`Unsupported: ${file.name}`, 'error'); return; }
      if (file.size > 50 * 1024 * 1024) { showToast(`Too large: ${file.name}`, 'error'); return; }
    }
    setUploading(field.id);
    try {
      const formData = new FormData();
      fileList.forEach(f => formData.append('files', f));
      const token = localStorage.getItem('crm_access_token');
      const isOfferLetter = field.doc_type === 'offer_letter';
      const url = isOfferLetter && applicationId
        ? `${API_BASE}/api/students/${studentId}/documents/fields/${field.id}/upload?application_id=${applicationId}`
        : `${API_BASE}/api/students/${studentId}/documents/fields/${field.id}/upload`;
      const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed'); }
      const newFiles = await res.json();
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, files: [...(f.files || []), ...newFiles] } : f));
      const filled = newFiles.reduce((n, f) => n + (f.extracted_data?._autofill?.updated_fields?.length || 0), 0);
      showToast(filled > 0 ? `${newFiles.length} file(s) uploaded · ✦ ${filled} field(s) auto-filled` : `${newFiles.length} file(s) uploaded`, 'success');
    } catch (e) { showToast(e.message || 'Upload failed', 'error'); }
    finally { setUploading(null); }
  };

  const handleDownload = async (file) => {
    setDownloading(file.id);
    try {
      const token = localStorage.getItem('crm_access_token');
      const res = await fetch(`${API_BASE}/api/students/${studentId}/documents/files/${file.id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file.stored_name || 'file';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { showToast(e.message || 'Download failed', 'error'); }
    finally { setDownloading(null); }
  };

  const handleView = async (file) => {
    setViewing(file.id);
    try {
      const token = localStorage.getItem('crm_access_token');
      const res = await fetch(`${API_BASE}/api/students/${studentId}/documents/files/${file.id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Could not fetch file');
      const blob = await res.blob();
      const typed = new Blob([blob], { type: file.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(typed);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { showToast(e.message || 'Could not open file', 'error'); }
    finally { setViewing(null); }
  };

  const handleDeleteFile = async (file) => {
    if (!confirm(`Delete "${file.stored_name}"?`)) return;
    try {
      await apiFetch(`/api/students/${studentId}/documents/files/${file.id}`, { method: 'DELETE' });
      setFields(prev => prev.map(f => ({ ...f, files: (f.files || []).filter(fi => fi.id !== file.id) })));
      showToast('File deleted', 'success');
    } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
  };

  return { uploading, downloading, viewing, handleUpload, handleDownload, handleView, handleDeleteFile };
}

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
const selectedIdsStorageKey     = (id) => `doc_selected_${id}`;
const letzSelectedIdsStorageKey = (id) => `letz_doc_selected_${id}`;

// ─── STUDENT DOCUMENTS TAB ────────────────────────────────────────────────────
function StudentDocumentsTab({ studentId, showToast, isAdmin, isCounsellor, studentName }) {
  const canManage = isAdmin || isCounsellor;
  const [fields,               setFields]               = useState([]);
  const [loading,              setLoading]              = useState(true);
  const [seeding,              setSeeding]              = useState(null);   // null | 'all' | category string
  const [addingField,          setAddingField]          = useState(false);
  const [highestEducation,     setHighestEducation]     = useState(null);
  const [savingEducation,      setSavingEducation]      = useState(false);
  const [applications,         setApplications]         = useState([]);
  const [selectedApplicationId,setSelectedApplicationId]= useState(null);
  const [checklistOpen,        setChecklistOpen]        = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => {
    try { const s = localStorage.getItem(selectedIdsStorageKey(studentId)); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });

  const loadApplications = useCallback(async () => {
    try { const data = await apiFetch(`/api/students/${studentId}/applications/`); setApplications(data || []); }
    catch (err) { console.log('Could not load applications:', err); }
  }, [studentId]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const { uploading, downloading, viewing, handleUpload, handleDownload, handleView, handleDeleteFile } =
    useFileHandlers({ studentId, setFields, showToast, applicationId: selectedApplicationId });

  const loadFields = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/students/${studentId}/documents/fields/?include_inactive=false`);
      const arr = Array.isArray(data) ? data : [];
      const studentFields = arr.filter(f => !f.instructions?.startsWith(LETZ_TAG));
      setFields(studentFields);
      setSelectedIds(prev => { const next = new Set(prev); studentFields.forEach(f => { if (f.files?.length > 0) next.add(f.id); }); return next; });
    } catch { showToast('Failed to load document fields', 'error'); }
    finally { setLoading(false); }
  }, [studentId]);

  useEffect(() => { loadFields(); }, [loadFields]);
  useEffect(() => { try { localStorage.setItem(selectedIdsStorageKey(studentId), JSON.stringify([...selectedIds])); } catch {} }, [selectedIds, studentId]);
  useEffect(() => { if (!studentId) return; apiFetch(`/api/students/${studentId}`).then(d => setHighestEducation(d.highest_education || null)).catch(() => {}); }, [studentId]);

  const handleEducationChange = async (newLevel) => {
    setHighestEducation(newLevel);
    setSavingEducation(true);
    try {
      await apiFetch(`/api/students/${studentId}`, { method: 'PATCH', body: JSON.stringify({ highest_education: newLevel }) });
      showToast(newLevel ? 'Education level updated' : 'Education level cleared', 'success');
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
    finally { setSavingEducation(false); }
  };

  // Seed all standard fields (initial seed)
  const seedAll = async () => {
    if (!confirm('Seed all standard document fields?')) return;
    setSeeding('all');
    try {
      const created = await apiFetch(`/api/students/${studentId}/documents/fields/seed`, { method: 'POST', body: JSON.stringify({ categories: null }) });
      showToast(`Seeded ${created.length} fields`, 'success');
      loadFields();
    } catch (e) { showToast(e.message || 'Seed failed', 'error'); }
    finally { setSeeding(null); }
  };

  // Seed a single category (re-seed missing fields for that section only)
  const seedCategory = async (category) => {
    setSeeding(category);
    try {
      const created = await apiFetch(`/api/students/${studentId}/documents/fields/seed`, {
        method: 'POST',
        body: JSON.stringify({ categories: [category] }),
      });
      if (created.length === 0) {
        showToast(`All standard ${CATEGORY_META[category]?.label || category} fields already exist`, 'info');
      } else {
        showToast(`Added ${created.length} missing field(s) to ${CATEGORY_META[category]?.label || category}`, 'success');
        loadFields();
      }
    } catch (e) { showToast(e.message || 'Seed failed', 'error'); }
    finally { setSeeding(null); }
  };

  const addCustomField = async (form) => {
    setAddingField(true);
    try {
      const created = await apiFetch(`/api/students/${studentId}/documents/fields/`, { method: 'POST', body: JSON.stringify(form) });
      setFields(prev => [...prev, { ...created, files: [] }]);
      setSelectedIds(prev => new Set([...prev, created.id]));
      showToast(`"${created.label}" added`, 'success');
    } catch (e) { showToast(e.message || 'Failed to add field', 'error'); }
    finally { setAddingField(false); }
  };

  // Soft-delete (deactivate) a field
  const handleDeleteField = async (field) => {
    const hasFiles = field.files?.length > 0;
    const msg = hasFiles
      ? `Remove "${field.label}" from this student?\n\nThis field has ${field.files.length} uploaded file(s) — they will be preserved but the field will be hidden. A staff member can restore it.`
      : `Remove "${field.label}" from this student's document checklist?`;
    if (!confirm(msg)) return;
    try {
      await apiFetch(`/api/students/${studentId}/documents/fields/${field.id}`, { method: 'DELETE' });
      setFields(prev => prev.filter(f => f.id !== field.id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(field.id); return n; });
      showToast(`"${field.label}" removed`, 'success');
    } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
  };

  const toggleId    = (id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll   = () => setSelectedIds(new Set(filteredFields.map(f => f.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const visibleAcademicTypes = (() => {
    if (!highestEducation) return null;
    const lv = EDUCATION_LEVELS.find(l => l.value === highestEducation);
    return lv ? lv.visibleDocTypes : null;
  })();

  const filteredFields = fields.filter(f => {
    if (f.category !== 'academic') return true;
    if (!visibleAcademicTypes) return true;
    if (f.doc_type === 'other') return true;
    return visibleAcademicTypes.has(f.doc_type);
  });

  const activeFields    = filteredFields.filter(f => selectedIds.has(f.id));
  const uploadedCount   = activeFields.filter(f => f.files?.length > 0).length;
  const requiredMissing = activeFields.filter(f => f.is_required && !f.files?.length).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <EducationLevelSelector value={highestEducation} onChange={handleEducationChange} saving={savingEducation} />

      {/* Country checklist: single compact button */}
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setChecklistOpen(true)}
            style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            🌍 Country Checklists
          </button>
          <CountryChecklistModal
            open={checklistOpen}
            onClose={() => setChecklistOpen(false)}
            studentId={studentId}
            selectedIds={selectedIds}
            onApplied={loadFields}
            showToast={showToast}
          />
        </div>
      )}

      {activeFields.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.textLight }}>
              {uploadedCount}/{activeFields.length} uploaded
              {requiredMissing > 0 && <span style={{ marginLeft: 10, color: C.red, fontWeight: 600 }}>· {requiredMissing} required missing</span>}
            </div>
            <div style={{ marginTop: 6, height: 4, background: C.border, borderRadius: 10, overflow: 'hidden', maxWidth: 280 }}>
              <div style={{ width: `${activeFields.length ? (uploadedCount / activeFields.length) * 100 : 0}%`, height: '100%', background: uploadedCount === activeFields.length ? C.green : C.accent, borderRadius: 10, transition: 'width 0.3s' }} />
            </div>
          </div>
          <span style={{ fontSize: 11, color: C.purple, background: C.purpleLight, border: `1px solid #ddd6fe`, padding: '4px 10px', borderRadius: 8 }}>✦ OCR auto-fill active</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : filteredFields.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>No document fields yet</div>
          {canManage && (
            <button onClick={seedAll} disabled={seeding === 'all'}
              style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {seeding === 'all' ? <Spinner size={13} /> : '⚡'} Seed Standard Fields
            </button>
          )}
        </div>
      ) : (
        <>
          <DocumentSelectorDropdown
            fields={filteredFields} selectedIds={selectedIds}
            onToggle={toggleId} onSelectAll={selectAll} onDeselectAll={deselectAll}
            onAddCustom={addCustomField} savingCustom={addingField} highestEducation={highestEducation}
          />
          {activeFields.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: C.surface, border: `1.5px dashed ${C.border}`, borderRadius: 12, color: C.muted }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>☝️</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textMid, marginBottom: 4 }}>No documents selected</div>
              <div style={{ fontSize: 13 }}>Open the "Documents" dropdown above → expand a category → check the documents you want to manage.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {CATEGORY_ORDER.map(cat => {
                const catFields = activeFields.filter(f => (f.category || 'other') === cat);
                if (catFields.length === 0) return null;
                const meta = CATEGORY_META[cat];
                const uploadedInCat = catFields.filter(f => f.files?.length > 0).length;
                const pct = Math.round((uploadedInCat / catFields.length) * 100);
                const allDone = uploadedInCat === catFields.length;
                const isSeedingCat = seeding === cat;
                return (
                  <div key={cat}>
                    {/* Section header with Seed Again */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: `1.5px solid ${C.border}` }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: allDone ? C.green : C.textLight, fontWeight: allDone ? 700 : 400 }}>{uploadedInCat}/{catFields.length} uploaded</span>
                      <div style={{ width: 80, height: 5, background: C.border, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 10, background: allDone ? C.green : C.accent, transition: 'width 0.3s' }} />
                      </div>
                      {/* Per-category Seed button — staff only */}
                      {canManage && (
                        <button
                          onClick={() => seedCategory(cat)}
                          disabled={!!seeding}
                          title={`Re-seed missing standard fields for ${meta.label}`}
                          style={{
                            background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6,
                            padding: '4px 10px', fontSize: 11, fontWeight: 600, color: C.textMid,
                            cursor: seeding ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                            opacity: seeding && seeding !== cat ? 0.5 : 1,
                          }}>
                          {isSeedingCat ? <Spinner size={10} /> : '⚡'} Seed
                        </button>
                      )}
                    </div>

                    {/* Application selector in Visa */}
                    {cat === 'visa' && catFields.some(f => f.doc_type === 'offer_letter') && applications.length > 0 && (
                      <div style={{ marginBottom: 10, padding: '10px 14px', background: C.accentLight, border: `1px solid ${C.accentMid}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>🔗 Link offer letter OCR to application:</span>
                        <select value={selectedApplicationId || ''} onChange={e => setSelectedApplicationId(e.target.value ? Number(e.target.value) : null)}
                          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.accentMid}`, background: '#fff', color: C.text, cursor: 'pointer', flex: 1, minWidth: 200 }}>
                          <option value=''>— select application —</option>
                          {applications.map(app => (
                            <option key={app.id} value={app.id}>
                              {app.university?.name || `Application #${app.id}`}
                              {app.course_name ? ` · ${app.course_name}` : ''}
                            </option>
                          ))}
                        </select>
                        {selectedApplicationId && (
                          <button onClick={() => setSelectedApplicationId(null)} style={{ fontSize: 11, background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', padding: '2px 6px' }}>✕ clear</button>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {catFields.map(field => (
                        <ActiveDocCard key={field.id} field={field} isAdmin={canManage}
                          uploading={uploading} downloading={downloading} viewing={viewing}
                          onUpload={handleUpload} onDownload={handleDownload}
                          onView={handleView} onDeleteFile={handleDeleteFile}
                          onDeleteField={handleDeleteField}
                          uploaderName={studentName} stripTag={false} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── LETZSTUDY DOCUMENTS TAB ──────────────────────────────────────────────────
function LetzStudyDocumentsTab({ studentId, showToast }) {
  const [fields,                setFields]                = useState([]);
  const [loading,               setLoading]               = useState(true);
  const [addingField,           setAddingField]           = useState(false);
  const [seeding,               setSeeding]               = useState(null);
  const [checklistOpen,         setChecklistOpen]         = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => {
    try { const s = localStorage.getItem(letzSelectedIdsStorageKey(studentId)); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });
  const [applications,          setApplications]          = useState([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);

  const loadApplications = useCallback(async () => {
    try { const data = await apiFetch(`/api/students/${studentId}/applications/`); setApplications(data || []); }
    catch (err) { console.log('Could not load applications:', err); }
  }, [studentId]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const { uploading, downloading, viewing, handleUpload, handleDownload, handleView, handleDeleteFile } =
    useFileHandlers({ studentId, setFields, showToast, applicationId: selectedApplicationId });

  const loadFields = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/students/${studentId}/documents/fields/?include_inactive=false`);
      const arr = Array.isArray(data) ? data : [];
      const letzFields = arr.filter(f => f.instructions?.startsWith(LETZ_TAG));
      setFields(letzFields);
      setSelectedIds(prev => { const next = new Set(prev); letzFields.forEach(f => { if (f.files?.length > 0) next.add(f.id); }); return next; });
    } catch { showToast('Failed to load LetzStudy documents', 'error'); }
    finally { setLoading(false); }
  }, [studentId]);

  useEffect(() => { loadFields(); }, [loadFields]);
  useEffect(() => { try { localStorage.setItem(letzSelectedIdsStorageKey(studentId), JSON.stringify([...selectedIds])); } catch {} }, [selectedIds, studentId]);

  const addCustomField = async (form) => {
    setAddingField(true);
    try {
      const payload = { ...form, doc_type: 'other', sort_order: 0, instructions: LETZ_TAG + (form.instructions || '') };
      const created = await apiFetch(`/api/students/${studentId}/documents/fields/`, { method: 'POST', body: JSON.stringify(payload) });
      setFields(prev => [...prev, { ...created, files: [] }]);
      setSelectedIds(prev => new Set([...prev, created.id]));
      showToast(`"${created.label}" added`, 'success');
    } catch (e) { showToast(e.message || 'Failed to add field', 'error'); }
    finally { setAddingField(false); }
  };

  const handleDeleteField = async (field) => {
    const hasFiles = field.files?.length > 0;
    const msg = hasFiles
      ? `Remove "${field.label}"?\n\n${field.files.length} uploaded file(s) will be preserved but hidden.`
      : `Remove "${field.label}" from this checklist?`;
    if (!confirm(msg)) return;
    try {
      await apiFetch(`/api/students/${studentId}/documents/fields/${field.id}`, { method: 'DELETE' });
      setFields(prev => prev.filter(f => f.id !== field.id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(field.id); return n; });
      showToast(`"${field.label}" removed`, 'success');
    } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
  };

  const toggleId    = (id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll   = () => setSelectedIds(new Set(fields.map(f => f.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const activeFields  = fields.filter(f => selectedIds.has(f.id));
  const uploadedCount = activeFields.filter(f => f.files?.length > 0).length;

  const grouped = {};
  LETZSTUDY_CATEGORY_ORDER.forEach(cat => { grouped[cat] = []; });
  activeFields.forEach(f => {
    const cat = LETZSTUDY_CATEGORY_ORDER.includes(f.category) ? f.category : 'other';
    grouped[cat].push(f);
  });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Country checklist button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setChecklistOpen(true)}
          style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          🌍 Country Checklists
        </button>
        <CountryChecklistModal
          open={checklistOpen}
          onClose={() => setChecklistOpen(false)}
          studentId={studentId}
          selectedIds={selectedIds}
          onApplied={loadFields}
          showToast={showToast}
        />
      </div>

      <LetzStudyDocumentSelectorDropdown
        fields={fields} selectedIds={selectedIds}
        onToggle={toggleId} onSelectAll={selectAll} onDeselectAll={deselectAll}
        onAddCustom={addCustomField} savingCustom={addingField}
      />

      {activeFields.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.textLight }}>{uploadedCount}/{activeFields.length} uploaded</div>
            <div style={{ marginTop: 6, height: 4, background: C.border, borderRadius: 10, overflow: 'hidden', maxWidth: 280 }}>
              <div style={{ width: `${activeFields.length ? (uploadedCount / activeFields.length) * 100 : 0}%`, height: '100%', background: uploadedCount === activeFields.length ? C.green : C.accent, borderRadius: 10, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>No documents yet</div>
          <div style={{ fontSize: 13, color: C.textLight }}>Use the "Documents" dropdown above → "+ Add Custom Document".</div>
        </div>
      ) : activeFields.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 20px', background: C.surface, border: `1.5px dashed ${C.border}`, borderRadius: 12, color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>☝️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textMid, marginBottom: 4 }}>No documents selected</div>
          <div style={{ fontSize: 13 }}>Open the "Documents" dropdown and check the documents you want to manage.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {LETZSTUDY_CATEGORY_ORDER.map(cat => {
            const catFields = grouped[cat] || [];
            if (catFields.length === 0) return null;
            const meta = LETZSTUDY_CATEGORY_META[cat];
            const uploadedInCat = catFields.filter(f => f.files?.length > 0).length;
            const pct = Math.round((uploadedInCat / catFields.length) * 100);
            const allDone = uploadedInCat === catFields.length;
            const hasOfferLetter = catFields.some(f => f.doc_type === 'offer_letter');
            return (
              <div key={cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: `1.5px solid ${C.border}` }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: allDone ? C.green : C.textLight, fontWeight: allDone ? 700 : 400 }}>{uploadedInCat}/{catFields.length} uploaded</span>
                  <div style={{ width: 80, height: 5, background: C.border, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 10, background: allDone ? C.green : C.accent, transition: 'width 0.3s' }} />
                  </div>
                </div>

                {cat === 'visa' && hasOfferLetter && applications.length > 0 && (
                  <div style={{ marginBottom: 10, padding: '10px 14px', background: C.accentLight, border: `1px solid ${C.accentMid}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxSizing: 'border-box' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, whiteSpace: 'nowrap', flexShrink: 0 }}>🔗 Link Offer Letter:</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <select value={selectedApplicationId || ''} onChange={e => setSelectedApplicationId(e.target.value ? Number(e.target.value) : null)}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.accentMid}`, background: '#fff', color: C.text, cursor: 'pointer' }}>
                        <option value="">— Select Application —</option>
                        {applications.map(app => (
                          <option key={app.id} value={app.id}>
                            {app.university?.name || `Application #${app.id}`}{app.course_name ? ` · ${app.course_name}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedApplicationId && (
                      <button onClick={() => setSelectedApplicationId(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: C.textLight, flexShrink: 0 }}>✕</button>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {catFields.map(field => (
                    <ActiveDocCard key={field.id} field={field} isAdmin={true}
                      uploading={uploading} downloading={downloading} viewing={viewing}
                      onUpload={handleUpload} onDownload={handleDownload}
                      onView={handleView} onDeleteFile={handleDeleteFile}
                      onDeleteField={handleDeleteField}
                      uploaderName={null} stripTag={true} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function DocumentsTab({ studentId, showToast, isAdmin, isCounsellor, studentName }) {
  const [activeTab, setActiveTab] = useState('student');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}`, marginBottom: 20 }}>
        {[
          { id: 'student',   label: '📁 Student Documents' },
          { id: 'letzstudy', label: '🏢 LetzStudy Documents' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ background: 'none', border: 'none', borderBottom: `3px solid ${activeTab === tab.id ? C.accent : 'transparent'}`, marginBottom: -2, padding: '10px 24px', fontSize: 14, fontWeight: 700, color: activeTab === tab.id ? C.accent : C.textLight, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'student'
        ? <StudentDocumentsTab studentId={studentId} showToast={showToast} isAdmin={isAdmin} isCounsellor={isCounsellor} studentName={studentName} />
        : <LetzStudyDocumentsTab studentId={studentId} showToast={showToast} />
      }
    </div>
  );
}

export default DocumentsTab;
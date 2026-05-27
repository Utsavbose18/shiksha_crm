import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { apiFetch } from '../utils';

/* ─── SVG Icon helper ─── */
const Icon = ({ d, size = 16, stroke = 'currentColor', fill = 'none', sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IC = {
  search:   'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  plus:     'M12 5v14M5 12h14',
  save:     'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  trash:    'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  table:    'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  image:    'M21 15l-5-5L5 21M3 3h18v18H3zM8.5 8.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0',
  list:     'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  note:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  user:     'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  calendar: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  edit:     'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  x:        'M18 6L6 18M6 6l12 12',
  check:    'M20 6L9 17l-5-5',
  spinner:  'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
};

const V = {
  bg:         '#f0f4f8',
  sidebar:    '#e8edf4',
  sidebarBdr: '#d1dbe8',
  accent:     '#3b6fd4',
  accentDark: '#2a52a8',
  accentDim:  '#6b8fd4',
  accentGlow: 'rgba(59,111,212,0.10)',
  editor:     '#ffffff',
  toolbar:    '#f8fafc',
  toolbarBdr: '#dce4ef',
  text:       '#1a2332',
  textDim:    '#4a5568',
  textMuted:  '#8fa0b4',
  danger:     '#e53e3e',
  border:     '#d1dbe8',
  sans:       "'DM Sans', system-ui, sans-serif",
  serif:      "'Georgia', serif",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
.enq-root *, .enq-root *::before, .enq-root *::after { box-sizing: border-box; }
.enq-root ::-webkit-scrollbar { width: 7px; }
.enq-root ::-webkit-scrollbar-thumb { background: #c5d0de; border-radius: 8px; }
.enq-root ::-webkit-scrollbar-track { background: transparent; }
.enq-ibtn { transition: background 0.12s, color 0.12s; }
.enq-ibtn:hover { background: rgba(59,111,212,0.08) !important; color: #3b6fd4 !important; }
.enq-ibtn.del:hover { background: rgba(229,62,62,0.08) !important; color: #e53e3e !important; }
.enq-tb { transition: background 0.13s, color 0.13s, transform 0.08s; }
.enq-tb:hover { background: rgba(59,111,212,0.08) !important; color: #3b6fd4 !important; }
.enq-tb:active { transform: scale(0.96); }
.enq-tb.pri { background: #3b6fd4 !important; color: white !important; font-weight: 600; }
.enq-tb.pri:hover { background: #2a52a8 !important; }
.enq-tb:disabled { opacity: 0.4 !important; cursor: not-allowed !important; pointer-events: none; }
.enq-editor { outline: none; caret-color: #3b6fd4; }
.enq-editor:empty::before { content: attr(data-ph); color: #a0aec0; pointer-events: none; font-style: italic; font-size: 1rem; }
.enq-editor h1 { font-family: 'Lora', serif; font-size: 2rem; font-weight: 600; color: #0f1923; margin: 0 0 0.4em; line-height: 1.2; }
.enq-editor h2 { font-family: 'Lora', serif; font-size: 1.45rem; font-weight: 600; color: #1a2332; margin: 0 0 0.35em; }
.enq-editor h3 { font-size: 0.85rem; font-weight: 700; color: #4a5568; margin: 0 0 0.3em; letter-spacing: 0.05em; text-transform: uppercase; }
.enq-editor p { margin: 0 0 0.8em; color: #1a2332; }
.enq-editor a { color: #3b6fd4; }
.enq-editor strong { color: #0f1923; font-weight: 700; }
.enq-editor em { color: #374151; }
.enq-editor ul, .enq-editor ol { padding-left: 1.5rem; margin: 0 0 0.8em; }
.enq-editor li { margin: 0.18em 0; color: #1a2332; }
.enq-editor ul li::marker { color: #3b6fd4; }
.enq-editor ol li::marker { color: #3b6fd4; font-size: 0.9em; }
.enq-editor blockquote { border-left: 4px solid #3b6fd4; margin: 0.9em 0; padding: 6px 0 6px 16px; color: #4a5568; font-style: italic; background: #f0f5ff; border-radius: 0 8px 8px 0; }
.enq-editor table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.92rem; }
.enq-editor table td, .enq-editor table th { border: 1px solid #d1dbe8; padding: 10px 12px; min-width: 80px; vertical-align: top; color: #1a2332; }
.enq-editor table tr:first-child td { background: #eff4ff; font-weight: 700; color: #2a52a8; border-color: #bfcfee; }
.enq-editor table tr:hover td { background: #f7f9fc; }
.enq-editor img { max-width: 100%; border-radius: 10px; margin: 8px 0; display: block; border: 1px solid #d1dbe8; }
.enq-editor iframe { border-radius: 10px; margin: 8px 0; border: 1px solid #d1dbe8 !important; }
.enq-input:focus { border-color: #3b6fd4 !important; outline: none; box-shadow: 0 0 0 3px rgba(59,111,212,0.12); }
.enq-input::placeholder { color: #a0aec0; }
.enq-student-card { transition: all 0.15s; border-radius: 10px; cursor: pointer; }
.enq-student-card:hover { background: rgba(59,111,212,0.07) !important; transform: translateX(2px); }
.enq-student-card.active { background: rgba(59,111,212,0.12) !important; border-left: 3px solid #3b6fd4 !important; }
@keyframes enq-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes enq-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.enq-toast { animation: enq-in 0.2s ease; }
.enq-spin { animation: enq-spin 0.8s linear infinite; }
.enq-modal-bg { position:fixed; inset:0; background:rgba(10,18,30,0.45); z-index:10000; display:flex; align-items:center; justify-content:center; animation: enq-in 0.15s ease; }
.enq-modal { background:white; border-radius:16px; padding:28px; width:420px; max-width:94vw; box-shadow:0 24px 60px rgba(0,0,0,0.2); }
.enq-tag { display:inline-flex; align-items:center; gap:4px; background:rgba(59,111,212,0.10); border:1px solid rgba(59,111,212,0.25); color:#3b6fd4; border-radius:6px; padding:2px 8px; font-size:0.72rem; font-weight:600; font-family:'DM Sans',sans-serif; letter-spacing:0.04em; }
`;

/* ─── API helpers ─── */
const api = {
  getStudents:   (params={}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/enquiry-notes/students${query ? '?' + query : ''}`).then(data => ({ data }));
  },
  createStudent: (payload)      => apiFetch('/api/enquiry-notes/students', { method:'POST', body: JSON.stringify(payload) }).then(data => ({ data })),
  updateStudent: (id, payload)  => apiFetch(`/api/enquiry-notes/students/${id}`, { method:'PUT', body: JSON.stringify(payload) }).then(data => ({ data })),
  deleteStudent: (id)           => apiFetch(`/api/enquiry-notes/students/${id}`, { method:'DELETE' }).then(data => ({ data })),
  getNotes:      (enquiry_id)   => apiFetch(`/api/enquiry-notes/?enquiry_id=${enquiry_id}`).then(data => ({ data })),
  createNote:    (payload)      => apiFetch('/api/enquiry-notes/', { method:'POST', body: JSON.stringify(payload) }).then(data => ({ data })),
  updateNote:    (id, payload)  => apiFetch(`/api/enquiry-notes/${id}`, { method:'PUT', body: JSON.stringify(payload) }).then(data => ({ data })),
};

function wc(html) {
  const t = (html || '').replace(/<[^>]*>/g, ' ').trim();
  return { words: t ? t.split(/\s+/).length : 0, chars: t.replace(/\s/g, '').length };
}
const YEARS = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i);

/* ── Student Modal ── */
// function StudentModal({ initial, onSave, onClose }) {
//   const [name, setName]             = useState(initial?.name || '');
//   const [intakeYear, setIntakeYear] = useState(initial?.intake_year || new Date().getFullYear());
//   const [saving, setSaving]         = useState(false);
//   const [err, setErr]               = useState('');

//   async function submit() {
//     if (!name.trim()) { setErr('Name is required'); return; }
//     setSaving(true);
//     try {
//       await onSave({ name: name.trim(), intake_year: Number(intakeYear) });
//       onClose();
//     } catch (e) {
//       setErr(e?.message || 'Failed to save');
//     } finally { setSaving(false); }
//   }

//   return (
//     <div className="enq-modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
//       <div className="enq-modal">
//         <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
//           <h3 style={{ margin:0, fontFamily:V.sans, fontWeight:700, fontSize:'1.05rem', color:V.text }}>
//             {initial ? 'Edit Enquiry Student' : 'New Enquiry Student'}
//           </h3>
//           <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:V.textMuted, padding:4, borderRadius:6, display:'flex' }}>
//             <Icon d={IC.x} size={18} />
//           </button>
//         </div>

//         <label style={{ display:'block', marginBottom:14 }}>
//           <span style={{ fontSize:'0.75rem', fontWeight:600, color:V.textDim, fontFamily:V.sans, letterSpacing:'0.05em', textTransform:'uppercase', display:'block', marginBottom:6 }}>
//             Student Name *
//           </span>
//           <input
//             className="enq-input"
//             value={name}
//             onChange={e => { setName(e.target.value); setErr(''); }}
//             placeholder="e.g. Priya Sharma"
//             style={{ width:'100%', padding:'10px 13px', border:`1px solid ${V.border}`, borderRadius:9, fontFamily:V.sans, fontSize:'0.92rem', color:V.text, background:'#f8fafc' }}
//             onKeyDown={e => e.key === 'Enter' && submit()}
//             autoFocus
//           />
//         </label>

//         <label style={{ display:'block', marginBottom:20 }}>
//           <span style={{ fontSize:'0.75rem', fontWeight:600, color:V.textDim, fontFamily:V.sans, letterSpacing:'0.05em', textTransform:'uppercase', display:'block', marginBottom:6 }}>
//             Intake Year *
//           </span>
//           <select
//             className="enq-input"
//             value={intakeYear}
//             onChange={e => setIntakeYear(e.target.value)}
//             style={{ width:'100%', padding:'10px 13px', border:`1px solid ${V.border}`, borderRadius:9, fontFamily:V.sans, fontSize:'0.92rem', color:V.text, background:'#f8fafc', cursor:'pointer' }}
//           >
//             {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
//           </select>
//         </label>

//         {err && <div style={{ color:V.danger, fontSize:'0.78rem', fontFamily:V.sans, marginBottom:12 }}>{err}</div>}

//         <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
//           <button onClick={onClose} style={{ padding:'9px 18px', background:'none', border:`1px solid ${V.border}`, borderRadius:9, fontFamily:V.sans, fontSize:'0.82rem', color:V.textDim, cursor:'pointer' }}>
//             Cancel
//           </button>
//           <button onClick={submit} disabled={saving} style={{ padding:'9px 18px', background:V.accent, border:'none', borderRadius:9, fontFamily:V.sans, fontSize:'0.82rem', color:'white', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
//             {saving
//               ? <Icon d={IC.spinner} size={14} className="enq-spin" stroke="white" />
//               : <Icon d={IC.check} size={14} stroke="white" />}
//             {initial ? 'Update' : 'Create'}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function StudentModal({ initial, onSave, onClose }) {
//   const [name, setName] = useState(initial?.name || '');
//   const [intakeYear, setIntakeYear] = useState(
//     initial?.intake_year || new Date().getFullYear()
//   );
//   const [saving, setSaving] = useState(false);
//   const [err, setErr] = useState('');

//   async function submit(e) {
//     e.preventDefault();

//     if (!name.trim()) {
//       setErr('Name is required');
//       return;
//     }

//     setSaving(true);
//     setErr('');

//     try {
//       await onSave({
//         name: name.trim(),
//         intake_year: Number(intakeYear),
//       });
//       onClose();
//     } catch (e) {
//       setErr(e?.message || 'Failed to save');
//     } finally {
//       setSaving(false);
//     }
//   }

//   return (
//     <div
//       onClick={(e) => e.target === e.currentTarget && onClose()}
//       style={{
//         position: 'fixed',
//         inset: 0,
//         zIndex: 10000,
//         background: 'rgba(10,18,30,0.45)',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         padding: 20,
//       }}
//     >
//       <div
//         onClick={(e) => e.stopPropagation()}
//         style={{
//           width: '100%',
//           maxWidth: 520,
//           background: '#ffffff',
//           border: `1px solid ${V.border}`,
//           borderRadius: 16,
//           boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
//           overflow: 'hidden',
//         }}
//       >
//         <form onSubmit={submit}>
//           <div
//             style={{
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'space-between',
//               padding: '18px 20px',
//               borderBottom: `1px solid ${V.border}`,
//               background: '#ffffff',
//             }}
//           >
//             <h3
//               style={{
//                 margin: 0,
//                 fontFamily: V.sans,
//                 fontWeight: 700,
//                 fontSize: '1.05rem',
//                 color: V.text,
//               }}
//             >
//               {initial ? 'Edit Enquiry Student' : 'New Enquiry Student'}
//             </h3>

//             <button
//               type="button"
//               onClick={onClose}
//               style={{
//                 border: 'none',
//                 background: 'transparent',
//                 color: V.textMuted,
//                 cursor: 'pointer',
//                 display: 'inline-flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 padding: 4,
//                 borderRadius: 8,
//               }}
//             >
//               <Icon d={IC.x} size={18} />
//             </button>
//           </div>

//           <div style={{ padding: 20 }}>
//             <div
//               style={{
//                 display: 'grid',
//                 gridTemplateColumns: '1fr',
//                 gap: 16,
//               }}
//             >
//               <label style={{ display: 'block' }}>
//                 <span
//                   style={{
//                     display: 'block',
//                     marginBottom: 7,
//                     fontSize: '0.75rem',
//                     fontWeight: 700,
//                     color: V.textDim,
//                     fontFamily: V.sans,
//                     letterSpacing: '0.05em',
//                     textTransform: 'uppercase',
//                   }}
//                 >
//                   Student Name *
//                 </span>
//                 <input
//                   value={name}
//                   onChange={(e) => {
//                     setName(e.target.value);
//                     setErr('');
//                   }}
//                   placeholder="e.g. Priya Sharma"
//                   autoFocus
//                   style={{
//                     width: '100%',
//                     height: 46,
//                     padding: '0 14px',
//                     border: `1px solid ${V.border}`,
//                     borderRadius: 10,
//                     fontFamily: V.sans,
//                     fontSize: '0.95rem',
//                     color: V.text,
//                     background: '#fff',
//                     outline: 'none',
//                   }}
//                 />
//               </label>

//               <label style={{ display: 'block' }}>
//                 <span
//                   style={{
//                     display: 'block',
//                     marginBottom: 7,
//                     fontSize: '0.75rem',
//                     fontWeight: 700,
//                     color: V.textDim,
//                     fontFamily: V.sans,
//                     letterSpacing: '0.05em',
//                     textTransform: 'uppercase',
//                   }}
//                 >
//                   Intake Year *
//                 </span>
//                 <select
//                   value={intakeYear}
//                   onChange={(e) => setIntakeYear(e.target.value)}
//                   style={{
//                     width: '100%',
//                     height: 46,
//                     padding: '0 14px',
//                     border: `1px solid ${V.border}`,
//                     borderRadius: 10,
//                     fontFamily: V.sans,
//                     fontSize: '0.95rem',
//                     color: V.text,
//                     background: '#fff',
//                     outline: 'none',
//                     cursor: 'pointer',
//                   }}
//                 >
//                   {YEARS.map((y) => (
//                     <option key={y} value={y}>
//                       {y}
//                     </option>
//                   ))}
//                 </select>
//               </label>

//               {err && (
//                 <div
//                   style={{
//                     color: V.danger,
//                     fontSize: '0.8rem',
//                     fontFamily: V.sans,
//                     marginTop: -4,
//                   }}
//                 >
//                   {err}
//                 </div>
//               )}
//             </div>
//           </div>

//           <div
//             style={{
//               display: 'flex',
//               justifyContent: 'flex-end',
//               gap: 10,
//               padding: 20,
//               borderTop: `1px solid ${V.border}`,
//               background: '#ffffff',
//             }}
//           >
//             <button
//               type="button"
//               onClick={onClose}
//               style={{
//                 height: 44,
//                 padding: '0 18px',
//                 borderRadius: 10,
//                 border: `1px solid ${V.border}`,
//                 background: '#fff',
//                 color: V.textDim,
//                 fontFamily: V.sans,
//                 fontSize: '0.9rem',
//                 cursor: 'pointer',
//               }}
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={saving}
//               style={{
//                 height: 44,
//                 padding: '0 18px',
//                 borderRadius: 10,
//                 border: 'none',
//                 background: V.accent,
//                 color: '#fff',
//                 fontFamily: V.sans,
//                 fontSize: '0.9rem',
//                 fontWeight: 600,
//                 cursor: 'pointer',
//                 display: 'inline-flex',
//                 alignItems: 'center',
//                 gap: 8,
//                 opacity: saving ? 0.9 : 1,
//               }}
//             >
//               {saving ? (
//                 <span className="enq-spin" style={{ display: 'inline-flex' }}>
//                   <Icon d={IC.spinner} size={14} stroke="white" />
//                 </span>
//               ) : (
//                 <Icon d={IC.check} size={14} stroke="white" />
//               )}
//               {initial ? 'Update' : 'Create'}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }
// const YEARS = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function StudentModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [intakeMonth, setIntakeMonth] = useState(initial?.intake_month || '');
  const [intakeYear, setIntakeYear] = useState(initial?.intake_year || new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();

    if (!name.trim()) {
      setErr('Name is required');
      return;
    }

    setSaving(true);
    setErr('');

    try {
      await onSave({
        name: name.trim(),
        intake_year: Number(intakeYear),

        // keep this line ONLY if backend supports intake_month
        intake_month: intakeMonth || undefined,
      });
      onClose();
    } catch (e) {
      setErr(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(10,18,30,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#ffffff',
          border: `1px solid ${V.border}`,
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
          overflow: 'hidden',
        }}
      >
        <form onSubmit={submit}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px',
              borderBottom: `1px solid ${V.border}`,
              background: '#ffffff',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: V.sans,
                fontWeight: 700,
                fontSize: '1.05rem',
                color: V.text,
              }}
            >
              {initial ? 'Edit Enquiry Student' : 'New Enquiry Student'}
            </h3>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                color: V.textMuted,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                borderRadius: 8,
              }}
            >
              <Icon d={IC.x} size={18} />
            </button>
          </div>

          <div style={{ padding: 20 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 16,
              }}
            >
              <label style={{ display: 'block' }}>
                <span
                  style={{
                    display: 'block',
                    marginBottom: 7,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: V.textDim,
                    fontFamily: V.sans,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Student Name *
                </span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErr('');
                  }}
                  placeholder="e.g. Priya Sharma"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    border: `1px solid ${V.border}`,
                    borderRadius: 12,
                    fontFamily: V.sans,
                    fontSize: '1rem',
                    color: V.text,
                    background: '#ffffff',
                    outline: 'none',
                  }}
                />
              </label>

              <label style={{ display: 'block' }}>
                <span
                  style={{
                    display: 'block',
                    marginBottom: 7,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: V.textDim,
                    fontFamily: V.sans,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Intake Month
                </span>
                <select
                  value={intakeMonth}
                  onChange={(e) => {
                    setIntakeMonth(e.target.value);
                    setErr('');
                  }}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    border: `1px solid ${V.border}`,
                    borderRadius: 12,
                    fontFamily: V.sans,
                    fontSize: '1rem',
                    color: V.text,
                    background: '#ffffff',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="">Select month</option>
                  {MONTHS.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block' }}>
                <span
                  style={{
                    display: 'block',
                    marginBottom: 7,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: V.textDim,
                    fontFamily: V.sans,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Intake Year *
                </span>
                <select
                  value={intakeYear}
                  onChange={(e) => {
                    setIntakeYear(e.target.value);
                    setErr('');
                  }}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    border: `1px solid ${V.border}`,
                    borderRadius: 12,
                    fontFamily: V.sans,
                    fontSize: '1rem',
                    color: V.text,
                    background: '#ffffff',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {err && (
              <div
                style={{
                  color: V.danger,
                  fontSize: '0.82rem',
                  fontFamily: V.sans,
                  marginTop: 14,
                }}
              >
                {err}
              </div>
            )}
          </div>

          <div
            style={{
              padding: '16px 20px',
              borderTop: `1px solid ${V.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 18px',
                background: '#ffffff',
                border: `1px solid ${V.border}`,
                borderRadius: 12,
                fontFamily: V.sans,
                fontSize: '0.95rem',
                color: V.textDim,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px 18px',
                background: V.accent,
                border: 'none',
                borderRadius: 12,
                fontFamily: V.sans,
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function StudentEnquiryPage() {
  const [students,     setStudents]     = useState([]);
  const [nameFilter,   setNameFilter]   = useState('');
  const [yearFilter,   setYearFilter]   = useState('');
  const [loadingStu,   setLoadingStu]   = useState(true);
  const [studentModal, setStudentModal] = useState(null);

  const [currentStu,   setCurrentStu]  = useState(null);

  // Single note per student
  const [note,         setNote]         = useState(null);  // the one note object
  const [loadingNote,  setLoadingNote]  = useState(false);
  const [dirty,        setDirty]        = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Inline header edit
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName,    setHeaderName]    = useState('');
  const [headerYear,    setHeaderYear]    = useState('');

  const [toast, setToast] = useState('');

  const editorRef = useRef(null);
  const fileRef   = useRef(null);
  const savedRange = useRef(null);
  const cssRef    = useRef(false);

  /* inject CSS */
  useEffect(() => {
    if (cssRef.current) return;
    cssRef.current = true;
    const el = document.createElement('style');
    el.id = 'enq-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.getElementById('enq-styles')?.remove();
  }, []);

  /* attachment delete */
  useEffect(() => {
    const handler = e => {
      const btn = e.target.closest('.enq-attachment button');
      if (!btn) return;
      btn.closest('.enq-attachment')?.remove();
      setTimeout(() => { syncEditor(); flash('Attachment removed'); }, 0);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [note]);

  /* ── fetch students ── */
  const fetchStudents = useCallback(async () => {
    setLoadingStu(true);
    try {
      const params = {};
      if (nameFilter.trim()) params.name = nameFilter.trim();
      if (yearFilter)        params.intake_year = yearFilter;
      const { data } = await api.getStudents(params);
      setStudents(data);
    } catch (err) {
      console.error('fetch students error:', err);
      flash('Failed to load students');
    } finally { setLoadingStu(false); }
  }, [nameFilter, yearFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  /* ── load the single note when a student is selected ── */
  useEffect(() => {
    if (!currentStu) { setNote(null); return; }
    setLoadingNote(true);
    api.getNotes(currentStu.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // use the first (and only) note
          setNote(data[0]);
        } else {
          // auto-create a note for this student
          return api.createNote({
            enquiry_id: currentStu.id,
            title: currentStu.name,
            content: '',
          }).then(({ data: created }) => setNote(created));
        }
      })
      .catch(() => flash('Failed to load note'))
      .finally(() => setLoadingNote(false));
  }, [currentStu]);

  /* ── sync editor when note changes ── */
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = note?.content || '';
    setDirty(false);
  }, [note?.id]);

  const stats = useMemo(() => wc(note?.content || ''), [note]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2400); }

  function saveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode))
      savedRange.current = sel.getRangeAt(0).cloneRange();
  }

  function insertAtCursor(html) {
    editorRef.current?.focus();
    const sel = window.getSelection();
    let range;
    if (savedRange.current) {
      range = savedRange.current;
      sel.removeAllRanges(); sel.addRange(range);
    } else if (sel && sel.rangeCount) {
      range = sel.getRangeAt(0);
    }
    if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      const frag = range.createContextualFragment(html);
      const last = frag.lastChild;
      range.insertNode(frag);
      if (last) { range.setStartAfter(last); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); }
    } else {
      editorRef.current.innerHTML += html;
    }
    savedRange.current = null;
    syncEditor();
  }

  function wrapAttachment(innerHtml, fileName) {
    return `<div class="enq-attachment" contenteditable="false" style="border:1px solid #d1dbe8;border-radius:12px;padding:12px;margin:12px 0;background:#f7f9fc;position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-family:'DM Sans',sans-serif;">
        <span style="font-size:13px;color:#334155;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;">${fileName}</span>
        <button type="button" style="border:none;background:#e53e3e;color:white;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:600;">Delete</button>
      </div>
      <div>${innerHtml}</div>
    </div><p><br></p>`;
  }

  function syncEditor() {
    if (!note || !editorRef.current) return;
    const html = editorRef.current.innerHTML || '';
    setNote(prev => ({ ...prev, content: html }));
    setDirty(true);
  }

  /* ── save note ── */
  async function save() {
    if (!note || !editorRef.current) return;
    const html = editorRef.current.innerHTML || '';
    setSaving(true);
    try {
      await api.updateNote(note.id, { title: currentStu.name, content: html });
      setNote(prev => ({ ...prev, content: html }));
      setDirty(false);
      flash('Saved ✓');
    } catch { flash('Save failed'); }
    finally { setSaving(false); }
  }

  /* ── CRUD: students ── */
  async function handleCreateStudent(payload) {
    const { data } = await api.createStudent(payload);
    await fetchStudents();
    setCurrentStu(data);
    flash('Enquiry student created');
  }

  async function handleUpdateStudent(payload) {
    const { data } = await api.updateStudent(currentStu.id, payload);
    setCurrentStu(data);
    await fetchStudents();
    flash('Updated');
  }

  async function handleDeleteStudent(student) {
    if (!window.confirm(`Delete "${student.name}" and their note?`)) return;
    await apiFetch(`/api/enquiry-notes/students/${student.id}`, { method: 'DELETE' });
    if (currentStu?.id === student.id) { setCurrentStu(null); setNote(null); }
    await fetchStudents();
    flash('Deleted');
  }

  /* ── formatting ── */
  function fmt(cmd, val = null) { editorRef.current?.focus(); document.execCommand(cmd, false, val); syncEditor(); }

  function insertTable() {
    saveRange();
    const rowsStr = prompt('Number of rows?', '3');
    const colsStr = prompt('Number of columns?', '3');
    if (!rowsStr || !colsStr) return;
    const rows = Math.max(1, Math.min(20, parseInt(rowsStr) || 3));
    const cols = Math.max(1, Math.min(10, parseInt(colsStr) || 3));
    let html = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const hdr = r === 0;
        html += `<td style="border:1px solid #d1dbe8;padding:8px 12px;min-width:80px;${hdr ? 'background:#eff4ff;font-weight:600;color:#2a52a8;' : 'color:#1a2332;'}">&nbsp;</td>`;
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    insertAtCursor(html);
  }

  function handleFile(file) {
    saveRange();
    const ext = file.name.split('.').pop().toLowerCase();
    const isImage = ['png','jpg','jpeg','gif','webp','svg'].includes(ext);
    const isPdf = ext === 'pdf';
    const reader = new FileReader();
    if (isImage) {
      reader.onload = e => { insertAtCursor(wrapAttachment(`<img src="${e.target.result}" alt="${file.name}" style="max-width:100%;border-radius:10px;display:block;border:1px solid #d1dbe8;" />`, file.name)); flash('Image inserted'); };
      reader.readAsDataURL(file);
    } else if (isPdf) {
      reader.onload = e => { insertAtCursor(wrapAttachment(`<iframe src="${e.target.result}" style="width:100%;height:420px;border-radius:10px;border:1px solid #d1dbe8;display:block;"></iframe>`, file.name)); flash('PDF inserted'); };
      reader.readAsDataURL(file);
    } else {
      const fileHtml = `<div style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #d1dbe8;border-radius:10px;background:white;font-family:'DM Sans',sans-serif;"><span style="font-size:20px;">📎</span><div><div style="font-weight:600;color:#1a2332;">${file.name}</div><div style="font-size:12px;color:#64748b;">${(file.size/1024).toFixed(1)} KB</div></div></div>`;
      insertAtCursor(wrapAttachment(fileHtml, file.name));
      flash(`${file.name} attached`);
    }
  }

  /* ── toolbar button ── */
  const Tb = ({ onClick, title, children, primary, disabled }) => (
    <button onClick={onClick} title={title} disabled={!!disabled}
      className={`enq-tb${primary ? ' pri' : ''}`}
      style={{ background: primary ? V.accent : 'none', border:'none', cursor:'pointer', color: primary ? '#fff' : V.textDim, padding:'6px 11px', borderRadius:7, fontSize:'0.78rem', fontFamily:V.sans, display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap', fontWeight: primary ? 600 : 500 }}>
      {children}
    </button>
  );
  const Sep = () => <div style={{ width:1, height:18, background:V.toolbarBdr, margin:'0 3px', flexShrink:0 }} />;

  /* ── header edit ── */
  function startHeaderEdit() {
    setHeaderName(currentStu.name);
    setHeaderYear(currentStu.intake_year);
    setEditingHeader(true);
  }
  async function saveHeaderEdit() {
    if (!headerName.trim()) return;
    await handleUpdateStudent({ name: headerName.trim(), intake_year: Number(headerYear) });
    setEditingHeader(false);
  }

  /* ══════ RENDER ══════ */
  return (
    <div className="enq-root" style={{ height:'calc(100vh - 96px)', display:'flex', flexDirection:'column', overflow:'hidden', borderRadius:16, border:`1px solid ${V.sidebarBdr}`, background:V.bg, boxShadow:'0 10px 30px rgba(15,23,42,0.08)' }}>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── COL 1: Student list ── */}
        <aside style={{ width:280, minWidth:220, background:V.sidebar, display:'flex', flexDirection:'column', borderRight:`1px solid ${V.sidebarBdr}`, flexShrink:0 }}>

          <div style={{ padding:'16px 14px 12px', borderBottom:`1px solid ${V.sidebarBdr}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
              <h2 style={{ fontFamily:V.sans, fontSize:'1rem', fontWeight:700, color:V.text, margin:0 }}>Enquiries</h2>
              <span style={{ fontSize:'0.68rem', color:V.textMuted, fontFamily:V.sans }}>{students.length}</span>
            </div>

            <div style={{ position:'relative', marginBottom:8 }}>
              <div style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:V.textMuted, pointerEvents:'none' }}>
                <Icon d={IC.search} size={13} />
              </div>
              <input className="enq-input" value={nameFilter} onChange={e => setNameFilter(e.target.value)}
                placeholder="Search name…"
                style={{ width:'100%', background:'rgba(255,255,255,0.6)', border:`1px solid ${V.border}`, borderRadius:7, padding:'6px 9px 6px 28px', color:V.text, fontFamily:V.sans, fontSize:'0.76rem', outline:'none' }} />
            </div>

            <div style={{ position:'relative', marginBottom:10 }}>
              <div style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:V.textMuted, pointerEvents:'none' }}>
                <Icon d={IC.calendar} size={13} />
              </div>
              <select className="enq-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.6)', border:`1px solid ${V.border}`, borderRadius:7, padding:'6px 9px 6px 28px', color: yearFilter ? V.text : V.textMuted, fontFamily:V.sans, fontSize:'0.76rem', outline:'none', cursor:'pointer', appearance:'none' }}>
                <option value="">All years</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button onClick={() => setStudentModal('new')}
              style={{ width:'100%', background:V.accent, border:'none', borderRadius:7, padding:'8px 12px', color:'white', fontFamily:V.sans, fontSize:'0.78rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={IC.plus} size={14} stroke="white" /> New Enquiry
            </button>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
            {loadingStu ? (
              <div style={{ padding:'28px 12px', textAlign:'center', color:V.textMuted, fontSize:'0.76rem', fontFamily:V.sans }}>Loading…</div>
            ) : students.length ? students.map(stu => (
              <div key={stu.id}
                className={`enq-student-card ${currentStu?.id === stu.id ? 'active' : ''}`}
                onClick={() => setCurrentStu(stu)}
                style={{ padding:'10px 11px', marginBottom:3, borderLeft:'3px solid transparent', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}
              >
                <div style={{ minWidth:0 }}>
                  <div style={{ fontFamily:V.sans, fontWeight:600, fontSize:'0.82rem', color:V.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stu.name}</div>
                  <div style={{ fontFamily:V.sans, fontSize:'0.7rem', color:V.textMuted, marginTop:2 }}>Intake {stu.intake_year} {stu.intake_month}</div>
                </div>
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  <button onClick={e => { e.stopPropagation(); setStudentModal(stu); }} className="enq-ibtn"
                    style={{ background:'none', border:'none', cursor:'pointer', color:V.textMuted, padding:'3px 4px', borderRadius:5, display:'flex' }}>
                    <Icon d={IC.edit} size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteStudent(stu); }} className="enq-ibtn del"
                    style={{ background:'none', border:'none', cursor:'pointer', color:V.textMuted, padding:'3px 4px', borderRadius:5, display:'flex' }}>
                    <Icon d={IC.trash} size={13} />
                  </button>
                </div>
              </div>
            )) : (
              <div style={{ padding:'28px 12px', textAlign:'center', color:V.textMuted, fontSize:'0.76rem', fontStyle:'italic', fontFamily:V.sans }}>
                {nameFilter || yearFilter ? 'No matching students.' : 'No enquiries yet.'}
              </div>
            )}
          </div>

          <div style={{ padding:'7px 14px', borderTop:`1px solid ${V.sidebarBdr}`, fontSize:'0.67rem', color:V.textMuted, fontFamily:V.sans }}>
            Stored in DB · admin/counsellor only
          </div>
        </aside>

        {/* ── COL 2: Editor ── */}
        <section style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:V.editor }}>

          {currentStu ? (
            <>
              {/* Student header bar */}
              <div style={{ background:V.toolbar, borderBottom:`1px solid ${V.toolbarBdr}`, padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                {editingHeader ? (
                  <div style={{ display:'flex', gap:8, alignItems:'center', flex:1 }}>
                    <input className="enq-input" value={headerName} onChange={e => setHeaderName(e.target.value)}
                      style={{ padding:'5px 9px', border:`1px solid ${V.border}`, borderRadius:7, fontFamily:V.sans, fontSize:'0.88rem', color:V.text, background:'white', width:200 }} />
                    <select className="enq-input" value={headerYear} onChange={e => setHeaderYear(e.target.value)}
                      style={{ padding:'5px 9px', border:`1px solid ${V.border}`, borderRadius:7, fontFamily:V.sans, fontSize:'0.88rem', color:V.text, background:'white', cursor:'pointer' }}>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={saveHeaderEdit} style={{ background:V.accent, border:'none', borderRadius:6, padding:'5px 12px', color:'white', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', fontFamily:V.sans }}>Save</button>
                    <button onClick={() => setEditingHeader(false)} style={{ background:'none', border:`1px solid ${V.border}`, borderRadius:6, padding:'5px 12px', color:V.textDim, fontSize:'0.78rem', cursor:'pointer', fontFamily:V.sans }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontFamily:V.sans, fontWeight:700, fontSize:'0.95rem', color:V.text }}>{currentStu.name}</span>
                    <span className="enq-tag">Intake {currentStu.intake_year} {currentStu.intake_month}</span>
                    <button onClick={startHeaderEdit} className="enq-ibtn"
                      style={{ background:'none', border:'none', cursor:'pointer', color:V.textMuted, padding:'3px 4px', borderRadius:5, display:'flex' }}>
                      <Icon d={IC.edit} size={13} />
                    </button>
                  </div>
                )}

                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:'0.68rem', color:V.textMuted, fontFamily:V.sans }}>
                    {stats.words} w · {stats.chars} ch
                  </span>
                  {dirty && <span style={{ fontSize:'0.68rem', color:V.accentDim, fontFamily:V.sans }}>● unsaved</span>}
                </div>
              </div>

              {/* Formatting toolbar */}
              <div style={{ background:V.toolbar, borderBottom:`1px solid ${V.toolbarBdr}`, padding:'5px 13px', display:'flex', alignItems:'center', gap:3, flexWrap:'wrap' }}>
                <select onChange={e => { fmt('formatBlock', e.target.value); e.target.value='p'; }} defaultValue="p"
                  style={{ background:'rgba(255,255,255,0.7)', border:`1px solid ${V.border}`, borderRadius:6, padding:'4px 7px', color:V.textDim, fontFamily:V.sans, fontSize:'0.75rem', outline:'none', cursor:'pointer', marginRight:3 }}>
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                  <option value="blockquote">Quote</option>
                </select>
                <Sep />
                <Tb onClick={() => fmt('bold')}          title="Bold"><strong style={{ fontSize:'0.8rem', fontFamily:'Georgia' }}>B</strong></Tb>
                <Tb onClick={() => fmt('italic')}        title="Italic"><em style={{ fontSize:'0.84rem', fontFamily:'Georgia' }}>I</em></Tb>
                <Tb onClick={() => fmt('underline')}     title="Underline"><span style={{ textDecoration:'underline', fontSize:'0.8rem' }}>U</span></Tb>
                <Tb onClick={() => fmt('strikeThrough')} title="Strike"><span style={{ textDecoration:'line-through', fontSize:'0.8rem' }}>S</span></Tb>
                <Sep />
                <Tb onClick={() => fmt('insertUnorderedList')} title="Bullet list"><Icon d={IC.list} size={14} /> List</Tb>
                <Tb onClick={() => fmt('insertOrderedList')}   title="Numbered"><Icon d={IC.list} size={14} /> 1·2·3</Tb>
                <Sep />
                <Tb onClick={insertTable}                    title="Table"><Icon d={IC.table} size={14} /> Table</Tb>
                <Tb onClick={() => fileRef.current?.click()} title="Image/File"><Icon d={IC.image} size={14} /> File</Tb>
                <input ref={fileRef} type="file" style={{ display:'none' }} accept="image/*,.pdf,.doc,.docx,.txt,.csv"
                  onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value=''; } }} />
                <div style={{ flex:1 }} />
                <Tb onClick={save} primary disabled={!note || saving} title="Save">
                  {saving
                    ? <Icon d={IC.spinner} size={14} stroke="white" className="enq-spin" />
                    : <Icon d={IC.save} size={14} stroke="white" />}
                  <span style={{ color:'white' }}>Save</span>
                </Tb>
              </div>

              {/* Writing area */}
              <div style={{ flex:1, overflowY:'auto', padding:'32px 48px 56px', background:'#edf2f8' }}>
                {loadingNote ? (
                  <div style={{ textAlign:'center', paddingTop:60, color:V.textMuted, fontFamily:V.sans }}>Loading note…</div>
                ) : (
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="enq-editor"
                    data-ph="Start writing notes for this student…"
                    onInput={syncEditor}
                    onMouseUp={saveRange}
                    onKeyUp={saveRange}
                    onKeyDown={saveRange}
                    style={{ minHeight:'72vh', maxWidth:820, margin:'0 auto', background:'#ffffff', border:`1px solid ${V.border}`, borderRadius:13, padding:'40px 46px', boxShadow:'0 10px 30px rgba(15,23,42,0.06)', fontFamily:"'Calibri','DM Sans',sans-serif", fontSize:'1rem', lineHeight:1.85, color:V.text }}
                  />
                )}
              </div>

              {/* Status bar */}
              <div style={{ background:V.toolbar, borderTop:`1px solid ${V.toolbarBdr}`, padding:'4px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'0.67rem', color:V.textMuted, fontFamily:V.sans }}>
                  Notes for {currentStu.name}
                </span>
                <span style={{ fontSize:'0.67rem', color: dirty ? V.accentDim : V.textMuted, fontFamily:V.sans, transition:'color 0.3s' }}>
                  {dirty ? '● unsaved' : note ? '✓ saved' : ''}
                </span>
              </div>
            </>
          ) : (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#edf2f8' }}>
              <div style={{ maxWidth:360, textAlign:'center' }}>
                <div style={{ width:60, height:60, borderRadius:'50%', background:V.accentGlow, border:`1px solid ${V.sidebarBdr}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
                  <Icon d={IC.user} size={26} stroke={V.accentDim} />
                </div>
                <p style={{ fontFamily:V.serif, fontSize:'1.4rem', color:V.textDim, margin:'0 0 8px' }}>No enquiry selected</p>
                <p style={{ fontSize:'0.8rem', color:V.textMuted, fontFamily:V.sans, marginBottom:20 }}>
                  Pick a student from the left panel, or create a new enquiry.
                </p>
                <button onClick={() => setStudentModal('new')}
                  style={{ background:V.accent, border:'none', borderRadius:9, padding:'9px 20px', color:'white', fontFamily:V.sans, fontSize:'0.82rem', fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7 }}>
                  <Icon d={IC.plus} size={14} stroke="white" /> New Enquiry
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      {studentModal === 'new' && (
        <StudentModal onSave={handleCreateStudent} onClose={() => setStudentModal(null)} />
      )}
      {studentModal && studentModal !== 'new' && (
        <StudentModal initial={studentModal} onSave={handleUpdateStudent} onClose={() => setStudentModal(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div className="enq-toast" style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:'#1a2332', border:`1px solid ${V.sidebarBdr}`, color:V.accentDim, padding:'8px 15px', borderRadius:9, fontSize:'0.78rem', fontFamily:V.sans, fontWeight:500, boxShadow:'0 8px 32px rgba(0,0,0,0.4)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:V.accent, flexShrink:0 }} />
          {toast}
        </div>
      )}
    </div>
  );
}
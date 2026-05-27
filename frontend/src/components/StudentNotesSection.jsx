import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../utils';

/* ─── inline SVG icon ─── */
const Icon = ({ d, size = 16, stroke = 'currentColor', fill = 'none', sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IC = {
  search:  'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  plus:    'M12 5v14M5 12h14',
  save:    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  trash:   'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  folder:  'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  table:   'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  image:   'M21 15l-5-5L5 21M3 3h18v18H3zM8.5 8.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0',
  list:    'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  ol:      'M10 6h11M10 12h11M10 18h11M4 6h.01M4 12h.01M4 18h.01',
  chevron: 'M9 18l6-6-6-6',
  note:    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
};

const V = {
  bg:         '#f3f4f6',
  sidebar:    '#e9edf3',
  sidebarBdr: '#d4dbe5',
  accent:     '#2563eb',
  accentDim:  '#5b7bbd',
  accentGlow: 'rgba(37,99,235,0.10)',
  editor:     '#ffffff',
  toolbar:    '#f8fafc',
  toolbarBdr: '#dbe3ec',
  text:       '#1f2937',
  textDim:    '#4b5563',
  textMuted:  '#94a3b8',
  danger:     '#dc2626',
  border:     '#d6dde7',
  sans:       "'Segoe UI', system-ui, sans-serif",
};

const CSS = `
.snp-root *, .snp-root *::before, .snp-root *::after { box-sizing: border-box; }
.snp-root ::-webkit-scrollbar { width: 8px; }
.snp-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.snp-root ::-webkit-scrollbar-track { background: transparent; }
.snp-item { transition: background 0.12s, color 0.12s; border-radius: 8px; }
.snp-item:hover { background: rgba(37,99,235,0.08) !important; }
.snp-item.snp-active { background: rgba(37,99,235,0.12) !important; }
.snp-acts { opacity: 0; transition: opacity 0.12s; }
.snp-item:hover .snp-acts { opacity: 1; }
.snp-ibtn { transition: background 0.12s, color 0.12s; }
.snp-ibtn:hover { background: rgba(37,99,235,0.08) !important; color: #2563eb !important; }
.snp-ibtn.del:hover { background: rgba(220,38,38,0.08) !important; color: #dc2626 !important; }
.snp-tb { transition: background 0.12s, color 0.12s, transform 0.08s; }
.snp-tb:hover { background: rgba(37,99,235,0.08) !important; color: #2563eb !important; }
.snp-tb:active { transform: scale(0.96); }
.snp-tb.pri { background: #2563eb !important; color: white !important; font-weight: 600; }
.snp-tb.pri:hover { background: #1d4ed8 !important; }
.snp-tb:disabled { opacity: 0.45 !important; cursor: not-allowed !important; pointer-events: none; }
.snp-chev { transition: transform 0.18s; display: flex; }
.snp-chev.open { transform: rotate(90deg); }
.snp-editor { outline: none; caret-color: #2563eb; }
.snp-editor:empty::before { content: attr(data-ph); color: #94a3b8; pointer-events: none; font-style: italic; font-size: 1rem; }
.snp-editor h1 { font-size: 2rem; font-weight: 700; color: #111827; margin: 0 0 0.4em; line-height: 1.2; }
.snp-editor h2 { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.35em; }
.snp-editor h3 { font-size: 0.9rem; font-weight: 700; color: #475569; margin: 0 0 0.3em; letter-spacing: 0.04em; text-transform: uppercase; }
.snp-editor p { margin: 0 0 0.8em; color: #1f2937; }
.snp-editor a { color: #2563eb; }
.snp-editor strong { color: #111827; font-weight: 700; }
.snp-editor ul, .snp-editor ol { padding-left: 1.5rem; margin: 0 0 0.8em; }
.snp-editor li { margin: 0.18em 0; color: #1f2937; }
.snp-editor ul li::marker { color: #2563eb; }
.snp-editor ol li::marker { color: #2563eb; font-size: 0.9em; }
.snp-editor blockquote { border-left: 4px solid #2563eb; margin: 0.9em 0; padding: 6px 0 6px 16px; color: #475569; font-style: italic; background: #f8fbff; border-radius: 0 8px 8px 0; }
.snp-editor table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.92rem; background: white; }
.snp-editor table td, .snp-editor table th { border: 1px solid #dbe3ec; padding: 10px 12px; min-width: 80px; vertical-align: top; color: #1f2937; }
.snp-editor table tr:first-child td { background: #eff6ff; font-weight: 700; color: #1d4ed8; border-color: #bfdbfe; }
.snp-editor table tr:hover td { background: #f8fafc; }
.snp-editor img { max-width: 100%; border-radius: 10px; margin: 8px 0; display: block; border: 1px solid #dbe3ec; }
.snp-editor iframe { border-radius: 10px; margin: 8px 0; border: 1px solid #dbe3ec !important; }
.snp-search:focus { border-color: #2563eb !important; outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,0.10); }

/* ── table wrapper with delete button ── */
.snp-table-wrap { position: relative; margin: 1rem 0; }
.snp-table-wrap:hover .snp-table-del { opacity: 1; }
.snp-table-del {
  opacity: 0;
  position: absolute;
  top: -10px;
  right: -10px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
  z-index: 10;
  line-height: 1;
}
.snp-table-del:hover { background: #b91c1c !important; opacity: 1 !important; }

@keyframes snp-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
.snp-toast { animation: snp-in 0.2s ease; }
`;

function wc(html) {
  const t = (html || '').replace(/<[^>]*>/g, ' ').trim();
  return { words: t ? t.split(/\s+/).length : 0, chars: t.replace(/\s/g, '').length };
}

/* ── helper: place cursor in a paragraph AFTER a given node ── */
function placeCursorAfter(node, editor) {
  // Find or create a paragraph after the node
  let next = node.nextSibling;
  if (!next || (next.nodeType === 1 && next.tagName === 'BR')) {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    node.parentNode.insertBefore(p, next || null);
    next = p;
  }
  const sel = window.getSelection();
  const range = document.createRange();
  try {
    if (next.nodeType === 3) {
      range.setStart(next, 0);
    } else {
      range.setStart(next, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
  } catch (_) {
    editor.focus();
  }
}

export default function StudentNotesSection({ studentId }) {
  const [notes,    setNotes]    = useState([]);
  const [current,  setCurrent]  = useState(null);
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState({});
  const [toast,    setToast]    = useState('');
  const [dirty,    setDirty]    = useState(false);
  const [loading,  setLoading]  = useState(true);

  const editorRef  = useRef(null);
  const fileRef    = useRef(null);
  const cssRef     = useRef(false);
  const savedRange = useRef(null);

  /* inject CSS once */
  useEffect(() => {
    if (cssRef.current) return;
    cssRef.current = true;
    const el = document.createElement('style');
    el.id = 'snp-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.getElementById('snp-styles')?.remove();
  }, []);

  /* fetch notes when studentId changes */
  useEffect(() => {
    if (studentId) fetchNotes();
  }, [studentId]);

  async function fetchNotes() {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/student-notes/student/${studentId}`);
      const list = Array.isArray(data) ? data : [];
      setNotes(list);
      setCurrent(list.length > 0 ? list[0].id : null);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setNotes([]);
      setCurrent(null);
    } finally {
      setLoading(false);
    }
  }

  /* ── Global click handler for attachment delete AND table delete ── */
  useEffect(() => {
    const handler = (e) => {
      // Attachment delete
      const attachBtn = e.target.closest('.snp-attachment button');
      if (attachBtn) {
        const block = attachBtn.closest('.snp-attachment');
        if (block) {
          block.remove();
          setTimeout(() => { syncEditor(); flash('Attachment removed'); }, 0);
          return;
        }
      }
      // Table delete
      const tableDelBtn = e.target.closest('.snp-table-del');
      if (tableDelBtn) {
        const wrap = tableDelBtn.closest('.snp-table-wrap');
        if (wrap) {
          wrap.remove();
          setTimeout(() => { syncEditor(); flash('Table removed'); }, 0);
        }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [current]);

  const currentNote = useMemo(() => notes.find(n => n.id === current) || null, [notes, current]);
  const stats       = useMemo(() => wc(currentNote?.content || ''), [currentNote]);

  /* sync editor HTML when note changes */
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = currentNote?.content || '';
    setDirty(false);
  }, [current]);

  /* ── helpers ── */
  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2200); }

  function saveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }

  /* ── Insert HTML then reliably move cursor AFTER inserted block ── */
  function insertAtCursor(html, moveCursorAfter = false) {
    editorRef.current?.focus();
    const sel = window.getSelection();
    let range;
    if (savedRange.current) {
      range = savedRange.current;
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (sel && sel.rangeCount) {
      range = sel.getRangeAt(0);
    }

    let insertedNode = null;

    if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      const frag = range.createContextualFragment(html);
      insertedNode = frag.lastChild;
      range.insertNode(frag);
      if (insertedNode) {
        range.setStartAfter(insertedNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      editorRef.current.innerHTML += html;
      insertedNode = editorRef.current.lastChild;
    }

    savedRange.current = null;

    // ── FIX: after inserting an attachment block (contenteditable=false),
    //    the cursor can get trapped inside it. Force it to a paragraph after.
    if (moveCursorAfter && insertedNode && editorRef.current) {
      setTimeout(() => {
        placeCursorAfter(insertedNode, editorRef.current);
        syncEditor();
      }, 0);
    } else {
      syncEditor();
    }
  }

  function wrapAttachmentBlock(innerHtml, fileName = 'Attachment') {
    return `
      <div class="snp-attachment" contenteditable="false" style="border:1px solid #dbe3ec;border-radius:12px;padding:12px;margin:12px 0;background:#f8fafc;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-family:'Segoe UI',system-ui,sans-serif;">
          <span style="font-size:13px;color:#334155;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;">${fileName}</span>
          <button type="button" style="border:none;background:#dc2626;color:white;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:600;">Delete</button>
        </div>
        <div>${innerHtml}</div>
      </div><p><br></p>`;
  }

  /* ── Table wrapped with a delete button ── */
  function wrapTableBlock(tableHtml) {
    return `
      <div class="snp-table-wrap" contenteditable="false">
        <button class="snp-table-del" type="button" title="Delete table">✕</button>
        <div contenteditable="true">${tableHtml}</div>
      </div><p><br></p>`;
  }

  function syncEditor() {
    if (!current || !editorRef.current) return;
    const html  = editorRef.current.innerHTML || '';
    const text  = editorRef.current.innerText?.trim() || '';
    const title = text.split('\n')[0].trim().slice(0, 50) || 'Untitled';
    setNotes(prev => prev.map(n => n.id === current ? { ...n, content: html, title } : n));
    setDirty(true);
  }

  async function save() {
    if (!current || !editorRef.current) return;
    const html  = editorRef.current.innerHTML || '';
    const text  = editorRef.current.innerText?.trim() || '';
    const title = text.split('\n')[0].trim().slice(0, 50) || 'Untitled';
    try {
      const updated = await apiFetch(`/api/student-notes/${current}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content: html, category: currentNote?.category || 'general', priority: currentNote?.priority || 'medium', tags: currentNote?.tags || [] }),
      });
      setNotes(prev => prev.map(n => n.id === current ? updated : n));
      setDirty(false);
      flash('Saved ✓');
    } catch (err) {
      flash('Save failed');
    }
  }

  async function createNote(parentId = null) {
    try {
      const created = await apiFetch('/api/student-notes/', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, title: 'Untitled', content: '', parent_id: parentId, category: 'general', priority: 'medium', tags: [] }),
      });
      setNotes(prev => [created, ...prev]);
      setCurrent(created.id);
      if (parentId) setExpanded(p => ({ ...p, [parentId]: true }));
      flash(parentId ? 'Sub-note created' : 'New note');
    } catch (err) {
      flash('Create failed');
    }
  }

  async function deleteNote(id) {
    if (!window.confirm('Delete this note?')) return;
    try {
      await apiFetch(`/api/student-notes/${id}`, { method: 'DELETE' });
      const childIds = new Set(collectIds(id));
      const updated  = notes.filter(n => !childIds.has(n.id));
      setNotes(updated);
      if (childIds.has(current)) setCurrent(updated[0]?.id || null);
      flash('Deleted');
    } catch (err) {
      flash('Delete failed');
    }
  }

  function collectIds(id) {
    return [id, ...notes.filter(n => n.parent_id === id).flatMap(c => collectIds(c.id))];
  }

  function openNote(id) {
    if (dirty && editorRef.current) {
      const html  = editorRef.current.innerHTML || '';
      const text  = editorRef.current.innerText?.trim() || '';
      const title = text.split('\n')[0].trim().slice(0, 50) || 'Untitled';
      setNotes(prev => prev.map(n => n.id === current ? { ...n, content: html, title } : n));
    }
    setCurrent(id);
  }

  function fmt(cmd, val = null) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    syncEditor();
  }

  function insertTable() {
    saveRange();
    const rowsStr = prompt('Number of rows?', '3');
    const colsStr = prompt('Number of columns?', '3');
    if (!rowsStr || !colsStr) return;
    const rows = Math.max(1, Math.min(20, parseInt(rowsStr) || 3));
    const cols = Math.max(1, Math.min(10, parseInt(colsStr) || 3));

    let tableHtml = '<table style="width:100%;border-collapse:collapse;">';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        const hdr = r === 0;
        tableHtml += `<td style="border:1px solid #dbe3ec;padding:8px 12px;min-width:80px;${hdr ? 'background:#eff6ff;font-weight:700;color:#1d4ed8;' : ''}">&nbsp;</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table>';

    // Wrap table in a deletable container
    insertAtCursor(wrapTableBlock(tableHtml), true);
  }

  function handleFile(file) {
    if (!current) { flash('Select a note first'); return; }
    saveRange();
    const ext     = file.name.split('.').pop().toLowerCase();
    const isImage = ['png','jpg','jpeg','gif','webp','svg'].includes(ext);
    const isPdf   = ext === 'pdf';
    const reader  = new FileReader();

    if (isImage) {
      reader.onload = e => {
        // ── FIX: pass moveCursorAfter=true so cursor exits the attachment block
        insertAtCursor(
          wrapAttachmentBlock(`<img src="${e.target.result}" alt="${file.name}" style="max-width:100%;border-radius:10px;display:block;border:1px solid #dbe3ec;" />`, file.name),
          true
        );
        flash('Image inserted');
      };
      reader.readAsDataURL(file);
    } else if (isPdf) {
      reader.onload = e => {
        insertAtCursor(
          wrapAttachmentBlock(`<iframe src="${e.target.result}" style="width:100%;height:420px;border-radius:10px;border:1px solid #dbe3ec;display:block;"></iframe>`, file.name),
          true
        );
        flash('PDF inserted');
      };
      reader.readAsDataURL(file);
    } else {
      insertAtCursor(
        wrapAttachmentBlock(
          `<div style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #dbe3ec;border-radius:10px;background:white;font-family:'Segoe UI',system-ui,sans-serif;">
            <span style="font-size:20px;">📎</span>
            <div>
              <div style="font-weight:600;color:#1f2937;">${file.name}</div>
              <div style="font-size:12px;color:#64748b;">${(file.size/1024).toFixed(1)} KB</div>
            </div>
          </div>`,
          file.name
        ),
        true
      );
      flash(`${file.name} attached`);
    }
  }

  /* ── tree ── */
  function hasChild(id) {
    return notes.filter(n => n.parent_id === id).some(c => c.title.toLowerCase().includes(search.toLowerCase()) || hasChild(c.id));
  }

  function renderTree(parentId = null, depth = 0) {
    return notes
      .filter(n => n.parent_id === parentId)
      .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || hasChild(n.id))
      .map(note => {
        const children = notes.filter(n => n.parent_id === note.id);
        const isOpen   = !!expanded[note.id];
        const isActive = note.id === current;
        return (
          <div key={note.id}>
            <div onClick={() => openNote(note.id)} className={`snp-item ${isActive ? 'snp-active' : ''}`}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:`7px 8px 7px ${12 + depth * 14}px`, cursor:'pointer', userSelect:'none', color: isActive ? V.accent : V.textDim, marginBottom:'1px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', minWidth:0, flex:1 }}>
                <button onClick={e => { e.stopPropagation(); setExpanded(p => ({ ...p, [note.id]: !p[note.id] })); }}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', color: children.length ? V.accentDim : 'transparent', display:'flex', borderRadius:'4px', flexShrink:0 }}>
                  <div className={`snp-chev ${isOpen ? 'open' : ''}`}><Icon d={IC.chevron} size={12} sw={2} /></div>
                </button>
                <span style={{ width:5, height:5, borderRadius:'50%', background: isActive ? V.accent : V.sidebarBdr, flexShrink:0, transition:'background 0.2s' }} />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.8rem', fontFamily:V.sans, letterSpacing:'0.01em' }}>{note.title}</span>
              </div>
              <div className="snp-acts" style={{ display:'flex', gap:'1px', flexShrink:0 }}>
                <button onClick={e => { e.stopPropagation(); createNote(note.id); }} title="Add sub-note" className="snp-ibtn"
                  style={{ background:'none', border:'none', cursor:'pointer', color:V.textMuted, padding:'3px 4px', borderRadius:'5px', display:'flex' }}>
                  <Icon d={IC.folder} size={12} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }} title="Delete" className="snp-ibtn del"
                  style={{ background:'none', border:'none', cursor:'pointer', color:V.textMuted, padding:'3px 4px', borderRadius:'5px', display:'flex' }}>
                  <Icon d={IC.trash} size={12} />
                </button>
              </div>
            </div>
            {isOpen && children.length > 0 && renderTree(note.id, depth + 1)}
          </div>
        );
      });
  }

  const Tb = ({ onClick, title, children, primary, disabled }) => (
    <button onClick={onClick} title={title} disabled={!!disabled} className={`snp-tb${primary ? ' pri' : ''}`}
      style={{ background: primary ? '#2563eb' : 'none', border:'none', cursor:'pointer', color: primary ? '#ffffff' : V.textDim, padding:'7px 12px', borderRadius:'8px', fontSize:'0.8rem', fontFamily:V.sans, display:'flex', alignItems:'center', gap:'6px', whiteSpace:'nowrap', fontWeight: primary ? 600 : 500 }}>
      {children}
    </button>
  );
  const Sep = () => <div style={{ width:1, height:18, background:V.toolbarBdr, margin:'0 3px', flexShrink:0 }} />;

  const rootNotes = notes.filter(n => n.parent_id == null);

  return (
    <div className="snp-root" style={{ height:'70vh', display:'flex', overflow:'hidden', borderRadius:'16px', border:`1px solid ${V.sidebarBdr}`, background:V.bg, boxShadow:'0 10px 30px rgba(15,23,42,0.08)' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width:280, minWidth:230, background:V.sidebar, display:'flex', flexDirection:'column', borderRight:`1px solid ${V.sidebarBdr}`, flexShrink:0 }}>
        <div style={{ padding:'18px 14px 12px', borderBottom:`1px solid ${V.sidebarBdr}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <h2 style={{ fontFamily:V.sans, fontSize:'1.15rem', fontWeight:700, color:V.text, margin:0 }}>Notes</h2>
            <span style={{ fontSize:'0.68rem', color:V.textMuted, fontFamily:V.sans }}>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
          </div>
          <div style={{ position:'relative', marginBottom:'10px' }}>
            <div style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:V.textMuted, pointerEvents:'none' }}>
              <Icon d={IC.search} size={13} />
            </div>
            <input className="snp-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ width:'100%', background:'rgba(255,255,255,0.6)', border:`1px solid ${V.border}`, borderRadius:'7px', padding:'7px 9px 7px 29px', color:V.text, fontFamily:V.sans, fontSize:'0.78rem', outline:'none' }} />
          </div>
          <button onClick={() => createNote(null)}
            style={{ width:'100%', background:V.accent, border:'none', borderRadius:'7px', padding:'8px 12px', color:'#fff', fontFamily:V.sans, fontSize:'0.8rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
            <Icon d={IC.plus} size={14} stroke="#fff" /> New Note
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'6px' }}>
          {loading ? (
            <div style={{ padding:'28px 12px', textAlign:'center', color:V.textMuted, fontSize:'0.78rem', fontFamily:V.sans }}>Loading…</div>
          ) : rootNotes.length ? renderTree() : (
            <div style={{ padding:'28px 12px', textAlign:'center', color:V.textMuted, fontSize:'0.78rem', fontStyle:'italic', fontFamily:V.sans }}>
              {search ? 'No matching notes.' : 'No notes yet.'}
            </div>
          )}
        </div>

        <div style={{ padding:'8px 14px', borderTop:`1px solid ${V.sidebarBdr}`, fontSize:'0.68rem', color:V.textMuted, fontFamily:V.sans }}>
          Student #{studentId} · notes
        </div>
      </aside>

      {/* ── EDITOR ── */}
      <section style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:V.editor }}>

        {/* toolbar */}
        <div style={{ background:V.toolbar, borderBottom:`1px solid ${V.toolbarBdr}`, padding:'8px 14px', display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap', minHeight:52 }}>
          <select onChange={e => { fmt('formatBlock', e.target.value); e.target.value='p'; }} defaultValue="p"
            style={{ background:'rgba(255,255,255,0.8)', border:`1px solid ${V.border}`, borderRadius:'6px', padding:'4px 7px', color:V.textDim, fontFamily:V.sans, fontSize:'0.76rem', outline:'none', cursor:'pointer', marginRight:'4px' }}>
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote</option>
          </select>
          <Sep />
          <Tb onClick={() => fmt('bold')}          title="Bold"><strong style={{ fontSize:'0.82rem' }}>B</strong></Tb>
          <Tb onClick={() => fmt('italic')}        title="Italic"><em style={{ fontSize:'0.85rem' }}>I</em></Tb>
          <Tb onClick={() => fmt('underline')}     title="Underline"><span style={{ textDecoration:'underline', fontSize:'0.82rem' }}>U</span></Tb>
          <Tb onClick={() => fmt('strikeThrough')} title="Strikethrough"><span style={{ textDecoration:'line-through', fontSize:'0.82rem' }}>S</span></Tb>
          <Sep />
          <Tb onClick={() => fmt('insertUnorderedList')} title="Bullet list"><Icon d={IC.list} size={14} /> List</Tb>
          <Tb onClick={() => fmt('insertOrderedList')}   title="Numbered list"><Icon d={IC.ol} size={14} /> 1·2·3</Tb>
          <Sep />
          <Tb onClick={insertTable}                    title="Insert table"><Icon d={IC.table} size={14} /> Table</Tb>
          <Tb onClick={() => fileRef.current?.click()} title="Insert image/file"><Icon d={IC.image} size={14} /> Image</Tb>
          <input ref={fileRef} type="file" style={{ display:'none' }} accept="image/*,.pdf,.doc,.docx,.txt,.csv"
            onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value=''; } }} />
          <div style={{ flex:1 }} />
          <span style={{ fontSize:'0.7rem', color:V.textMuted, fontFamily:V.sans, marginRight:'8px' }}>
            {stats.words.toLocaleString()} words · {stats.chars.toLocaleString()} chars
          </span>
          <Tb onClick={save} primary disabled={!current} title="Save">
            <Icon d={IC.save} size={15} stroke="#ffffff" />
            <span style={{ color:'#ffffff', fontWeight:600 }}>Save</span>
          </Tb>
        </div>

        {/* breadcrumb */}
        {currentNote && (
          <div style={{ padding:'7px 32px 0', background:V.editor, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:'0.68rem', color:V.accentDim, fontFamily:V.sans, letterSpacing:'0.07em', textTransform:'uppercase' }}>
              {currentNote.parent_id ? `${notes.find(n => n.id === currentNote.parent_id)?.title || 'Note'} › ${currentNote.title}` : currentNote.title}
            </span>
            {dirty && <span style={{ fontSize:'0.65rem', color:V.accentDim, fontFamily:V.sans }}>● unsaved</span>}
          </div>
        )}

        {/* writing area */}
        <div style={{ flex:1, overflowY:'auto', padding:'28px 56px 60px', background:'#eef2f7' }}>
          {current ? (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="snp-editor"
              data-ph="Start writing… or use the toolbar above."
              onInput={syncEditor}
              onMouseUp={saveRange}
              onKeyUp={saveRange}
              onKeyDown={saveRange}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    saveRange();
                    const file = item.getAsFile();
                    if (file) handleFile(file);
                    return;
                  }
                }
              }}
              style={{ minHeight:'75vh', maxWidth:'820px', margin:'0 auto', background:'#ffffff', border:'1px solid #dbe3ec', borderRadius:'12px', padding:'42px 48px', boxShadow:'0 10px 30px rgba(15,23,42,0.06)', fontFamily:"'Segoe UI', system-ui, sans-serif", fontSize:'1rem', lineHeight:'1.85', color:'#1f2937' }}
            />
          ) : (
            <div style={{ maxWidth:'380px', margin:'80px auto', textAlign:'center' }}>
              <div style={{ width:54, height:54, borderRadius:'50%', background:V.accentGlow, border:`1px solid ${V.sidebarBdr}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <Icon d={IC.note} size={22} stroke={V.accentDim} />
              </div>
              <p style={{ fontSize:'1.2rem', color:V.textDim, margin:'0 0 8px', fontFamily:V.sans }}>No note open</p>
              <p style={{ fontSize:'0.8rem', color:V.textMuted, fontFamily:V.sans, marginBottom:'18px' }}>Pick a note from the sidebar or create one.</p>
              <button onClick={() => createNote(null)}
                style={{ background:V.accentGlow, border:`1px solid ${V.accentDim}`, borderRadius:'8px', padding:'8px 18px', color:V.accent, fontFamily:V.sans, fontSize:'0.8rem', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'7px' }}>
                <Icon d={IC.plus} size={14} stroke={V.accent} /> Create first note
              </button>
            </div>
          )}
        </div>

        {/* status bar */}
        <div style={{ background:V.toolbar, borderTop:`1px solid ${V.toolbarBdr}`, padding:'4px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'0.68rem', color:V.textMuted, fontFamily:V.sans }}>{currentNote?.title || 'No note selected'}</span>
          <span style={{ fontSize:'0.68rem', color: dirty ? V.accentDim : V.textMuted, fontFamily:V.sans, transition:'color 0.3s' }}>
            {dirty ? '● unsaved' : currentNote ? '✓ saved' : ''}
          </span>
        </div>
      </section>

      {/* toast */}
      {toast && (
        <div className="snp-toast" style={{ position:'fixed', bottom:26, right:26, zIndex:9999, background:'#1e293b', color:'#fff', padding:'9px 16px', borderRadius:'9px', fontSize:'0.8rem', fontFamily:V.sans, fontWeight:500, boxShadow:'0 8px 32px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:V.accent, flexShrink:0 }} />
          {toast}
        </div>
      )}
    </div>
  );
}
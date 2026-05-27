/**
 * WhatsAppQuickSend.jsx
 * Full WhatsApp-style chat interface backed by the CRM's real WhatsApp API.
 *
 * Data flow:
 *  - Contact list  → GET /api/whatsapp/contacts
 *  - Messages      → GET /api/whatsapp/contacts/{id}/messages  (polls every 10s)
 *  - Send message  → POST /api/whatsapp/contacts/{id}/send
 *  - New chat      → POST /api/whatsapp/send-direct  (creates contact on first send)
 *  - Link student  → POST /api/whatsapp/contacts/{id}/link-student
 *  - Unlink        → DELETE /api/whatsapp/contacts/{id}/link-student
 *  - Sync student  → POST /api/whatsapp/gateway/contacts/sync
 *  - Students list → GET /api/students/  (for the link-student picker)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils';

/* ─── colour palette (WhatsApp dark theme) ──────────────────────────────── */
const C = {
  bgApp:     '#111B21',
  bgPanel:   '#202C33',
  bgMsg:     '#0B141A',
  bgBubMe:   '#005C4B',
  bgBubThem: '#202C33',
  bgHover:   '#2A3942',
  bgInput:   '#2A3942',
  accent:    '#00A884',
  accentDim: '#128C7E',
  text:      '#E9EDEF',
  textDim:   '#8696A0',
  textSub:   '#667781',
  border:    '#2A3942',
  borderDim: '#1D272E',
  online:    '#25D366',
  danger:    '#ef4444',
};

/* ─── status → colour map (mirrors your student lead statuses) ───────────── */
const STATUS_COLOR = {
  lead:        '#34B7F1',
  hot:         '#ef4444',
  warm:        '#f59e0b',
  cold:        '#8696A0',
  converted:   '#25D366',
  lost:        '#6b7280',
  enrolled:    '#25D366',
};

/* ─── avatar initials from display name ─────────────────────────────────── */
function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ─── deterministic colour from string ──────────────────────────────────── */
const AVATAR_COLORS = ['#128C7E','#25D366','#34B7F1','#075E54','#005C4B','#00A884'];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ─── time label helper ──────────────────────────────────────────────────── */
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/* ─── small spinner ──────────────────────────────────────────────────────── */
function Spin({ size = 18 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid rgba(0,168,132,0.25)`,
      borderTopColor: C.accent,
      borderRadius: '50%',
      animation: 'wa-spin 0.6s linear infinite',
      flexShrink: 0,
    }} />
  );
}

/* ─── avatar bubble ──────────────────────────────────────────────────────── */
function Avatar({ name, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.32, color: '#fff',
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
export default function WhatsAppQuickSend() {
  /* ── state ── */
  const [contacts,        setContacts]        = useState([]);
  const [students,        setStudents]        = useState([]);
  const [selected,        setSelected]        = useState(null);   // WhatsApp contact object
  const [messages,        setMessages]        = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending,         setSending]         = useState(false);
  const [search,          setSearch]          = useState('');
  const [msgText,         setMsgText]         = useState('');
  const [filter,          setFilter]          = useState('all');  // all | unread | linked
  const [toast,           setToast]           = useState(null);
  const [showInfo,        setShowInfo]        = useState(false);
  const [showNewChat,     setShowNewChat]      = useState(false);
  const [showLinkPicker,  setShowLinkPicker]  = useState(false);
  const [linkSearch,      setLinkSearch]      = useState('');
  const [linkLoading,     setLinkLoading]     = useState(false);
  const [directPhone,     setDirectPhone]     = useState('');
  const [directText,      setDirectText]      = useState('');
  const [directSending,   setDirectSending]   = useState(false);

  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const textareaRef    = useRef(null);

  /* ── toast helper ── */
  function flash(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  /* ── load contact list ── */
  const loadContacts = useCallback(async (silent = false) => {
    if (!silent) setLoadingContacts(true);
    try {
      const data = await apiFetch('/api/whatsapp/contacts?limit=100');
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) flash(`Failed to load contacts: ${err.message}`, 'error');
    } finally {
      if (!silent) setLoadingContacts(false);
    }
  }, []);

  /* ── load student list (for link picker) ── */
  const loadStudents = useCallback(async () => {
    try {
      const data = await apiFetch('/api/students/?limit=200');
      setStudents(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadContacts(); loadStudents(); }, [loadContacts, loadStudents]);

  /* ── load messages for selected contact ── */
  const loadMessages = useCallback(async (contactId, silent = false) => {
    if (!contactId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const data = await apiFetch(`/api/whatsapp/contacts/${contactId}/messages?limit=100`);
      setMessages(Array.isArray(data) ? data : []);
    } catch { /* silent on poll */ }
    finally { if (!silent) setLoadingMessages(false); }
  }, []);

  /* ── switch contact ── */
  function selectContact(contact) {
    setSelected(contact);
    setMessages([]);
    setShowInfo(false);
    setShowLinkPicker(false);
    loadMessages(contact.id);

    // update local unread count immediately
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unread_count: 0 } : c));
  }

  /* ── auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── polling every 10 s ── */
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => {
      loadMessages(selected.id, true);
      loadContacts(true);
    }, 10_000);
    return () => clearInterval(pollRef.current);
  }, [selected, loadMessages, loadContacts]);

  /* ── send message ── */
  async function sendMessage() {
    const txt = msgText.trim();
    if (!txt || !selected || sending) return;
    setSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const now = new Date().toISOString();
    // optimistic update
    setMessages(prev => [...prev, {
      id: optimisticId, direction: 'outbound', content: txt,
      message_type: 'text', status: 'sending', created_at: now,
    }]);
    setMsgText('');
    try {
      await apiFetch(`/api/whatsapp/contacts/${selected.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ text: txt }),
      });
      // reload to get real message id
      await loadMessages(selected.id, true);
      await loadContacts(true);
    } catch (err) {
      flash(`Send failed: ${err.message}`, 'error');
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setMsgText(txt); // restore
    } finally {
      setSending(false);
    }
  }

  /* ── send direct (new chat) ── */
  async function sendDirect(e) {
    e.preventDefault();
    const phone = directPhone.trim();
    const txt   = directText.trim();
    if (!phone || !txt) return;
    setDirectSending(true);
    try {
      const result = await apiFetch('/api/whatsapp/send-direct', {
        method: 'POST',
        body: JSON.stringify({ to: phone, text: txt }),
      });
      flash('Message sent!', 'success');
      setDirectPhone(''); setDirectText('');
      setShowNewChat(false);
      await loadContacts();
      // auto-select the new/existing contact
      if (result?.contact_id) {
        const updated = await apiFetch('/api/whatsapp/contacts?limit=100');
        if (Array.isArray(updated)) {
          setContacts(updated);
          const c = updated.find(x => x.id === result.contact_id);
          if (c) selectContact(c);
        }
      }
    } catch (err) {
      flash(`Failed: ${err.message}`, 'error');
    } finally {
      setDirectSending(false);
    }
  }

  /* ── link student to contact ── */
  async function linkStudent(studentId) {
    if (!selected || linkLoading) return;
    setLinkLoading(true);
    try {
      await apiFetch(`/api/whatsapp/contacts/${selected.id}/link-student`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId }),
      });
      flash('Student linked!', 'success');
      setShowLinkPicker(false);
      setLinkSearch('');
      await loadContacts();
      // refresh selected contact info
      const updated = await apiFetch('/api/whatsapp/contacts?limit=100');
      if (Array.isArray(updated)) {
        setContacts(updated);
        const c = updated.find(x => x.id === selected.id);
        if (c) setSelected(c);
      }
    } catch (err) {
      flash(`Link failed: ${err.message}`, 'error');
    } finally {
      setLinkLoading(false);
    }
  }

  /* ── unlink student ── */
  async function unlinkStudent() {
    if (!selected || !selected.student_id) return;
    if (!confirm('Remove student link from this contact?')) return;
    try {
      await apiFetch(`/api/whatsapp/contacts/${selected.id}/link-student`, { method: 'DELETE' });
      flash('Unlinked', 'info');
      await loadContacts();
      const updated = await apiFetch('/api/whatsapp/contacts?limit=100');
      if (Array.isArray(updated)) {
        setContacts(updated);
        const c = updated.find(x => x.id === selected.id);
        if (c) setSelected(c);
      }
    } catch (err) {
      flash(`Unlink failed: ${err.message}`, 'error');
    }
  }

  /* ── keyboard send ── */
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  /* ── textarea auto-resize ── */
  function onInput(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    setMsgText(el.value);
  }

  /* ── filtered contacts ── */
  const displayContacts = contacts.filter(c => {
    const name = c.student_name || c.display_name || c.phone_number || '';
    const q    = search.toLowerCase();
    const matchSearch = !q || name.toLowerCase().includes(q) || c.phone_number.includes(q);
    if (!matchSearch) return false;
    if (filter === 'unread')  return (c.unread_count || 0) > 0;
    if (filter === 'linked')  return !!c.student_id;
    return true;
  });

  const totalUnread = contacts.reduce((s, c) => s + (c.unread_count || 0), 0);

  /* ── student picker results ── */
  const pickerStudents = students.filter(s => {
    const name  = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase();
    const email = (s.email || '').toLowerCase();
    const q     = linkSearch.toLowerCase();
    return !q || name.includes(q) || email.includes(q) || (s.phone || '').includes(q);
  }).slice(0, 30);

  /* ── selected contact display name ── */
  const contactName = selected
    ? (selected.student_name || selected.display_name || selected.phone_number || 'Unknown')
    : '';

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 96px)', background: C.bgApp, fontFamily: "'Segoe UI', system-ui, sans-serif", borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>

      {/* ── keyframe injection ── */}
      <style>{`
        @keyframes wa-spin { to { transform: rotate(360deg); } }
        @keyframes wa-fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .wa-contact-row:hover { background: ${C.bgHover} !important; }
        .wa-contact-row.active { background: #2A3942 !important; }
        .wa-icon-btn:hover { background: rgba(134,150,160,0.15) !important; }
        .wa-send-btn:hover:not(:disabled) { background: #128C7E !important; }
        .wa-filter-chip:hover { background: #2A3942 !important; }
        .wa-picker-row:hover { background: #2A3942 !important; cursor: pointer; }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* ════════════════ LEFT SIDEBAR ════════════════ */}
      <div style={{ width: 360, minWidth: 300, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, background: C.bgApp }}>

        {/* Header */}
        <div style={{ background: C.bgPanel, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>
              LS
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>WhatsApp CRM</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{contacts.length} contacts</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="wa-icon-btn"
              title="New Chat"
              onClick={() => setShowNewChat(v => !v)}
              style={{ ...iconBtnStyle, color: showNewChat ? C.accent : C.textDim }}
            >
              <ChatPlusIcon />
            </button>
            <button
              className="wa-icon-btn"
              title="Refresh"
              onClick={() => loadContacts()}
              style={iconBtnStyle}
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {/* New Chat panel */}
        {showNewChat && (
          <form onSubmit={sendDirect} style={{ background: '#182229', borderBottom: `1px solid ${C.border}`, padding: 14, animation: 'wa-fadeIn 0.18s ease' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Chat</div>
            <input
              value={directPhone}
              onChange={e => setDirectPhone(e.target.value)}
              placeholder="+91 98765 43210"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <textarea
              value={directText}
              onChange={e => setDirectText(e.target.value)}
              placeholder="Type a message..."
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => setShowNewChat(false)} style={{ flex: 1, ...outlineBtnStyle }}>Cancel</button>
              <button type="submit" disabled={directSending || !directPhone.trim() || !directText.trim()} style={{ flex: 2, ...primaryBtnStyle, opacity: (directSending || !directPhone.trim() || !directText.trim()) ? 0.55 : 1 }}>
                {directSending ? <Spin size={14} /> : 'Send'}
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <div style={{ padding: '8px 10px', background: C.bgApp, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: C.bgPanel, borderRadius: 8, padding: '0 10px', gap: 8 }}>
            <SearchIcon />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or start new chat"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 13.5, padding: '9px 0' }}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, padding: '0 10px 8px', flexShrink: 0 }}>
          {[
            { key: 'all',    label: 'All' },
            { key: 'unread', label: `Unread${totalUnread > 0 ? ` ${totalUnread}` : ''}` },
            { key: 'linked', label: 'Linked' },
          ].map(f => (
            <button
              key={f.key}
              className="wa-filter-chip"
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? C.accent : '#2A3942',
                color: filter === f.key ? '#fff' : C.textDim,
                border: 'none', borderRadius: 20,
                padding: '4px 14px', fontSize: 12.5, cursor: 'pointer',
                fontWeight: filter === f.key ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Contact list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingContacts ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin size={28} /></div>
          ) : displayContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.textDim, fontSize: 13 }}>
              {contacts.length === 0
                ? 'No WhatsApp contacts yet.\nSend a direct message to create one.'
                : 'No contacts match your filter.'}
            </div>
          ) : displayContacts.map(c => {
            const name    = c.student_name || c.display_name || c.phone_number;
            const isActive = selected?.id === c.id;
            const lastMsg  = c.last_message || '';
            const unread   = c.unread_count || 0;
            return (
              <div
                key={c.id}
                className={`wa-contact-row${isActive ? ' active' : ''}`}
                onClick={() => selectContact(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.borderDim}`, background: isActive ? C.bgHover : 'transparent', transition: 'background 0.12s' }}
              >
                <div style={{ position: 'relative' }}>
                  <Avatar name={name} size={46} />
                  {c.student_id && (
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: C.accent, border: '2px solid #111B21', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{name}</span>
                    <span style={{ fontSize: 11, color: unread > 0 ? C.accent : C.textDim, flexShrink: 0, marginLeft: 8 }}>{fmtTime(c.last_message_at)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {lastMsg || c.phone_number}
                    </span>
                    {unread > 0 && (
                      <span style={{ background: C.accent, color: '#111B21', borderRadius: 10, padding: '2px 6px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{unread}</span>
                    )}
                  </div>
                  {c.student_name && (
                    <div style={{ marginTop: 3 }}>
                      <span style={{ fontSize: 10, background: 'rgba(0,168,132,0.15)', color: C.accent, border: `1px solid rgba(0,168,132,0.3)`, borderRadius: 8, padding: '1px 7px', fontWeight: 600 }}>
                        {c.student_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════════════ RIGHT: CHAT AREA ════════════════ */}
      {!selected ? (
        <EmptyState />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bgMsg, overflow: 'hidden' }}>

          {/* Chat header */}
          <div style={{ background: C.bgPanel, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setShowInfo(v => !v)}>
              <Avatar name={contactName} size={40} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{contactName}</div>
                <div style={{ fontSize: 12, color: C.textDim }}>
                  {selected.phone_number}
                  {selected.student_id && <span style={{ marginLeft: 8, color: C.accent }}>· Student linked</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* Link/Unlink student button */}
              {selected.student_id ? (
                <button className="wa-icon-btn" title="Unlink student" onClick={unlinkStudent} style={iconBtnStyle}>
                  <UnlinkIcon />
                </button>
              ) : (
                <button className="wa-icon-btn" title="Link to student" onClick={() => { setShowLinkPicker(v => !v); setLinkSearch(''); }} style={{ ...iconBtnStyle, color: showLinkPicker ? C.accent : C.textDim }}>
                  <LinkIcon />
                </button>
              )}
              <button className="wa-icon-btn" title={showInfo ? 'Hide info' : 'Show info'} onClick={() => setShowInfo(v => !v)} style={{ ...iconBtnStyle, color: showInfo ? C.accent : C.textDim }}>
                <InfoIcon />
              </button>
              <button className="wa-icon-btn" title="Refresh messages" onClick={() => loadMessages(selected.id)} style={iconBtnStyle}>
                <RefreshIcon />
              </button>
            </div>
          </div>

          {/* Link student picker */}
          {showLinkPicker && (
            <div style={{ background: '#182229', borderBottom: `1px solid ${C.border}`, padding: '12px 16px', animation: 'wa-fadeIn 0.15s ease', flexShrink: 0, maxHeight: 280, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Link to Student</div>
              <input
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                style={{ ...inputStyle, marginBottom: 10 }}
                autoFocus
              />
              {pickerStudents.length === 0 ? (
                <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: 10 }}>No students found</div>
              ) : pickerStudents.map(s => {
                const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email;
                return (
                  <div key={s.id} className="wa-picker-row" onClick={() => linkStudent(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, transition: 'background 0.12s' }}>
                    <Avatar name={name} size={32} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{name}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{s.email} {s.phone ? `· ${s.phone}` : ''}</div>
                    </div>
                    {linkLoading && <Spin size={14} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Contact info panel (expandable) */}
          {showInfo && (
            <ContactInfoPanel contact={selected} onClose={() => setShowInfo(false)} />
          )}

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 6%' }}>
            {loadingMessages ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><Spin size={28} /></div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.textDim, fontSize: 13, paddingTop: 40 }}>
                No messages yet. Send a message to start the conversation.
              </div>
            ) : (
              <MessageList messages={messages} messagesEndRef={messagesEndRef} />
            )}
          </div>

          {/* Input bar */}
          <div style={{ background: C.bgPanel, padding: '8px 14px', display: 'flex', alignItems: 'flex-end', gap: 8, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button className="wa-icon-btn" style={iconBtnStyle} title="Attach">
              <AttachIcon />
            </button>
            <textarea
              ref={textareaRef}
              value={msgText}
              onInput={onInput}
              onKeyDown={onKeyDown}
              placeholder="Type a message"
              rows={1}
              style={{
                flex: 1, background: C.bgInput, border: 'none', outline: 'none',
                borderRadius: 8, padding: '9px 14px', color: C.text, fontSize: 14,
                resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120,
                overflowY: 'auto',
              }}
            />
            <button
              className="wa-send-btn"
              onClick={sendMessage}
              disabled={!msgText.trim() || sending}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: msgText.trim() ? C.accent : '#2A3942',
                border: 'none', cursor: msgText.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0, transition: 'background 0.2s',
                opacity: sending ? 0.6 : 1,
              }}
              title="Send message"
            >
              {sending ? <Spin size={16} /> : <SendIcon />}
            </button>
          </div>

          {/* Keyboard hint */}
          <div style={{ background: C.bgPanel, textAlign: 'center', fontSize: 10, color: C.textSub, padding: '3px 0 6px' }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#1a0000' : toast.type === 'success' ? '#001a0e' : '#1a2332',
          color: toast.type === 'error' ? '#f87171' : toast.type === 'success' ? '#4ade80' : C.text,
          padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: 380,
          border: `1px solid ${toast.type === 'error' ? '#3f0000' : toast.type === 'success' ? '#003320' : C.border}`,
          animation: 'wa-fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─── Message list ───────────────────────────────────────────────────────── */
function MessageList({ messages, messagesEndRef }) {
  // Group by date
  let lastDate = null;
  return (
    <>
      {messages.map((msg, idx) => {
        const isOutbound = msg.direction === 'outbound';
        const d = msg.created_at ? new Date(msg.created_at) : null;
        const dateLabel = d ? d.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : null;
        const showDate  = dateLabel && dateLabel !== lastDate;
        if (showDate) lastDate = dateLabel;

        return (
          <div key={msg.id || idx}>
            {showDate && (
              <div style={{ textAlign: 'center', margin: '12px 0', color: C.textDim, fontSize: 11.5 }}>
                <span style={{ background: '#182229', padding: '4px 12px', borderRadius: 8 }}>{dateLabel}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start', marginBottom: 3 }}>
              <div style={{
                maxWidth: '65%', padding: '7px 12px', borderRadius: 8,
                background: isOutbound ? C.bgBubMe : C.bgBubThem,
                color: C.text, fontSize: 13.5, lineHeight: 1.45,
                borderTopRightRadius: isOutbound ? 2 : 8,
                borderTopLeftRadius:  isOutbound ? 8 : 2,
                opacity: msg.status === 'sending' ? 0.65 : 1,
              }}>
                {/* Media / attachment label */}
                {msg.message_type !== 'text' && (
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontStyle: 'italic' }}>
                    [{msg.message_type}]
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 10.5, color: C.textDim }}>{fmtTime(msg.created_at)}</span>
                  {isOutbound && <StatusTick status={msg.status} />}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </>
  );
}

/* ─── Status tick (outbound messages) ───────────────────────────────────── */
function StatusTick({ status }) {
  if (status === 'sending') return <span style={{ fontSize: 10, color: C.textDim }}>⏱</span>;
  if (status === 'failed')  return <span style={{ fontSize: 10, color: '#ef4444' }}>✕</span>;
  const isRead = status === 'read';
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
      <path d="M1 6l4 4L15 1" stroke={isRead ? '#53BDEB' : '#8696A0'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 6l4 4" stroke={isRead ? '#53BDEB' : '#8696A0'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    </svg>
  );
}

/* ─── Contact info side panel ────────────────────────────────────────────── */
function ContactInfoPanel({ contact, onClose }) {
  const name = contact.student_name || contact.display_name || contact.phone_number;
  return (
    <div style={{ background: '#182229', borderBottom: `1px solid ${C.border}`, padding: '14px 20px', animation: 'wa-fadeIn 0.15s ease', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <Avatar name={name} size={52} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{name}</div>
          <div style={{ fontSize: 12, color: C.textDim }}>{contact.phone_number}</div>
          {contact.assigned_to && <div style={{ fontSize: 11, color: C.accent, marginTop: 3 }}>Assigned counsellor ID #{contact.assigned_to}</div>}
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { icon: '📞', label: 'Phone',    val: contact.phone_number },
          { icon: '🆔', label: 'WA ID',    val: contact.wa_id || '—' },
          { icon: '🎓', label: 'Student',  val: contact.student_name || 'Not linked' },
          { icon: '👁',  label: 'Last Seen', val: contact.last_seen ? fmtTime(contact.last_seen) : 'Unknown' },
        ].map(({ icon, label, val }) => (
          <div key={label} style={{ background: C.bgPanel, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 15 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: C.text }}>{val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Empty state (no contact selected) ─────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textDim, background: C.bgMsg }}>
      <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.4 }}>💬</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>WhatsApp CRM</div>
      <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
        Select a contact from the sidebar to view the conversation, or click the chat icon to start a new conversation.
      </div>
    </div>
  );
}
/* ─── Shared styles ──────────────────────────────────────────────────────── */
const iconBtnStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: C.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 7, borderRadius: '50%', transition: 'background 0.15s',
};
const inputStyle = {
  width: '100%', padding: '9px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, fontSize: 13, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const primaryBtnStyle = {
  background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'opacity 0.15s',
};
const outlineBtnStyle = {
  background: 'transparent', color: C.textDim, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer',
};

/* ─── Inline SVG icons ───────────────────────────────────────────────────── */
const SearchIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const SendIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const AttachIcon  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;
const InfoIcon    = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const RefreshIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const LinkIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const UnlinkIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
const ChatPlusIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>;
import { StatCard, SectionCard } from './UI';
import { Badge } from './UI';
import { formatCurrency, formatDateTime, formatLabel } from '../utils';
import React from 'react';
import { apiFetch, storage } from '../utils';
import BirthdayCard from './birthdaywish';

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function pct(val, total) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const BellIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const TrashIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const CheckIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const CheckAllIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 12 7 17 22 2"/><polyline points="16 6 12 10"/>
  </svg>
);
const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <triangle points="10.29 3.86 1.82 18 22.18 18"/>
    <path d="M12 9v4"/><path d="M12 17h.01"/>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
  </svg>
);

// ─── Notification Components ──────────────────────────────────────────────────
const NOTIF_TYPE_CONFIG = {
  attachment: { emoji: '📎', label: 'Sent an attachment', color: '#0284c7', bg: '#e0f2fe' },
  message:    { emoji: '💬', label: 'Sent a message',     color: '#7c3aed', bg: '#ede9fe' },
};
const typeOf = (n) => NOTIF_TYPE_CONFIG[n.type] || NOTIF_TYPE_CONFIG.message;

function ActionBtn({ title, hovered, onMouseEnter, onMouseLeave, onClick, icon, hoverColor, hoverBg }) {
  return (
    <button title={title} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 7,
        background: hovered ? hoverBg : 'var(--color-background-secondary)',
        border: '1px solid var(--color-border-tertiary)',
        color: hovered ? hoverColor : 'var(--color-text-tertiary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', padding: 0, flexShrink: 0,
      }}>{icon}</button>
  );
}

function HeaderBtn({ icon, label, color, hoverBg, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: hov ? hoverBg : 'transparent', border: 'none', cursor: 'pointer',
        fontSize: 11, color: hov ? color : 'var(--color-text-secondary)',
        fontWeight: 600, padding: '4px 8px', borderRadius: 6,
        fontFamily: 'inherit', transition: 'all 0.12s',
      }}>{icon}<span>{label}</span></button>
  );
}

function NotifRow({ n, onNotifClick, onMarkRead, onDelete }) {
  const tc = typeOf(n);
  const [actHov, setActHov] = React.useState(null);
  return (
    <div className="notif-row" onClick={() => onNotifClick(n)}
      style={{
        padding: '11px 14px', borderBottom: '1px solid var(--color-border-tertiary)',
        cursor: 'pointer', background: n.is_read ? 'transparent' : 'rgba(83,74,183,0.04)',
        display: 'flex', alignItems: 'flex-start', gap: 10, transition: 'background 0.1s', position: 'relative',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
      onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(83,74,183,0.04)'}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, marginTop: 1 }}>{tc.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#534AB7', flexShrink: 0, boxShadow: '0 0 0 2px rgba(83,74,183,0.2)' }} />}
          <span style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.student_name || `Student #${n.student_id}`}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{tc.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {n.university_name && (
            <span style={{ fontSize: 11, color: '#185FA5', background: '#E6F1FB', padding: '2px 7px', borderRadius: 5, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{n.university_name}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{formatRelativeTime(n.created_at)}</span>
        </div>
      </div>
      <div className="notif-row-actions" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginTop: 2 }} onClick={e => e.stopPropagation()}>
        {!n.is_read && <ActionBtn title="Mark as read" hovered={actHov === 'read'} onMouseEnter={() => setActHov('read')} onMouseLeave={() => setActHov(null)} onClick={() => onMarkRead(n)} icon={<CheckIcon />} hoverColor="#059669" hoverBg="#ecfdf5" />}
        <ActionBtn title="Delete" hovered={actHov === 'del'} onMouseEnter={() => setActHov('del')} onMouseLeave={() => setActHov(null)} onClick={() => onDelete(n)} icon={<TrashIcon />} hoverColor="#A32D2D" hoverBg="#FCEBEB" />
      </div>
    </div>
  );
}

function NotificationsBell({ notifications, onNotifClick, onMarkRead, onDelete, onMarkAllRead, onClearAll }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const unread = notifications.filter(n => !n.is_read).length;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: open ? 'var(--color-background-tertiary, #f0f0f8)' : 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: '7px 13px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit', transition: 'background 0.12s, box-shadow 0.12s', boxShadow: open ? '0 0 0 3px rgba(83,74,183,0.12)' : 'none', position: 'relative' }}>
        <BellIcon />
        {unread > 0 && <span style={{ background: '#534AB7', color: '#EEEDFE', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '18px', minWidth: 20, textAlign: 'center' }}>{unread > 99 ? '99+' : unread}</span>}
        {unread > 0 && !open && <span style={{ position: 'absolute', top: 6, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#534AB7', boxShadow: '0 0 0 0 rgba(83,74,183,0.5)', animation: 'notif-pulse 1.8s ease-out infinite', pointerEvents: 'none' }} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, width: 360, background: 'white', border: '1px solid var(--color-border-tertiary)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.13)', zIndex: 1000, overflow: 'hidden', animation: 'notif-drop 0.18s cubic-bezier(0.16,1,0.3,1)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(39,106,179,1)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Notifications</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {unread > 0 && <HeaderBtn icon={<CheckAllIcon />} label="Mark all read" color="#534AB7" hoverBg="#EEEDFE" onClick={onMarkAllRead} />}
              {notifications.length > 0 && <HeaderBtn icon={<TrashIcon size={12} />} label="Clear all" color="#A32D2D" hoverBg="#FCEBEB" onClick={() => { onClearAll(); setOpen(false); }} />}
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.length === 0
              ? <div style={{ padding: '44px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔔</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>You're all caught up</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', maxWidth: 220 }}>New messages and attachments from students will appear here.</div>
                </div>
              : notifications.map(n => <NotifRow key={n.id} n={n} onNotifClick={(notif) => { onNotifClick(notif); setOpen(false); }} onMarkRead={onMarkRead} onDelete={onDelete} />)
            }
          </div>
          {notifications.length > 0 && (
            <div style={{ padding: '9px 16px', borderTop: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{notifications.length} notification{notifications.length !== 1 ? 's' : ''} · Sorted by newest</span>
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes notif-pulse { 0% { box-shadow: 0 0 0 0 rgba(83,74,183,0.5); } 70% { box-shadow: 0 0 0 7px rgba(83,74,183,0); } 100% { box-shadow: 0 0 0 0 rgba(83,74,183,0); } }
        @keyframes notif-drop { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .notif-row-actions { opacity: 0; transition: opacity 0.12s; }
        .notif-row:hover .notif-row-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

// ─── Mini Bar Chart ────────────────────────────────────────────────────────────
function MiniBarChart({ data, valueKey, labelKey, color = '#534AB7' }) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{d[valueKey]}</span>
          <div style={{ width: '100%', background: 'var(--color-border-tertiary)', borderRadius: 4, height: 40, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
            <div style={{ width: '100%', background: color, borderRadius: 4, height: `${pct(d[valueKey] || 0, max)}%`, minHeight: d[valueKey] > 0 ? 3 : 0, transition: 'height 0.4s ease' }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Funnel Bar ────────────────────────────────────────────────────────────────
function FunnelRow({ label, count, total, color }) {
  const width = pct(count, total);
  const COLORS = {
    lead: { bg: '#dbeafe', fill: '#3b82f6', text: '#1d4ed8' },
    hot:  { bg: '#fee2e2', fill: '#ef4444', text: '#b91c1c' },
    warm: { bg: '#fef3c7', fill: '#f59e0b', text: '#b45309' },
    cold: { bg: '#e0f2fe', fill: '#0ea5e9', text: '#0369a1' },
    converted: { bg: '#dcfce7', fill: '#22c55e', text: '#15803d' },
    lost: { bg: '#f3f4f6', fill: '#9ca3af', text: '#4b5563' },
  };
  const c = COLORS[color] || COLORS.lead;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: c.text, fontWeight: 600, width: 72, textAlign: 'right', flexShrink: 0, textTransform: 'capitalize' }}>{label}</span>
      <div style={{ flex: 1, background: c.bg, borderRadius: 6, height: 22, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(width, count > 0 ? 4 : 0)}%`, background: c.fill, height: '100%', borderRadius: 6, transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
          {count > 0 && width > 15 && <span style={{ fontSize: 10, fontWeight: 700, color: 'white' }}>{count}</span>}
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', width: 28, textAlign: 'right', flexShrink: 0 }}>{count}</span>
    </div>
  );
}

// ─── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ value, max, size = 56, stroke = 5, color = '#534AB7', label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = pct(value, max || 1);
  const dash = (filled / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-border-tertiary)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center', maxWidth: 64 }}>{label}</span>
    </div>
  );
}

// ─── Deadline Badge ────────────────────────────────────────────────────────────
function DeadlineBadge({ days }) {
  if (days === 0) return <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '2px 7px', borderRadius: 5 }}>Today!</span>;
  if (days <= 2)  return <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '2px 7px', borderRadius: 5 }}>{days}d left</span>;
  if (days <= 5)  return <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: 5 }}>{days}d left</span>;
  return <span style={{ fontSize: 10, fontWeight: 600, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 5 }}>{days}d left</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardView({
  dashboard, recentStudents, recentApplications,
  students = [], onNavigate, notifRefreshKey,
}) {
  const [notifications, setNotifications] = React.useState([]);
  const deletedIdsRef = React.useRef(new Set());

  // ── Notification fetch & merge ────────────────────────────────────────────
  const fetchNotifications = React.useCallback(async () => {
    if (!storage.token) {
      setNotifications([]);
      return;
    }
    try {
      const data = await apiFetch('/api/notifications');
      const incoming = Array.isArray(data) ? data : [];
      setNotifications(prev => {
        const existingMap = new Map(prev.map(n => [n.id, n]));
        const merged = incoming
          .filter(n => !deletedIdsRef.current.has(n.id))
          .map(n => existingMap.has(n.id) ? { ...n, ...existingMap.get(n.id) } : n);
        merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return merged;
      });
    } catch (err) { console.error('Notification fetch error', err); }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, notifRefreshKey]);

  React.useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      if (deletedIdsRef.current.has(detail.id)) return;
      setNotifications(prev => {
        if (prev.some(n => n.id === detail.id)) return prev;
        return [detail, ...prev];
      });
    };
    window.addEventListener('student-message', handler);
    return () => window.removeEventListener('student-message', handler);
  }, []);

  // ── Notification handlers ─────────────────────────────────────────────────
  const handleNotifClick = async (n) => {
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
    if (onNavigate) onNavigate({ studentId: n.student_id, applicationId: n.application_id });
  };
  const handleMarkRead = async (n) => {
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
  };
  const handleDelete = async (n) => {
    deletedIdsRef.current.add(n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    try { await apiFetch(`/api/notifications/${n.id}`, { method: 'DELETE' }); }
    catch (err) {
      console.error('Failed to delete notification', err);
      deletedIdsRef.current.delete(n.id);
      setNotifications(prev => [n, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
  };
  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    apiFetch('/api/notifications/read-all', { method: 'PATCH' }).catch(() => {});
  };
  const handleClearAll = async () => {
    const snapshot = notifications;
    notifications.forEach(n => deletedIdsRef.current.add(n.id));
    setNotifications([]);
    try { await apiFetch('/api/notifications', { method: 'DELETE' }); }
    catch (err) {
      console.error('Failed to clear all notifications', err);
      snapshot.forEach(n => deletedIdsRef.current.delete(n.id));
      setNotifications(snapshot);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!dashboard) return (
    <div className="view-loading">
      <div className="spinner-lg" />
      <p>Loading dashboard data…</p>
    </div>
  );

  const kpis = dashboard.student_kpis;
  const paySum = dashboard.payment_summary;
  const docStats = dashboard.document_stats;
  const funnelTotal = dashboard.lead_funnel?.reduce((s, r) => s + r.count, 0) || 1;

  const monthlyData = (dashboard.monthly_activity || []).map(m => ({
    label: m.month?.slice(5) || '',
    students: m.new_students,
    apps: m.new_applications,
    offers: m.offers,
    payments: m.payments_collected,
  }));

  return (
    <div className="view-stack">

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10 }}>
        <NotificationsBell
          notifications={notifications}
          onNotifClick={handleNotifClick}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
          onMarkAllRead={handleMarkAllRead}
          onClearAll={handleClearAll}
        />
      </div>

      {/* ── KPI Row ── */}
      <div className="stats-grid">
        <StatCard label="Total Students"  value={kpis.total_students}     helper="Open prospects"      color="blue" />
        <StatCard label="Converted"       value={kpis.total_converted}    helper="Active students"     color="green" />
        <StatCard label="Applications"    value={kpis.total_applications} helper="Across all students" color="purple" />
        <StatCard label="Offers"          value={kpis.admits_received}    helper="Offers received"     color="teal" />
        <StatCard label="Visa Approved"   value={kpis.visa_approved}      helper="Cleared"             color="green" />
        <StatCard label="Visa Rejected"   value={kpis.visa_rejected}      helper="Declined"            color="orange" />
      </div>

      {/* ── Deadlines + Birthdays ── */}
      {((dashboard.applications_deadline_soon?.length > 0) || (dashboard.birthdays_today?.length > 0)) && (
        <div className="two-col-grid">
          {dashboard.applications_deadline_soon?.length > 0 && (
            <SectionCard title="⏰ Deadlines This Week" subtitle="Applications due in the next 7 days">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dashboard.applications_deadline_soon.map(d => (
                  <div key={d.application_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--color-background-secondary)', borderRadius: 8, border: '1px solid var(--color-border-tertiary)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.student_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.university_name} · {d.course_name}</div>
                    </div>
                    <DeadlineBadge days={d.days_left} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {dashboard.birthdays_today?.length > 0 && (
            <SectionCard title="🎂 Birthdays Today" subtitle="Students celebrating today">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dashboard.birthdays_today.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'linear-gradient(135deg,#fff7ed,#fef3c7)', borderRadius: 8, border: '1px solid #fde68a' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎁</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{s.name || s.email}</div>
                      <div style={{ fontSize: 11, color: '#b45309' }}>{s.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Recent Students + Lead Funnel ── */}
      <div className="two-col-grid">
        <SectionCard title="Recent Students" subtitle="Latest registrations">
          <div className="list-items">
            {recentStudents.length === 0 && <p className="text-muted" style={{ fontSize: 12 }}>No recent students</p>}
            {recentStudents.map(s => (
              <div className="list-item" key={s.id}>
                <div className="list-item-avatar">{((s.name || s.email || 'S').charAt(0)).toUpperCase()}</div>
                <div className="list-item-info">
                  <strong>{s.name || s.email}</strong>
                  <span>{s.email}</span>
                </div>
                <div className="list-item-meta"><small>{formatDateTime(s.created_at)}</small></div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Lead Funnel" subtitle="Students by pipeline stage">
          <div style={{ marginTop: 8 }}>
            {dashboard.lead_funnel?.map(row => (
              <FunnelRow key={row.status} label={row.status} count={row.count} total={funnelTotal} color={row.status} />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Application Status + Intake Distribution ── */}
      <div className="two-col-grid">
        <SectionCard title="Application Status" subtitle="All applications by status">
          {(dashboard.application_status_breakdown || []).length === 0
            ? <p className="text-muted" style={{ fontSize: 12 }}>No data</p>
            : (dashboard.application_status_breakdown || []).map(row => {
                const total = dashboard.application_status_breakdown.reduce((s, r) => s + r.count, 0);
                return (
                  <div key={row.status} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{(row.status || '').replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.count}</span>
                    </div>
                    <div style={{ background: 'var(--color-border-tertiary)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(row.count, total)}%`, background: '#534AB7', height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })
          }
        </SectionCard>

        <SectionCard title="Intake Distribution" subtitle="Applications by intake period">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(dashboard.intake_distribution || []).slice(0, 8).map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', width: 90, flexShrink: 0 }}>{row.intake_month || '—'} {row.intake_year || ''}</span>
                <div style={{ flex: 1, background: 'var(--color-border-tertiary)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${pct(row.count, Math.max(...(dashboard.intake_distribution||[]).map(r=>r.count),1))}%`, background: '#7c3aed', height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', width: 24, textAlign: 'right' }}>{row.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Recent Applications Table ── */}
      <SectionCard title="Recent Applications" subtitle="Latest application activity across all students">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>University</th>
                <th>Course</th>
                <th>Application Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentApplications.length === 0 && (
                <tr><td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>No recent applications</td></tr>
              )}
              {recentApplications.map((item) => {
                const student = students.find(s => String(s.id) === String(item.student_id));
                const studentName = student
                  ? [student.first_name, student.last_name].filter(Boolean).join(' ') || student.email
                  : `Student #${item.student_id}`;
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{studentName}</td>
                    <td className="text-muted">{item.university?.name || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{item.course_name || '—'}</td>
                    <td><Badge value={item.application_status} /></td>
                    
                    <td className="text-muted">{formatDateTime(item.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Top Universities ── */}
      <SectionCard title="Top Universities" subtitle="Universities by application volume">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SN</th>
                <th>University</th>
                <th>Country</th>
                <th>Category</th>
                <th>Applications</th>
                <th>Offers</th>
                <th>Visa Approved</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.top_universities || []).map((u, i) => (
                <tr key={u.university_id}>
                  <td className="text-muted" style={{ fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{u.university_name}</td>
                  <td><span style={{ fontSize: 13 }}></span> {u.country}</td>
                  <td className="text-muted" style={{ textTransform: 'capitalize' }}>{u.category}</td>
                  <td style={{ fontWeight: 600 }}>{u.total_applications}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 5 }}>{u.offers_received}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: 5 }}>{u.visa_approved}</span>
                  </td>
                </tr>
              ))}
              {(dashboard.top_universities || []).length === 0 && (
                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Top Destinations ── */}
      <SectionCard title="Top Destinations" subtitle="Countries by application volume">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(dashboard.top_countries || []).map((c, i) => (
            <div key={i} style={{ flex: '1 1 160px', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>{c.country}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Applications</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.total_applications}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Offers</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>{c.offers}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Visas</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>{c.visas_approved}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Recent Offers ── */}
      <SectionCard title="Recent Offers" subtitle="Conditional, unconditional & accepted offers">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>University</th>
                <th>Course</th>
                <th>Intake</th>
                <th>Status</th>
                <th>Visa</th>
                <th>Tuition</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.recent_offers || []).map(o => (
                <tr key={o.application_id}>
                  <td style={{ fontWeight: 500 }}>{o.student_name}</td>
                  <td className="text-muted">{o.university_name}</td>
                  <td style={{ fontWeight: 500 }}>{o.course_name || '—'}</td>
                  <td className="text-muted">{o.intake_month || '—'} {o.intake_year || ''}</td>
                  <td><Badge value={o.application_status} /></td>
                  <td><Badge value={o.visa_status} /></td>
                  <td style={{ fontWeight: 500 }}>{o.tuition_fee ? formatCurrency(o.tuition_fee, o.currency) : '—'}</td>
                </tr>
              ))}
              {(dashboard.recent_offers || []).length === 0 && (
                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>No offers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Counsellor Performance (admin only) ── */}
      {(dashboard.counsellor_performance || []).length > 0 && (
        <SectionCard title="Counsellor Performance" subtitle="Team metrics — admins only">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Counsellor</th>
                  <th>Students</th>
                  <th>Leads</th>
                  <th>Converted</th>
                  <th>Conv. Rate</th>
                  <th>Applications</th>
                  <th>Offers</th>
                  <th>Visa OK</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.counsellor_performance.map(c => (
                  <tr key={c.counsellor_id}>
                    <td style={{ fontWeight: 600 }}>{c.counsellor_name}</td>
                    <td>{c.total_students}</td>
                    <td>{c.leads}</td>
                    <td><span style={{ fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 5 }}>{c.converted}</span></td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.conversion_rate >= 50 ? '#15803d' : c.conversion_rate >= 25 ? '#b45309' : '#b91c1c' }}>
                        {c.conversion_rate}%
                      </span>
                    </td>
                    <td>{c.total_applications}</td>
                    <td>{c.offers}</td>
                    <td>{c.visas_approved}</td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(c.revenue_collected, 'INR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Recent Students Full List (performance section) ── */}
      <SectionCard title="Students Overview" subtitle="All recent registrations with counsellor">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Lead Status</th>
                <th>Counsellor</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.recent_students || []).map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name || s.email}</td>
                  <td className="text-muted">{s.email}</td>
                  <td><Badge value={s.lead_status} /></td>
                  <td className="text-muted">{s.counsellor_name || '—'}</td>
                  <td className="text-muted">{formatDateTime(s.created_at)}</td>
                </tr>
              ))}
              {(dashboard.recent_students || []).length === 0 && (
                <tr><td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

    </div>
  );
}

import { NavIcon } from './UI';
import { NAV_BY_ROLE, formatLabel } from '../utils';

export default function Sidebar({ auth, activeView, setActiveView, logout,  students,
  profile,  setOpenedStudentId, collapsed = false, onToggleCollapse }) {
  const navItems = NAV_BY_ROLE[auth.role] || [];

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">LS</div>
        <div className="brand-text">
          <span className="brand-name">{auth.role === "platform_super_admin" ? "SaaS Platform" : "EduCRM"}</span>
          <span className="brand-sub">{auth.role === 'platform_super_admin' ? 'Admin' : 'CRM'}</span>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
            )}
          </svg>
        </button>
      </div>

      <div className="sidebar-section-label">Navigation</div>

      <nav className="nav-stack">
       {navItems.map(item => (
  <button
    key={item.key}
    className={`nav-item ${activeView === item.key ? 'active' : ''}`}
    onClick={() => {
      if (item.key === 'myinfo') {
        const myStudent = students.find(
          s => s.email === profile?.email
        );

        if (myStudent) {
          setOpenedStudentId(myStudent.id);
        }
      }

      setActiveView(item.key);
    }}
  >
          
            <span className="nav-icon"><NavIcon path={item.icon} /></span>
            <span className="nav-label">{item.label}</span>
            {activeView === item.key && <span className="nav-active-bar" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">
            {(auth.fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <strong>{auth.fullName || 'CRM User'}</strong>
            <span>{formatLabel(auth.role)}</span>
          </div>
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

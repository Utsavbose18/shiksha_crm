import { useEffect, useMemo, useState } from 'react';
import './App.css';
import React from 'react';
import { storage, apiFetch, NAV_BY_ROLE } from './utils';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import DashboardView from './components/DashboardView';
import StudentsView from './components/StudentsView';
import ApplicationsView from './components/ApplicationsView';
import ProfileView from './components/ProfileView';
import ChangePasswordForm from './components/ChangePasswordForm';
import StudentProfileModal from './components/StudentProfileModal';
import { UsersView, UniversitiesView } from './components/OtherViews';
import NotesPage from './components/NotesPage';
import { FinanceView } from './components/FinanceView';
import StudentEnquiryPage from './components/Studentenquirypage';
import WhatsAppQuickSend from './components/WhatsAppQuickSend';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('🔥 RENDER CRASH:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#fff' }}>
          <h2>Render Error:</h2>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Persisted active-view helpers ─────────────────────────────────────────────
const ACTIVE_VIEW_KEY = 'crm_active_view';
const OPEN_STUDENT_MODAL_KEY = 'crm_open_student_modal';

function saveActiveView(view) {
  try { localStorage.setItem(ACTIVE_VIEW_KEY, view); } catch {}
}

function loadActiveView() {
  try { return localStorage.getItem(ACTIVE_VIEW_KEY) || null; } catch { return null; }
}

function saveOpenStudentModal({ studentId, initialTab = 'profile', applicationId = null }) {
  if (!studentId) return;
  try {
    localStorage.setItem(OPEN_STUDENT_MODAL_KEY, JSON.stringify({
      studentId: String(studentId),
      initialTab,
      applicationId,
    }));
  } catch {}
}

function loadOpenStudentModal() {
  try {
    const raw = localStorage.getItem(OPEN_STUDENT_MODAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.studentId) return null;
    return {
      studentId: String(parsed.studentId),
      initialTab: parsed.initialTab || 'profile',
      applicationId: parsed.applicationId || null,
    };
  } catch {
    return null;
  }
}

function clearOpenStudentModal() {
  try { localStorage.removeItem(OPEN_STUDENT_MODAL_KEY); } catch {}
}

// Views that are only valid for specific roles — used to validate the saved view
// on refresh so we never restore a view the current role can't access.
const ROLE_ALLOWED_VIEWS = {
  admin:      new Set(['dashboard','students','applications','users','universities','additional_settings','notes','student_enquiry','finance','profile','change_password','whatsapp']),
  counsellor: new Set(['dashboard','students','applications','notes','student_enquiry','finance','profile','change_password','whatsapp']),
  student:    new Set(['profile','applications','myinfo','change_password']),
};

function resolveInitialView(role, mustChangePassword, savedView) {
  if (mustChangePassword) return 'change_password';
  if (role === 'student') {
    // Students only land on profile or their own whitelisted views
    if (savedView && ROLE_ALLOWED_VIEWS.student?.has(savedView)) return savedView;
    return 'profile';
  }
  if (savedView && ROLE_ALLOWED_VIEWS[role]?.has(savedView)) return savedView;
  return 'dashboard';
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [auth, setAuth] = useState({
    token: storage.token,
    role: storage.role,
    fullName: storage.name,
    accessToken: storage.token,
  });

  const [mustChangePassword, setMustChangePassword] = useState(
    localStorage.getItem('must_change_password') === 'true'
  );

  const [activeView, setActiveViewRaw] = useState(() => {
    const must = localStorage.getItem('must_change_password') === 'true';
    const saved = loadActiveView();
    return resolveInitialView(storage.role, must, saved);
  });

  // Wrap setter so every navigation also persists to localStorage
  const setActiveView = (view) => {
    setActiveViewRaw(view);
    saveActiveView(view);
  };

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [globalError, setGlobalError] = useState('');

  // Data state
  const [dashboard, setDashboard] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [recentApplications, setRecentApplications] = useState([]);
  const [students, setStudents] = useState([]);
  const [users, setUsers] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [services, setServices] = useState([]);
  const [profile, setProfile] = useState(null);

  // Selection state
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState('');

  // Modal state
  const [initialModalState] = useState(() => (
    storage.role && storage.role !== 'student' ? loadOpenStudentModal() : null
  ));
  const [openedStudentId, setOpenedStudentId] = useState(initialModalState?.studentId || '');
  const [modalInitialTab, setModalInitialTab] = useState(initialModalState?.initialTab || 'profile');
  const [modalInitialAppId, setModalInitialAppId] = useState(initialModalState?.applicationId || null);

  const [notifRefreshKey, setNotifRefreshKey] = useState(0);

  const navItems = useMemo(() => {
    const base = NAV_BY_ROLE[auth.role] || [];
    if (mustChangePassword) {
      return [
        { key: 'change_password', label: 'Change Password', icon: 'M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
      ];
    }
    return base;
  }, [auth.role, mustChangePassword]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function handleLogin(credentials) {
    setLoading(true);
    setLoginError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', credentials.email);
      formData.append('password', credentials.password);

      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      storage.token = data.access_token;
      storage.refresh = data.refresh_token;
      storage.role = data.role;
      storage.name = data.full_name;

      localStorage.setItem('access_token', data.access_token);

      const forceChange = !!data.must_change_password;
      localStorage.setItem('must_change_password', forceChange ? 'true' : 'false');
      clearOpenStudentModal();

      setAuth({
        token: data.access_token,
        accessToken: data.access_token,
        role: data.role,
        fullName: data.full_name,
      });

      setMustChangePassword(forceChange);

      // On fresh login always start at the canonical home page,
      // then let the user navigate — don't restore the previous session view.
      const homeView = forceChange
        ? 'change_password'
        : data.role === 'student' ? 'profile' : 'dashboard';

      setActiveView(homeView);

      return data;
    } catch (err) {
      setLoginError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    storage.clear();
    localStorage.removeItem('must_change_password');
    localStorage.removeItem(ACTIVE_VIEW_KEY);       // clear saved view on logout
    clearOpenStudentModal();
    setMustChangePassword(false);
    setAuth({ token: '', role: '', fullName: '', accessToken: '' });
    setDashboard(null);
    setStudents([]);
    setUsers([]);
    setUniversities([]);
    setApplications([]);
    setServices([]);
    setProfile(null);
    setSelectedStudentId('');
    setSelectedApplicationId('');
    setOpenedStudentId('');
    setModalInitialTab('profile');
    setModalInitialAppId(null);
    setActiveViewRaw('dashboard'); // raw setter — no point saving 'dashboard' after logout
  }

  function handlePasswordChanged() {
    localStorage.setItem('must_change_password', 'false');
    setMustChangePassword(false);
    const homeView = auth.role === 'student' ? 'profile' : 'dashboard';
    setActiveView(homeView);
  }

  // ── Data loaders ──────────────────────────────────────────────────────────
  async function loadDashboard() {
    const [d, rs, ra] = await Promise.all([
      apiFetch('/api/dashboard/'),
      apiFetch('/api/dashboard/students/recent'),
      apiFetch('/api/dashboard/applications/recent'),
    ]);

    const studentIds = [...new Set((ra || []).map((item) => item.student_id).filter(Boolean))];

    const applicationLists = await Promise.all(
      studentIds.map(async (studentId) => {
        try {
          const apps = await apiFetch(`/api/students/${studentId}/applications/`);
          return Array.isArray(apps) ? apps : [];
        } catch (err) {
          console.error(`Failed to load applications for student ${studentId}`, err);
          return [];
        }
      })
    );

    const allApplications = applicationLists.flat();

    const enrichedRecentApplications = (ra || []).map((item) => {
      const matched = allApplications.find((app) => String(app.id) === String(item.id));
      return matched
        ? {
            ...item,
            university: matched.university || item.university || null,
            university_id: matched.university_id || item.university_id || null,
            course_name: matched.course_name || item.course_name,
            application_status: matched.application_status || item.application_status,
            visa_status: matched.visa_status || item.visa_status,
            created_at: matched.created_at || item.created_at,
          }
        : item;
    });

    setDashboard(d);
    setRecentStudents(rs || []);
    setRecentApplications(enrichedRecentApplications);
  }

  async function loadStudents() {
    const data = await apiFetch('/api/students/');
    setStudents(data || []);
    if (!selectedStudentId && data?.length) setSelectedStudentId(String(data[0].id));
  }

  async function loadUsers() {
    const data = await apiFetch('/api/users/');
    setUsers(data || []);
  }

  async function loadUniversities() {
    const data = await apiFetch('/api/universities/');
    setUniversities(data || []);
  }

  async function loadApplications() {
    if (auth.role === 'student') {
      const data = await apiFetch('/api/me/applications/');
      setApplications(data || []);
      if (!selectedApplicationId && data?.length) setSelectedApplicationId(String(data[0].id));
      return;
    }
    const data = await apiFetch('/api/applications/');
    setApplications(data || []);
    if (!selectedApplicationId && data?.length) setSelectedApplicationId(String(data[0].id));
  }

  async function loadServices() {
    const q = selectedStudentId && auth.role !== 'student' ? `?student_id=${selectedStudentId}` : '';
    const data = await apiFetch(`/api/services/${q}`);
    setServices(data || []);
  }

  async function loadProfile() {
    const endpoint = auth.role === 'student' ? '/api/me/profile' : '/api/auth/me';
    const data = await apiFetch(endpoint);
    setProfile(data);
  }

  async function loadCustomFields() {
    const data = await apiFetch('/api/admin/custom-fields');
    setCustomFields(data || []);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.token || !auth.role) return;
    (async () => {
      setGlobalError('');
      try {
        if (mustChangePassword) {
          await loadProfile();
          return;
        }
        if (auth.role !== 'student') {
          await Promise.all([loadStudents(), loadUniversities(), loadProfile()]);
          if (auth.role === 'admin') {
            await Promise.all([loadUsers(), loadCustomFields()]);
          }
          await loadDashboard();
        } else {
          await loadProfile();
        }
      } catch (err) {
        setGlobalError(err.message);
      }
    })();
  }, [auth.token, auth.role, mustChangePassword]);

  useEffect(() => {
    if (activeView === 'notes' && !['admin', 'counsellor'].includes(auth.role)) {
      setActiveView(auth.role === 'student' ? 'profile' : 'dashboard');
    }
  }, [activeView, auth.role]);

  // ── View-based data loading ────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.token || mustChangePassword) return;
    const loaders = {
      dashboard:           auth.role !== 'student' ? loadDashboard : null,
      students:            auth.role !== 'student' ? loadStudents : null,
      users:               auth.role === 'admin' ? loadUsers : null,
      universities:        auth.role !== 'student' ? loadUniversities : null,
      applications:        loadApplications,
      services:            auth.role !== 'student' ? loadServices : null,
      profile:             loadProfile,
      additional_settings: auth.role === 'admin' ? loadCustomFields : null,
      notes:               ['admin', 'counsellor'].includes(auth.role) ? async () => {} : null,
      student_enquiry:     ['admin', 'counsellor'].includes(auth.role) ? async () => {} : null,
      finance:             auth.role !== 'student' ? async () => {} : null,
    };
    const run = loaders[activeView];
    if (run) run().catch(err => setGlobalError(err.message));
  }, [activeView, selectedStudentId, auth.token, mustChangePassword]);

  // ── Notification navigation ────────────────────────────────────────────────
  function openStudentModal(studentId, { initialTab = 'profile', applicationId = null } = {}) {
    if (!studentId) return;
    const nextStudentId = String(studentId);
    setModalInitialTab(initialTab);
    setModalInitialAppId(applicationId || null);
    setOpenedStudentId(nextStudentId);
    saveOpenStudentModal({ studentId: nextStudentId, initialTab, applicationId: applicationId || null });
  }

  function handleNotifNavigate({ studentId, applicationId }) {
    if (!studentId) return;
    openStudentModal(studentId, { initialTab: 'applications', applicationId });
    setNotifRefreshKey(k => k + 1);
  }

  function handleModalClose() {
    setOpenedStudentId('');
    setModalInitialTab('profile');
    setModalInitialAppId(null);
    clearOpenStudentModal();
    setNotifRefreshKey(k => k + 1);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!auth.token) {
    return <LoginScreen onLogin={handleLogin} error={loginError} loading={loading} />;
  }

  const openedStudent = students.find(s => String(s.id) === String(openedStudentId));

  function renderView() {
    switch (activeView) {
      case 'change_password':
        return (
          <ChangePasswordForm
            auth={auth}
            onLogout={logout}
            onPasswordChanged={handlePasswordChanged}
            forceChange={mustChangePassword}
          />
        );

      case 'notes':
        return ['admin', 'counsellor'].includes(auth.role)
          ? <NotesPage />
          : <div className="p-6 text-red-600 font-semibold">Access denied</div>;

      case 'dashboard':
        return (
          <DashboardView
            dashboard={dashboard}
            recentStudents={recentStudents}
            recentApplications={recentApplications}
            students={students}
            onNavigate={handleNotifNavigate}
            notifRefreshKey={notifRefreshKey}
          />
        );

      case 'students':
        return (
          <StudentsView
            students={students}
            users={users}
            auth={auth}
            selectedStudentId={selectedStudentId}
            setSelectedStudentId={sid => {
              setSelectedStudentId(sid);
              setSelectedApplicationId('');
            }}
            openedStudentId={openedStudentId}
            setOpenedStudentId={id => {
              if (id) openStudentModal(id);
              else handleModalClose();
            }}
            onRefresh={loadStudents}
            setGlobalError={setGlobalError}
          />
        );

      case 'applications':
        if (auth.role === 'student') {
          if (!profile) return null;
          return (
            <StudentProfileModal
              student={profile}
              studentId={profile.id ?? profile.student_id}
              users={[]}
              isAdmin={false}
              isCounsellor={false}
              userRole={auth.role}
              initialTab="applications"
              setGlobalError={setGlobalError}
            />
          );
        }
        return (
          <ApplicationsView
            applications={applications}
            students={students}
            universities={universities}
            auth={auth}
            selectedStudentId={selectedStudentId}
            selectedApplicationId={selectedApplicationId}
            setSelectedApplicationId={setSelectedApplicationId}
            onRefresh={loadApplications}
            setGlobalError={setGlobalError}
            onOpenStudent={id => {
              openStudentModal(id, { initialTab: 'applications' });
            }}
          />
        );

      case 'services':
        return (
          <ServicesView
            services={services}
            students={students}
            selectedStudentId={selectedStudentId}
            onRefresh={loadServices}
            setGlobalError={setGlobalError}
          />
        );

      case 'users':
        return <UsersView users={users} onRefresh={loadUsers} setGlobalError={setGlobalError} />;

      case 'universities':
        return <UniversitiesView universities={universities} onRefresh={loadUniversities} setGlobalError={setGlobalError} />;

      case 'additional_settings':
        return (
          <AdditionalSettingsView
            customFields={customFields}
            onRefresh={loadCustomFields}
            setGlobalError={setGlobalError}
            auth={auth}
          />
        );

      case 'profile':
        return <ProfileView profile={profile} auth={auth} setGlobalError={setGlobalError} />;

      case 'myinfo': {
        if (!profile) return null;
        return (
          <StudentProfileModal
            student={profile}
            studentId={profile.id ?? profile.student_id}
            users={users}
            isAdmin={false}
            isCounsellor={false}
            userRole={auth.role}
            setGlobalError={setGlobalError}
          />
        );
      }

      case 'student_enquiry':
        return ['admin', 'counsellor'].includes(auth.role)
          ? <StudentEnquiryPage />
          : <div className="p-6 text-red-600 font-semibold">Access denied</div>;

      case 'finance':
        return (
          <FinanceView
            students={students}
            selectedStudentId={selectedStudentId}
            applyStudentFilter={false}
            setGlobalError={setGlobalError}
          />
        );

      default:
        return (
          <DashboardView
            dashboard={dashboard}
            recentStudents={recentStudents}
            recentApplications={recentApplications}
            onNavigate={handleNotifNavigate}
            notifRefreshKey={notifRefreshKey}
          />
        );

        case 'whatsapp':
  return ['admin', 'counsellor'].includes(auth.role)
    ? <WhatsAppQuickSend />
    : <div>Access denied</div>;
    }
  }

  const currentNav = navItems.find(n => n.key === activeView);

  return (
    <div className="app-shell">
      <Sidebar
        auth={auth}
        activeView={activeView}
        setActiveView={setActiveView}
        logout={logout}
        students={students}
        profile={profile}
        setOpenedStudentId={id => {
          if (id) openStudentModal(id);
          else handleModalClose();
        }}
      />

      <div className="main-area">
        <header className="topbar">
          <div>
            <h2 className="topbar-title">{currentNav?.label || 'Dashboard'}</h2>
            <p className="topbar-sub">LetzStudy — Student Counselling Platform</p>
          </div>
        </header>

        {globalError && (
          <div className="global-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{globalError}</span>
            <button onClick={() => setGlobalError('')}>×</button>
          </div>
        )}

        {auth.role === 'student' && !mustChangePassword && (
          <div className="info-banner">
            You are viewing the student portal. Contact your counsellor for assistance.
          </div>
        )}

        <div className="view-content">
          {renderView()}
        </div>
      </div>

      {openedStudentId && auth.role !== 'student' && (
        <StudentProfileModal
          studentId={openedStudentId}
          student={openedStudent || {}}
          onClose={handleModalClose}
          onTabChange={tab => {
            setModalInitialTab(tab);
            saveOpenStudentModal({
              studentId: openedStudentId,
              initialTab: tab,
              applicationId: modalInitialAppId,
            });
          }}
          isAdmin={auth.role === 'admin'}
          isCounsellor={auth.role === 'counsellor'}
          userRole={auth.role}
          initialTab={modalInitialTab}
          initialApplicationId={modalInitialAppId}
        />
      )}
    </div>
  );
}

export default App;

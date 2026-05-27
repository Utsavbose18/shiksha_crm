export const API_BASE_URL = import.meta.env.VITE_API_URL;

export const STATUS_STYLES = {
  lead: 'soft', converted: 'success', shortlisted: 'soft', applied: 'info',
  under_review: 'warning', conditional_offer: 'warning', unconditional_offer: 'success',
  accepted: 'success', rejected: 'danger', waitlisted: 'warning', withdrawn: 'muted',
  not_applied: 'muted', visa_applied: 'info', visa_approved: 'success', visa_rejected: 'danger',
  pending: 'warning', done: 'success', partial: 'info', active: 'info',
  completed: 'success', cancelled: 'danger', admin: 'info', counsellor: 'soft',
};

export const DOCUMENT_TYPES = ['passport','transcript','lor','sop','cv','ielts','toefl','gre','gmat','sat','act','bank_statement','other'];
export const SERVICE_TYPES = ['test_prep','accommodation','flywire','loan','forex','visa_assistance'];
export const PAYMENT_STATUSES = ['pending','done','partial'];
export const APPLICATION_STATUS = ['initiated','pending_from_student','pending_from_LS','conditional_offer','unconditional_offer','case_closed','application_on_hold','funds_approved','offer_accepted','rejected','waitlisted', 'deferral','fee_paid','tuition_payment_not_done','visa_applied','visa_approved','visa_rejected'];
export const VISA_STATUSES = ['not_applied','visa_applied','visa_approved','visa_rejected'];
export const USER_ROLES = ['admin','counsellor'];


export const NAV_BY_ROLE = {
  admin: [
    { key: 'dashboard',            label: 'Dashboard',            icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { key: 'students',             label: 'Students',             icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { key: 'applications',         label: 'Applications',         icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'finance',              label: 'Finance & Services',   icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { key: 'users',                label: 'Users',                icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { key: 'universities',         label: 'Universities',         icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
    { key: 'notes',                label: 'Notes',                icon: 'M9 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8l-6-6zM9 2v6h6M7 13h6M7 17h4' },
    { key: 'profile',              label: 'Profile',              icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { key: 'student_enquiry',      label: 'Student Enquiry',      icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.293-.501-.028-.771.234-.988.218-.19.48-.494.679-.685.198-.19.277-.348.405-.57.131-.225.067-.421-.02-.571-.088-.15-.738-1.77-1.013-2.445-.267-.645-.54-.561-.739-.57-.192-.009-.405-.012-.607-.012-.2 0-.527.075-.803.371-.277.297-1.056 1.02-1.056 2.52 0 1.5 1.095 2.94 1.248 3.142.153.199 2.143 3.253 5.219 4.56.73.312 1.3.5 1.743.645.732.231 1.398.197 1.925.12.587-.088 1.767-.72 2.016-1.413.25-.69.25-1.281.175-1.407-.074-.124-.272-.197-.571-.347z' },

  ],
  counsellor: [
    { key: 'dashboard',    label: 'Dashboard',    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { key: 'students',     label: 'Students',     icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { key: 'applications', label: 'Applications', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'finance',              label: 'Finance & Services',   icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { key: 'universities', label: 'Universities', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
    { key: 'notes',        label: 'Notes',        icon: 'M9 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8l-6-6zM9 2v6h6M7 13h6M7 17h4' },
    { key: 'profile',      label: 'Profile',      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { key: 'student_enquiry',      label: 'Student Enquiry',      icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.293-.501-.028-.771.234-.988.218-.19.48-.494.679-.685.198-.19.277-.348.405-.57.131-.225.067-.421-.02-.571-.088-.15-.738-1.77-1.013-2.445-.267-.645-.54-.561-.739-.57 -.192 -.009 -.405 -.012 -.607 -.012 -.2 0 -.527 .075 -.803 .37１ -.2７７ .２９７ -１．０５６ １．０２ -１．０５６ ２．５２ ０ １．５ １．０９５ ２．９４ １．２４８ ３．１４２ .１５３ .１９９ ２．１４３ ３．２５３ ５．２１９ ４．５６ .７３ .３１２ １．３ .５ １．７４３ .６４５ .７３２ .２３１ １．３９８ .１９７ １．９２５ .１２ .５８７ -.０８８ １．７６７ -.７２ ２．０１６ -１．４１３ .２５ -.６９ .２５ -１．２８１ .１７５ -１．４０７ -.０７４ -.₁₂４ -.₂７₂ -.₁₉₇ -.₅₇₁ -.₃₄₇z' },

  ],
  student: [
    { key: 'myinfo',      label: 'My Info',     icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { key: 'profile',      label: 'My Profile',     icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { key: 'applications', label: 'My Applications', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
};

export const storage = {
  get token()   { return localStorage.getItem('crm_access_token') || ''; },
  set token(v)  { localStorage.setItem('crm_access_token', v || ''); },
  get refresh() { return localStorage.getItem('crm_refresh_token') || ''; },
  set refresh(v){ localStorage.setItem('crm_refresh_token', v || ''); },
  get role()    { return localStorage.getItem('crm_role') || ''; },
  set role(v)   { localStorage.setItem('crm_role', v || ''); },
  get name()    { return localStorage.getItem('crm_full_name') || ''; },
  set name(v)   { localStorage.setItem('crm_full_name', v || ''); },
  clear() { ['crm_access_token','crm_refresh_token','crm_role','crm_full_name'].forEach(k => localStorage.removeItem(k)); },
};

export function formatLabel(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function formatDate(value) {
  if (!value) return '—';

  try {
    const date = new Date(value);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return value;
  }
}

export function formatDateTime(value) {
  if (!value) return '—';

  try {
    const date = new Date(value);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return value;
  }
}

export function formatCurrency(amount, currency = 'INR') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount));
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !(options.body instanceof URLSearchParams)) { headers.set('Content-Type', 'application/json'); }
  if (storage.token) headers.set('Authorization', `Bearer ${storage.token}`);

  let response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && storage.refresh) {
    const rr = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: storage.refresh }),
    });
    if (rr.ok) {
      const rd = await rr.json();
      storage.token = rd.access_token; storage.refresh = rd.refresh_token;
      storage.role = rd.role; storage.name = rd.full_name;
      headers.set('Authorization', `Bearer ${storage.token}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } else {
      storage.clear(); window.location.reload();
      throw new Error('Session expired. Please login again.');
    }
  }

  if (response.status === 204) return null;
  const ct = response.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = typeof data === 'object' && data?.detail ? data.detail : 'Request failed';
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}
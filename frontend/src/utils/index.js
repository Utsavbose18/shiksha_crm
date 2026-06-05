export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
export const USER_ROLES = ['platform_super_admin','admin','counsellor'];


export const NAV_BY_ROLE = {
  platform_super_admin: [
    { key: 'platform_ops',        label: 'Platform Ops',         icon: 'M3 13h4v8H3v-8zm7-10h4v18h-4V3zm7 6h4v12h-4V9z' },
    { key: 'tenants',              label: 'Tenants',              icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { key: 'users',                label: 'All Users',            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { key: 'profile',              label: 'Profile',              icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ],
  admin: [
    { key: 'dashboard',            label: 'CRM Dashboard',        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { key: 'students',             label: 'Students',             icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { key: 'applications',         label: 'Applications',         icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'universities',         label: 'Universities',         icon: 'M12 3L3 8l9 5 9-5-9-5zM5 11v5c0 2 3.5 4 7 4s7-2 7-4v-5' },
    { key: 'finance',              label: 'Finance',              icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { key: 'users',                label: 'Team Members',         icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { key: 'additional_settings',  label: 'CRM Settings',         icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { key: 'profile',              label: 'Profile',              icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ],
  counsellor: [
    { key: 'dashboard',    label: 'Dashboard',    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { key: 'students',     label: 'Students',     icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { key: 'applications', label: 'Applications', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'universities', label: 'Universities', icon: 'M12 3L3 8l9 5 9-5-9-5zM5 11v5c0 2 3.5 4 7 4s7-2 7-4v-5' },
    { key: 'finance',      label: 'Finance',      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { key: 'profile',      label: 'Profile',      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ],
};


export const storage = {
  get token()   { return sessionStorage.getItem('crm_impersonate_token') || localStorage.getItem('crm_access_token') || ''; },
  set token(v)  { localStorage.setItem('crm_access_token', v || ''); },
  get refresh() { return localStorage.getItem('crm_refresh_token') || ''; },
  set refresh(v){ localStorage.setItem('crm_refresh_token', v || ''); },
  get role()    { return localStorage.getItem('crm_role') || ''; },
  set role(v)   { localStorage.setItem('crm_role', v || ''); },
  get name()    { return localStorage.getItem('crm_full_name') || ''; },
  set name(v)   { localStorage.setItem('crm_full_name', v || ''); },
  get tenantId(){ return localStorage.getItem('crm_tenant_id') || ''; },
  set tenantId(v){ v ? localStorage.setItem('crm_tenant_id', String(v)) : localStorage.removeItem('crm_tenant_id'); },
  clear() {
      ['crm_access_token','crm_refresh_token','crm_role','crm_full_name','crm_tenant_id'].forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('crm_impersonate_token');
      sessionStorage.removeItem('crm_impersonate_name');
  },
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
  const { rawResponse = false, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  const isFormData = fetchOptions.body instanceof FormData;
  if (!isFormData && !(fetchOptions.body instanceof URLSearchParams)) { headers.set('Content-Type', 'application/json'); }
  if (storage.token) headers.set('Authorization', `Bearer ${storage.token}`);

  let response = await fetch(`${API_BASE_URL}${path}`, { ...fetchOptions, headers });

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
      storage.tenantId = rd.tenant_id;
      headers.set('Authorization', `Bearer ${storage.token}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...fetchOptions, headers });
    } else {
      storage.clear(); window.location.reload();
      throw new Error('Session expired. Please login again.');
    }
  }

  if (rawResponse) {
    if (!response.ok) {
      const ct = response.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await response.json() : await response.text();
      const detail = typeof data === 'object' && data?.detail ? data.detail : 'Request failed';
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return response;
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
export const api = {
  login: async (credentials) => {
    const params = new URLSearchParams();
    params.append('username', credentials.username || credentials.email || '');
    params.append('password', credentials.password);
    if (credentials.client_id) {
        params.append('client_id', credentials.client_id);
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Login failed');
    }
    return response.json();
  }
};

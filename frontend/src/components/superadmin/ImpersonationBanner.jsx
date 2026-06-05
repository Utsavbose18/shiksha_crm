import { useEffect, useMemo, useState } from 'react';
import { apiFetch, storage } from '../../utils';

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function formatCountdown(seconds) {
  if (seconds <= 0) return 'expired';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export default function ImpersonationBanner() {
  const token = storage.token;
  const payload = useMemo(() => decodeJwt(token), [token]);
  const [remaining, setRemaining] = useState(() => {
    if (!payload?.exp) return 0;
    return Math.max(0, Math.floor(payload.exp - Date.now() / 1000));
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!payload?.impersonated_by || !payload?.exp) return undefined;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.floor(payload.exp - Date.now() / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [payload?.impersonated_by, payload?.exp]);

  if (!payload?.impersonated_by) return null;

  function restoreSuperadminSession() {
    const backupToken = localStorage.getItem('superadmin_token_backup');
    const backupRole = localStorage.getItem('superadmin_role_backup') || 'platform_super_admin';
    const backupName = localStorage.getItem('superadmin_name_backup') || 'Super Admin';
    const backupTenant = localStorage.getItem('superadmin_tenant_backup') || '';

    if (backupToken) localStorage.setItem('crm_access_token', backupToken);
    localStorage.setItem('crm_role', backupRole);
    localStorage.setItem('crm_full_name', backupName);
    if (backupTenant) localStorage.setItem('crm_tenant_id', backupTenant);
    else localStorage.removeItem('crm_tenant_id');

    ['superadmin_token_backup', 'superadmin_role_backup', 'superadmin_name_backup', 'superadmin_tenant_backup'].forEach(key => {
      localStorage.removeItem(key);
    });
    sessionStorage.removeItem('crm_impersonate_token');
    sessionStorage.removeItem('crm_impersonate_name');
  }

  async function stopImpersonation() {
    setError('');
    try {
      await apiFetch('/api/superadmin/impersonate/stop', { method: 'POST' });
    } catch (err) {
      setError(err.message || 'Stop impersonation failed');
    } finally {
      restoreSuperadminSession();
      window.location.reload();
    }
  }

  const targetEmail = payload.impersonated_email || sessionStorage.getItem('crm_impersonate_name') || 'tenant user';

  return (
    <div className="impersonation-banner">
      <div>
        <strong>Impersonation Mode</strong>
        <span>You are acting as {targetEmail}. Session expires in {formatCountdown(remaining)}.</span>
        {error && <em>{error}</em>}
      </div>
      <button type="button" onClick={stopImpersonation} aria-label="Stop impersonation">
        Stop Impersonation
      </button>
    </div>
  );
}

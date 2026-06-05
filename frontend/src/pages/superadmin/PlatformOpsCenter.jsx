import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils';
import PlatformAlerts from '../../components/superadmin/PlatformAlerts';
import TenantDetailPanel from '../../components/superadmin/TenantDetailPanel';
import TenantHealthTable from '../../components/superadmin/TenantHealthTable';

export default function PlatformOpsCenter() {
  const [tenants, setTenants] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => new Set());
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [alertLoading, setAlertLoading] = useState(true);
  const [tenantError, setTenantError] = useState('');
  const [alertError, setAlertError] = useState('');

  useEffect(() => {
    loadTenants();
    loadAlerts();
  }, []);

  async function loadTenants() {
    setTenantLoading(true);
    setTenantError('');
    try {
      setTenants(await apiFetch('/api/superadmin/tenants'));
    } catch (err) {
      setTenantError(err.message || 'Failed to load tenants');
    } finally {
      setTenantLoading(false);
    }
  }

  async function loadAlerts() {
    setAlertLoading(true);
    setAlertError('');
    try {
      setAlerts(await apiFetch('/api/superadmin/alerts'));
    } catch (err) {
      setAlertError(err.message || 'Failed to load alerts');
    } finally {
      setAlertLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.allSettled([loadTenants(), loadAlerts()]);
  }

  return (
    <div className="platform-ops-root">
      <div className="platform-ops-head">
        <div>
          <h1>Platform Operations Center</h1>
          <p>Monitor tenant health, onboarding, access, usage limits, and support sessions.</p>
        </div>
        <button type="button" className="btn-primary" onClick={refreshAll}>
          Refresh
        </button>
      </div>

      <PlatformAlerts
        alerts={alerts}
        loading={alertLoading}
        error={alertError}
        dismissedIds={dismissedAlerts}
        onRetry={loadAlerts}
        onOpenTenant={setSelectedTenantId}
        onDismiss={(alertId) => {
          setDismissedAlerts(prev => {
            const next = new Set(prev);
            next.add(alertId);
            return next;
          });
        }}
      />

      <TenantHealthTable
        tenants={tenants}
        loading={tenantLoading}
        error={tenantError}
        onRetry={loadTenants}
        onRefresh={refreshAll}
        onOpenTenant={setSelectedTenantId}
      />

      {selectedTenantId && (
        <TenantDetailPanel
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onRefresh={refreshAll}
        />
      )}
    </div>
  );
}

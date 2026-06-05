import { useState } from 'react';
import { formatDateTime } from '../../utils';

export default function PlatformAlerts({
  alerts = [],
  loading = false,
  error = '',
  dismissedIds,
  onDismiss,
  onRetry,
  onOpenTenant,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const visibleAlerts = alerts.filter(alert => !dismissedIds?.has(alert.alert_id));

  if (loading) {
    return (
      <section className="platform-alerts is-loading">
        <div className="platform-alerts-head">
          <span className="ops-skeleton w-36" />
          <span className="ops-skeleton w-20" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="platform-alerts">
        <div className="platform-alerts-head">
          <div>
            <h3>Platform Alerts</h3>
            <p>{error}</p>
          </div>
          <button type="button" className="btn-outline" onClick={onRetry}>Retry</button>
        </div>
      </section>
    );
  }

  if (!visibleAlerts.length) {
    return (
      <section className="platform-alerts is-healthy">
        <span className="severity-dot info" />
        <div>
          <h3>All systems healthy</h3>
          <p>No active tenant alerts right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="platform-alerts">
      <div className="platform-alerts-head">
        <div>
          <h3>Platform Alerts</h3>
          <p>{visibleAlerts.length} issue{visibleAlerts.length === 1 ? '' : 's'} need attention</p>
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={() => setCollapsed(current => !current)}
          aria-label={collapsed ? 'Expand platform alerts' : 'Collapse platform alerts'}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="platform-alert-list">
          {visibleAlerts.map(alert => (
            <div key={alert.alert_id} className={`platform-alert-row severity-${alert.severity}`}>
              <span className={`severity-dot ${alert.severity}`} aria-hidden="true" />
              <button
                type="button"
                className="platform-alert-main"
                onClick={() => alert.tenant_id && onOpenTenant?.(alert.tenant_id)}
                aria-label={`Open tenant alert ${alert.title}`}
              >
                <strong>{alert.title}</strong>
                <span>{alert.tenant_name || 'Platform'} · {alert.detail}</span>
              </button>
              <time>{formatDateTime(alert.created_at)}</time>
              <button
                type="button"
                className="tenant-icon-btn"
                onClick={() => onDismiss?.(alert.alert_id)}
                aria-label="Dismiss alert"
                title="Dismiss alert"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

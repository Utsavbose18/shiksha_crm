import { useState } from 'react';
import { apiFetch } from '../../utils';

const EXPORT_TYPES = [
  { key: 'students', label: 'Export Students CSV' },
  { key: 'users', label: 'Export Users CSV' },
  { key: 'applications', label: 'Export Applications CSV' },
];

export default function ExportButtons({ tenantId, tenantSlug }) {
  const [loadingType, setLoadingType] = useState('');
  const [error, setError] = useState('');

  async function handleExport(type) {
    setLoadingType(type);
    setError('');
    try {
      const response = await apiFetch(`/api/superadmin/tenants/${tenantId}/export/${type}`, {
        rawResponse: true,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tenantSlug || 'tenant'}_${type}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setLoadingType('');
    }
  }

  return (
    <div className="ops-export-block">
      <div className="ops-export-buttons">
        {EXPORT_TYPES.map(item => (
          <button
            key={item.key}
            type="button"
            className="btn-outline"
            onClick={() => handleExport(item.key)}
            disabled={loadingType === item.key}
            aria-label={item.label}
          >
            {loadingType === item.key ? 'Preparing...' : item.label}
          </button>
        ))}
      </div>
      {error && <p className="ops-inline-error">{error}</p>}
    </div>
  );
}

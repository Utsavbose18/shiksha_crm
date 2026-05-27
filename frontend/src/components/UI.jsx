import { STATUS_STYLES, formatLabel } from '../utils';

export function Badge({ value }) {
  const tone = STATUS_STYLES[String(value || '').toLowerCase()] || 'soft';
  return <span className={`badge badge-${tone}`}>{formatLabel(value)}</span>;
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && <button className="btn-primary" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

export function StatCard({ label, value, helper, color }) {
  return (
    <div className={`stat-card ${color || ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {helper && <small className="stat-helper">{helper}</small>}
    </div>
  );
}

export function SectionCard({ title, subtitle, actions, children, noPad }) {
  return (
    <section className="section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      <div className={noPad ? '' : 'section-body'}>{children}</div>
    </section>
  );
}

export function TextInput({ label, ...props }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="field-input" {...props} />
    </label>
  );
}

export function SelectInput({ label, options, ...props }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="field-select" {...props}>
        <option value="">Select</option>
        {options.map(o => <option key={o} value={o}>{formatLabel(o)}</option>)}
      </select>
    </label>
  );
}

export function TextArea({ label, ...props }) {
  return (
    <label className="field field-full">
      <span className="field-label">{label}</span>
      <textarea className="field-textarea" {...props} />
    </label>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function NavIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
import React from 'react';

export function Panel({ title, icon, actions, children, className = '', flush = false }) {
  return (
    <section className={`card border rounded-2 shadow-sm mb-3 bg-white ${className}`}>
      {(title || actions) && (
        <div className="card-header bg-white border-bottom py-3 px-3.5 d-flex justify-content-between align-items-center">
          <h2 className="card-title h6 mb-0 fw-semibold text-dark d-flex align-items-center gap-2">
            {icon && <i className={`fa-solid ${icon} text-muted`} aria-hidden="true" />}
            <span>{title}</span>
          </h2>
          {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'p-0' : 'card-body p-3.5'}>{children}</div>
    </section>
  );
}

export default Panel;

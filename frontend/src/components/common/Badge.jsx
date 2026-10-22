import React from 'react';

const TONES = {
  primary: 'bg-primary-subtle text-primary border-primary-subtle',
  secondary: 'bg-secondary-subtle text-secondary border-secondary-subtle',
  success: 'badge-ok',
  ok: 'badge-ok',
  warning: 'badge-warn',
  warn: 'badge-warn',
  danger: 'badge-danger',
  info: 'badge-info',
  muted: 'bg-light text-muted border',
};

export function Badge({ tone = 'muted', children, className = '' }) {
  const toneClass = TONES[tone] || TONES.muted;
  return (
    <span
      className={`badge fw-medium px-2 py-1 rounded-1 ${toneClass} ${className}`}
      style={{ fontSize: '0.78rem' }}
    >
      {children}
    </span>
  );
}

export default Badge;

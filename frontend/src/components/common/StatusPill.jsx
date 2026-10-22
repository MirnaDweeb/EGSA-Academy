import React from 'react';
import styles from './StatusPill.module.css';

export default function StatusPill({ status, className = '' }) {
  const norm = (status || '').trim();

  let variantClass = styles.defaultPill;
  let icon = 'fa-circle-dot';

  if (['Eligible', 'Accepted', 'Confirmed', 'Enrolled'].includes(norm)) {
    variantClass = styles.eligible;
    icon = 'fa-circle-check';
  } else if (['Foundation Required', 'Foundation Recommended'].includes(norm)) {
    variantClass = styles.foundation;
    icon = 'fa-triangle-exclamation';
  } else if (['Manual Review', 'Under Review', 'Needs Information', 'In Progress', 'Submitted'].includes(norm)) {
    variantClass = styles.manualReview;
    icon = 'fa-clock-rotate-left';
  } else if (['Rejected', 'Cancelled', 'Not Eligible'].includes(norm)) {
    variantClass = styles.rejected;
    icon = 'fa-circle-xmark';
  } else if (norm === 'Waitlisted') {
    variantClass = styles.waitlisted;
    icon = 'fa-hourglass-half';
  }

  return (
    <span className={`${styles.pill} ${variantClass} ${className}`}>
      <i className={`fa-solid ${icon}`}></i>
      <span>{norm || 'Unknown'}</span>
    </span>
  );
}

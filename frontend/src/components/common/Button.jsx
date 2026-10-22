import React from 'react';
import { Button as BsButton, Spinner } from 'react-bootstrap';

export function Button({
  variant = 'primary',
  size,
  loading = false,
  disabled = false,
  icon,
  children,
  className = '',
  ...props
}) {
  return (
    <BsButton
      variant={variant}
      size={size}
      disabled={disabled || loading}
      className={`d-inline-flex align-items-center justify-content-center gap-1.5 ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size="sm" animation="border" className="me-1" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
          <span>{children}</span>
        </>
      )}
    </BsButton>
  );
}

export default Button;

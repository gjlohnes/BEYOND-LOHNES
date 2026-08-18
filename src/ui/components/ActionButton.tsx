import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  busyLabel?: string;
  variant?: Variant;
  children: ReactNode;
}

export function ActionButton({
  busy = false,
  busyLabel = 'WORKING…',
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      className={`action-button action-button--${variant} ${className}`.trim()}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <>
          <span className="action-button__indicator" aria-hidden="true" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

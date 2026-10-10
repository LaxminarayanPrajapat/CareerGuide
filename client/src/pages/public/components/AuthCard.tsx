import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../../components/layout/PublicLayout';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-14 sm:px-6">
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-navy-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </PublicLayout>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="help-text">{hint}</p>
      )}
    </div>
  );
}

/** Maps a Zod-style API error list onto form fields. */
export function fieldErrors(
  errors: Array<{ field: string; message: string }> | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const error of errors ?? []) {
    if (!map[error.field]) map[error.field] = error.message;
  }
  return map;
}

export function AuthFooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-accent-700 hover:underline">
      {children}
    </Link>
  );
}

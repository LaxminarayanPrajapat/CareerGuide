import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, KeyRound, Loader2 } from 'lucide-react';
import { AuthCard, Field, fieldErrors } from './components/AuthCard';
import { ErrorState } from '../../components/common';
import { useToast } from '../../components/common/ToastProvider';
import { api, ApiClientError } from '../../lib/api';

function passwordChecklist(password: string) {
  return [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'A digit', ok: /[0-9]/.test(password) },
    { label: 'A special character', ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checklist = useMemo(() => passwordChecklist(password), [password]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    if (!checklist.every((rule) => rule.ok)) {
      setErrors({ password: 'Your new password does not meet all the requirements below.' });
      return;
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password, confirmPassword });
      toast.success('Password reset. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        const mapped = fieldErrors(error.errors);
        if (Object.keys(mapped).length > 0) setErrors(mapped);
        else setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Reset links expire after 30 minutes and can only be used once."
      footer={
        <Link to="/login" className="font-medium text-accent-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {!token ? (
        <ErrorState message="This reset link is incomplete. Request a new link from the forgot-password page." />
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <ErrorState message={formError} />}

          <Field id="password" label="New password" error={errors.password}>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby="password-rules"
              required
            />
          </Field>

          <ul id="password-rules" className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {checklist.map((rule) => (
              <li
                key={rule.label}
                className={`flex items-center gap-1.5 text-xs ${rule.ok ? 'text-emerald-700' : 'text-slate-500'}`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                    rule.ok ? 'bg-emerald-100' : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                >
                  {rule.ok && <Check className="h-2.5 w-2.5 text-emerald-700" />}
                </span>
                {rule.label}
              </li>
            ))}
          </ul>

          <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword}>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              required
            />
          </Field>

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Resetting...
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" aria-hidden="true" /> Reset password
              </>
            )}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

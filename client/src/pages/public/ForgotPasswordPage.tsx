import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Info, Loader2, Mail } from 'lucide-react';
import { AuthCard, Field, fieldErrors } from './components/AuthCard';
import { ErrorState } from '../../components/common';
import { api, ApiClientError } from '../../lib/api';

interface ForgotResponse {
  message: string;
  mailEnabled: boolean;
  developmentResetToken?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<ForgotResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setErrors({});
    setResult(null);

    if (!email.trim()) {
      setErrors({ email: 'Enter your email address.' });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<ForgotResponse>('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setResult(data);
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
      title="Reset your password"
      subtitle="Enter the email address linked to your account."
      footer={
        <Link to="/login" className="font-medium text-accent-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{result.message}</p>
          </div>

          {result.developmentResetToken ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Mail delivery is disabled on this deployment</p>
              <p className="mt-1 leading-relaxed">
                No email was actually sent. On a development setup the reset token is shown below so the workflow can
                be demonstrated end to end.
              </p>
              <Link
                to={`/reset-password?token=${encodeURIComponent(result.developmentResetToken)}`}
                className="btn btn-sm btn-primary mt-3"
              >
                Continue to reset password
              </Link>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              If an account exists for that address, a reset link will arrive by email. The link expires after 30
              minutes.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <ErrorState message={formError} />}

          <Field id="email" label="Email address" error={errors.email}>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              required
            />
          </Field>

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" aria-hidden="true" /> Send reset link
              </>
            )}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

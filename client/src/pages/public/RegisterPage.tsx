import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import { ApiClientError } from '../../lib/api';
import { AuthCard, Field, fieldErrors } from './components/AuthCard';
import { ErrorState } from '../../components/common';

/** Live feedback only. The server re-validates every password rule. */
function passwordChecklist(password: string) {
  return [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'A digit', ok: /[0-9]/.test(password) },
    { label: 'A special character', ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    institution: '',
    department: '',
    yearOfStudy: '',
    batch: '',
    rollNumber: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checklist = useMemo(() => passwordChecklist(form.password), [form.password]);
  const passwordValid = checklist.every((item) => item.ok);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const local: Record<string, string> = {};
    if (form.fullName.trim().length < 2) local.fullName = 'Enter your full name.';
    if (!form.email.trim()) local.email = 'Enter your email address.';
    if (!passwordValid) local.password = 'Your password does not meet all the requirements below.';
    if (form.password !== form.confirmPassword) local.confirmPassword = 'Passwords do not match.';
    if (!form.acceptTerms) local.acceptTerms = 'You must accept the AI advice disclaimer to register.';
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        institution: form.institution.trim() || undefined,
        department: form.department.trim() || undefined,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : undefined,
        batch: form.batch.trim() || undefined,
        rollNumber: form.rollNumber.trim() || undefined,
        acceptTerms: true,
      });
      toast.success('Account created. Welcome to AI Career Guide.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        const mapped = fieldErrors(error.errors);
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your candidate account"
      subtitle="Your assessments, scores and reports are stored against this account."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-accent-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <ErrorState message={formError} />}

        <Field id="fullName" label="Full name" error={errors.fullName}>
          <input
            id="fullName"
            className="input"
            value={form.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            required
          />
        </Field>

        <Field id="email" label="Email address" error={errors.email}>
          <input
            id="email"
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            required
          />
        </Field>

        <Field id="password" label="Password" error={errors.password}>
          <input
            id="password"
            type="password"
            className="input"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
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
              className={`flex items-center gap-1.5 text-xs ${
                rule.ok ? 'text-emerald-700' : 'text-slate-500'
              }`}
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

        <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
          <input
            id="confirmPassword"
            type="password"
            className="input"
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            required
          />
        </Field>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Academic details (optional - improves batch analytics)
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="institution" label="Institution">
              <input
                id="institution"
                className="input"
                value={form.institution}
                onChange={(e) => update('institution', e.target.value)}
              />
            </Field>
            <Field id="department" label="Department">
              <input
                id="department"
                className="input"
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
              />
            </Field>
            <Field id="yearOfStudy" label="Year of study">
              <input
                id="yearOfStudy"
                type="number"
                min={1}
                max={10}
                className="input"
                value={form.yearOfStudy}
                onChange={(e) => update('yearOfStudy', e.target.value)}
              />
            </Field>
            <Field id="batch" label="Batch">
              <input
                id="batch"
                className="input"
                value={form.batch}
                onChange={(e) => update('batch', e.target.value)}
              />
            </Field>
            <Field id="rollNumber" label="Roll number">
              <input
                id="rollNumber"
                className="input"
                value={form.rollNumber}
                onChange={(e) => update('rollNumber', e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
              checked={form.acceptTerms}
              onChange={(e) => update('acceptTerms', e.target.checked)}
              aria-invalid={Boolean(errors.acceptTerms)}
            />
            <span>
              I understand that career recommendations are indicative guidance, not a psychological assessment or a
              prediction of career success.
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="error-text" role="alert">
              {errors.acceptTerms}
            </p>
          )}
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Creating account...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Create account
            </>
          )}
        </button>

        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            New accounts are created with the candidate role. Staff accounts must be created by an administrator.
          </span>
        </p>
      </form>
    </AuthCard>
  );
}

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, KeyRound, Loader2, Save, User } from 'lucide-react';
import { api, ApiClientError } from '../../lib/api';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, ErrorState, ProgressBar } from '../../components/common';
import { Field, fieldErrors } from '../public/components/AuthCard';
import { formatDateTime, roleLabel } from '../../lib/format';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    institution: '',
    department: '',
    yearOfStudy: '',
    batch: '',
    rollNumber: '',
    graduationYear: '',
    objective: '',
    portfolioUrl: '',
    linkedinUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    const profile = user.studentProfile ?? {};
    setForm({
      fullName: user.fullName ?? '',
      phone: user.phone ?? '',
      institution: profile.institution ?? '',
      department: profile.department ?? '',
      yearOfStudy: profile.yearOfStudy ? String(profile.yearOfStudy) : '',
      batch: profile.batch ?? '',
      rollNumber: profile.rollNumber ?? '',
      graduationYear: profile.graduationYear ? String(profile.graduationYear) : '',
      objective: profile.objective ?? '',
      portfolioUrl: profile.portfolioUrl ?? '',
      linkedinUrl: profile.linkedinUrl ?? '',
    });
  }, [user]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setErrors({});
    setSaving(true);
    try {
      await api.patch('/profile', {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        studentProfile: {
          institution: form.institution.trim() || undefined,
          department: form.department.trim() || undefined,
          yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : undefined,
          batch: form.batch.trim() || undefined,
          rollNumber: form.rollNumber.trim() || undefined,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
          objective: form.objective.trim() || undefined,
          portfolioUrl: form.portfolioUrl.trim() || undefined,
          linkedinUrl: form.linkedinUrl.trim() || undefined,
        },
      });
      await refresh();
      toast.success('Profile updated.');
    } catch (err) {
      if (err instanceof ApiClientError) {
        const mapped = fieldErrors(err.errors);
        if (Object.keys(mapped).length > 0) setErrors(mapped);
        else setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordErrors({});

    if (!passwordForm.currentPassword) {
      setPasswordErrors({ currentPassword: 'Enter your current password.' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed. Other sessions have been signed out.');
    } catch (err) {
      if (err instanceof ApiClientError) {
        const mapped = fieldErrors(err.errors);
        if (Object.keys(mapped).length > 0) setPasswordErrors(mapped);
        else setPasswordError(err.message);
      } else {
        setPasswordError('Something went wrong. Please try again.');
      }
    } finally {
      setChangingPassword(false);
    }
  }

  if (!user) return null;
  const completion = user.studentProfile?.completionPercent ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Profile &amp; settings</h1>
        <p className="mt-1 text-sm text-slate-600">Keep your details current so your counsellor can support you.</p>
      </header>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-navy-900">{user.fullName}</h2>
              <Badge tone="info">{roleLabel(user.role)}</Badge>
              {!user.isActive && <Badge tone="danger">Deactivated</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
            <p className="mt-0.5 text-xs text-slate-400">Last signed in {formatDateTime(user.lastLoginAt)}</p>
          </div>
          <div className="w-full max-w-xs">
            <ProgressBar value={completion} label="Profile completion" />
          </div>
        </div>
      </Card>

      <Card title="Personal details">
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          {formError && <ErrorState message={formError} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fullName" label="Full name" error={errors.fullName}>
              <input
                id="fullName"
                className="input"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </Field>
            <Field id="phone" label="Phone (optional)" error={errors.phone}>
              <input
                id="phone"
                className="input"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="institution" label="Institution" error={errors.institution}>
              <input
                id="institution"
                className="input"
                value={form.institution}
                onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              />
            </Field>
            <Field id="department" label="Department" error={errors.department}>
              <input
                id="department"
                className="input"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              />
            </Field>
            <Field id="yearOfStudy" label="Year of study" error={errors.yearOfStudy}>
              <input
                id="yearOfStudy"
                type="number"
                min={1}
                max={10}
                className="input"
                value={form.yearOfStudy}
                onChange={(e) => setForm((f) => ({ ...f, yearOfStudy: e.target.value }))}
              />
            </Field>
            <Field id="graduationYear" label="Expected graduation year" error={errors.graduationYear}>
              <input
                id="graduationYear"
                type="number"
                min={1950}
                max={2100}
                className="input"
                value={form.graduationYear}
                onChange={(e) => setForm((f) => ({ ...f, graduationYear: e.target.value }))}
              />
            </Field>
            <Field id="batch" label="Batch" error={errors.batch}>
              <input
                id="batch"
                className="input"
                value={form.batch}
                onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))}
              />
            </Field>
            <Field id="rollNumber" label="Roll number" error={errors.rollNumber}>
              <input
                id="rollNumber"
                className="input"
                value={form.rollNumber}
                onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
              />
            </Field>
          </div>

          <Field
            id="objective"
            label="Career objective"
            hint="A sentence about what you want to do helps your counsellor support you."
            error={errors.objective}
          >
            <textarea
              id="objective"
              rows={3}
              className="input"
              value={form.objective}
              onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="portfolioUrl" label="Portfolio URL" error={errors.portfolioUrl}>
              <input
                id="portfolioUrl"
                type="url"
                className="input"
                placeholder="https://"
                value={form.portfolioUrl}
                onChange={(e) => setForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
              />
            </Field>
            <Field id="linkedinUrl" label="LinkedIn URL" error={errors.linkedinUrl}>
              <input
                id="linkedinUrl"
                type="url"
                className="input"
                placeholder="https://"
                value={form.linkedinUrl}
                onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden="true" /> Save profile
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Change password" description="Changing your password signs out all other sessions">
        <form onSubmit={changePassword} className="space-y-4" noValidate>
          {passwordError && <ErrorState message={passwordError} />}

          <Field id="currentPassword" label="Current password" error={passwordErrors.currentPassword}>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              className="input"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="newPassword"
              label="New password"
              hint="8+ characters with upper, lower, digit and special character."
              error={passwordErrors.newPassword}
            >
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className="input"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
            </Field>
            <Field id="confirmPassword" label="Confirm new password" error={passwordErrors.confirmPassword}>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="input"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-secondary" disabled={changingPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Updating...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" aria-hidden="true" /> Change password
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Your permissions" description="Enforced by the API on every request, not just in this interface">
        <div className="flex flex-wrap gap-1.5">
          {user.permissions.map((permission: string) => (
            <Badge key={permission} tone="neutral">
              {permission}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-slate-600">
            Your assessment responses, scores and reports are personal records. They are visible to you and to the
            counsellor assigned to you, and are never included in management reporting.
          </p>
        </div>
        {user.mustChangePassword && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            An administrator has asked you to change your password. Please set a new one above.
          </div>
        )}
      </Card>
    </div>
  );
}

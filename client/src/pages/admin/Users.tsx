import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, ShieldOff, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { api, ApiClientError } from '../../lib/api';
import type { Role, User } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../../components/common';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Pagination, SearchFilters, FilterSelect } from '../../components/common/Pagination';
import { Field, fieldErrors } from '../public/components/AuthCard';
import { formatDateTime, roleLabel } from '../../lib/format';

export default function UsersPage() {
  const { user: currentUser, hasPermission, refresh } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<User[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'student' as Role,
    institution: '',
    department: '',
    batch: '',
    yearOfStudy: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<{ user: User; activate: boolean } | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{ users: User[] }>('/users', {
        page,
        limit: 15,
        search: search || undefined,
        role: roleFilter || undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'active',
      });
      setUsers(data.users);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreateErrors({});
    setCreating(true);
    try {
      await api.post('/users', {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        mustChangePassword: true,
        studentProfile: {
          institution: createForm.institution.trim() || undefined,
          department: createForm.department.trim() || undefined,
          batch: createForm.batch.trim() || undefined,
          yearOfStudy: createForm.yearOfStudy ? Number(createForm.yearOfStudy) : undefined,
        },
      });
      toast.success(`Account created for ${createForm.email}.`);
      setShowCreate(false);
      setCreateForm({
        fullName: '',
        email: '',
        password: '',
        role: 'student',
        institution: '',
        department: '',
        batch: '',
        yearOfStudy: '',
      });
      await load();
      await refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const mapped = fieldErrors(err.errors);
        if (Object.keys(mapped).length > 0) setCreateErrors(mapped);
        else setCreateError(err.message);
      } else {
        setCreateError('Something went wrong. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus() {
    if (!statusTarget) return;
    setTogglingStatus(true);
    try {
      await api.patch(`/users/${statusTarget.user.id}/status`, {
        isActive: statusTarget.activate,
        reason: statusTarget.activate ? 'Reactivated by administrator' : 'Deactivated by administrator',
      });
      toast.success(statusTarget.activate ? 'Account activated.' : 'Account deactivated.');
      setStatusTarget(null);
      await load();
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTogglingStatus(false);
    }
  }

  async function changeRole(target: User, role: Role) {
    try {
      await api.patch(`/users/${target.id}`, { role });
      toast.success(`${target.fullName} is now a ${roleLabel(role).toLowerCase()}.`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">User management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create accounts, assign roles and control account status. Passwords are stored only as bcrypt hashes.
          </p>
        </div>
        {hasPermission('users:write') && (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> New account
          </button>
        )}
      </header>

      {showCreate && (
        <Card title="Create a new account">
          <form onSubmit={createUser} className="space-y-4" noValidate>
            {createError && <ErrorState message={createError} />}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="new-fullName" label="Full name" error={createErrors.fullName}>
                <input
                  id="new-fullName"
                  className="input"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </Field>
              <Field id="new-email" label="Email address" error={createErrors.email}>
                <input
                  id="new-email"
                  type="email"
                  className="input"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field
                id="new-password"
                label="Temporary password"
                hint="The user is asked to change this on first sign-in."
                error={createErrors.password}
              >
                <input
                  id="new-password"
                  type="text"
                  className="input font-mono"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                />
              </Field>
              <Field id="new-role" label="Role" error={createErrors.role}>
                <select
                  id="new-role"
                  className="input"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role }))}
                >
                  <option value="student">Candidate</option>
                  <option value="counsellor">Counsellor</option>
                  <option value="management">Management</option>
                  <option value="admin">Administrator</option>
                </select>
              </Field>
            </div>

            {createForm.role === 'student' && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field id="new-institution" label="Institution">
                  <input
                    id="new-institution"
                    className="input"
                    value={createForm.institution}
                    onChange={(e) => setCreateForm((f) => ({ ...f, institution: e.target.value }))}
                  />
                </Field>
                <Field id="new-department" label="Department">
                  <input
                    id="new-department"
                    className="input"
                    value={createForm.department}
                    onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))}
                  />
                </Field>
                <Field id="new-batch" label="Batch">
                  <input
                    id="new-batch"
                    className="input"
                    value={createForm.batch}
                    onChange={(e) => setCreateForm((f) => ({ ...f, batch: e.target.value }))}
                  />
                </Field>
                <Field id="new-year" label="Year of study">
                  <input
                    id="new-year"
                    type="number"
                    min={1}
                    max={10}
                    className="input"
                    value={createForm.yearOfStudy}
                    onChange={(e) => setCreateForm((f) => ({ ...f, yearOfStudy: e.target.value }))}
                  />
                </Field>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" aria-hidden="true" /> Create account
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!users && !error && <Skeleton className="h-64 w-full" />}

      {users && (
        <Card bodyClassName="p-0">
          <SearchFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search by name, email or roll number..."
          >
            <FilterSelect
              label="Role"
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All roles' },
                { value: 'admin', label: 'Administrator' },
                { value: 'counsellor', label: 'Counsellor' },
                { value: 'management', label: 'Management' },
                { value: 'student', label: 'Candidate' },
              ]}
            />
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Deactivated' },
              ]}
            />
          </SearchFilters>

          {users.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Users className="h-8 w-8" aria-hidden="true" />}
                title="No users match these filters"
                description="Try a different search term or clear the filters."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Batch</th>
                    <th>Last sign-in</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="font-medium text-navy-900">{row.fullName}</span>
                        {row.mustChangePassword && (
                          <span className="ml-2 text-[11px] text-amber-600">must change password</span>
                        )}
                      </td>
                      <td className="text-slate-600">{row.email}</td>
                      <td>
                        {hasPermission('users:manage-role') && row.id !== currentUser?.id ? (
                          <select
                            className="input w-auto py-1 text-xs"
                            value={row.role}
                            onChange={(e) => void changeRole(row, e.target.value as Role)}
                            aria-label={`Role for ${row.fullName}`}
                          >
                            <option value="student">Candidate</option>
                            <option value="counsellor">Counsellor</option>
                            <option value="management">Management</option>
                            <option value="admin">Administrator</option>
                          </select>
                        ) : (
                          <Badge tone="info">{roleLabel(row.role)}</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{row.studentProfile?.batch ?? '-'}</td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {formatDateTime(row.lastLoginAt)}
                      </td>
                      <td>
                        <Badge tone={row.isActive ? 'success' : 'danger'}>
                          {row.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        {hasPermission('users:manage-status') && row.id !== currentUser?.id ? (
                          <button
                            type="button"
                            className={`btn btn-sm ${row.isActive ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => setStatusTarget({ user: row, activate: !row.isActive })}
                          >
                            {row.isActive ? (
                              <>
                                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" /> Deactivate
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Activate
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {row.id === currentUser?.id ? 'Current account' : 'No permission'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
            label="users"
          />
        </Card>
      )}

      <Card>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Deactivating an account invalidates all of its sessions immediately. Historical assessments, answers and
          reports are preserved. The system refuses to deactivate the last active administrator or any account with an
          attempt currently in progress.
        </p>
      </Card>

      <ConfirmDialog
        open={statusTarget !== null}
        title={statusTarget?.activate ? 'Activate this account?' : 'Deactivate this account?'}
        message={
          statusTarget?.activate ? (
            <p>
              {statusTarget.user.fullName} will be able to sign in again. This is recorded in the audit log.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                {statusTarget?.user.fullName} will be signed out immediately and will not be able to sign in until the
                account is reactivated.
              </p>
              <p className="text-slate-500">
                All existing assessment results and reports are retained. This action is recorded in the audit log.
              </p>
            </div>
          )
        }
        confirmLabel={statusTarget?.activate ? 'Activate account' : 'Deactivate account'}
        tone={statusTarget?.activate ? 'default' : 'danger'}
        busy={togglingStatus}
        onConfirm={toggleStatus}
        onCancel={() => setStatusTarget(null)}
      />

      {showCreate && (
        <button
          type="button"
          onClick={() => setShowCreate(false)}
          className="sr-only"
          aria-label="Close create account form"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

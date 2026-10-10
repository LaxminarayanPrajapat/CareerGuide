import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ClipboardList, Loader2, Send, X } from 'lucide-react';
import { api, ApiClientError } from '../../lib/api';
import type { AssessmentSummary, Question } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Pagination, SearchFilters, FilterSelect } from '../../components/common/Pagination';
import { Field, fieldErrors } from '../public/components/AuthCard';
import { categoryLabel, formatDate, statusLabel } from '../../lib/format';

interface AssessmentForm {
  title: string;
  description: string;
  instructions: string;
  category: string;
  questionPool: string[];
  questionCount: string;
  durationMinutes: string;
  marksPerQuestion: string;
  passingPercentage: string;
  maxAttempts: string;
  status: 'draft' | 'published';
}

const emptyForm = (): AssessmentForm => ({
  title: '',
  description: '',
  instructions: '',
  category: 'aptitude',
  questionPool: [],
  questionCount: '10',
  durationMinutes: '15',
  marksPerQuestion: '1',
  passingPercentage: '40',
  maxAttempts: '2',
  status: 'draft',
});

export default function AssessmentsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 12 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<AssessmentForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [publishTarget, setPublishTarget] = useState<AssessmentSummary | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{ assessments: AssessmentSummary[] }>('/assessments', {
        page,
        limit: 12,
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        includeArchived: true,
      });
      setAssessments(data.assessments);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search, category, status]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  useEffect(() => {
    if (!showCreate) return;
    api
      .get<{ questions: Question[] }>('/questions', { limit: 100, isActive: true })
      .then(({ data }) => setQuestions(data.questions))
      .catch(() => setQuestions([]));
  }, [showCreate]);

  const poolQuestions = questions.filter((q) => q.category === form.category);

  async function createAssessment(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormErrors({});

    if (form.questionPool.length === 0) {
      setFormErrors({ questionPool: 'Select at least one question for the pool.' });
      return;
    }
    if (Number(form.questionCount) > form.questionPool.length) {
      setFormErrors({ questionCount: 'Question count cannot exceed the pool size.' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/assessments', {
        title: form.title.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        category: form.category,
        questionPool: form.questionPool,
        questionCount: Number(form.questionCount),
        durationMinutes: Number(form.durationMinutes),
        marksPerQuestion: Number(form.marksPerQuestion),
        passingPercentage: Number(form.passingPercentage),
        maxAttempts: Number(form.maxAttempts),
        status: form.status,
      });
      toast.success('Assessment created.');
      setShowCreate(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const mapped = fieldErrors(err.errors);
        if (Object.keys(mapped).length > 0) setFormErrors(mapped);
        else setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmPublish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      const next = publishTarget.status === 'published' ? 'archived' : 'published';
      await api.patch(`/assessments/${publishTarget.id}/status`, { status: next });
      toast.success(`Assessment is now ${next}.`);
      setPublishTarget(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
      setPublishTarget(null);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Test sets</h1>
          <p className="mt-1 text-sm text-slate-600">
            Duration, scoring and availability are configured here. Publishing makes a test visible to eligible
            candidates; its timer is enforced by the server.
          </p>
        </div>
        {hasPermission('assessments:write') && (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" /> New test set
          </button>
        )}
      </header>

      {showCreate && (
        <Card
          title="Create a test set"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" aria-hidden="true" /> Close
            </button>
          }
        >
          <form onSubmit={createAssessment} className="space-y-4" noValidate>
            {formError && <ErrorState message={formError} />}

            <Field id="a-title" label="Title" error={formErrors.title}>
              <input
                id="a-title"
                className="input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>

            <Field id="a-description" label="Description" error={formErrors.description}>
              <textarea
                id="a-description"
                rows={2}
                className="input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>

            <Field id="a-instructions" label="Candidate instructions" error={formErrors.instructions}>
              <textarea
                id="a-instructions"
                rows={3}
                className="input"
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="a-category" label="Category" error={formErrors.category}>
                <select
                  id="a-category"
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, questionPool: [] }))}
                >
                  <option value="aptitude">Aptitude</option>
                  <option value="logical_reasoning">Logical Reasoning</option>
                  <option value="technical_knowledge">Technical Knowledge</option>
                  <option value="domain_knowledge">Domain Knowledge</option>
                  <option value="personality">Personality / Working Preferences</option>
                </select>
              </Field>
              <Field id="a-duration" label="Duration (minutes)" error={formErrors.durationMinutes}>
                <input
                  id="a-duration"
                  type="number"
                  min={1}
                  max={600}
                  className="input"
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                />
              </Field>
              <Field id="a-marks" label="Marks per question" error={formErrors.marksPerQuestion}>
                <input
                  id="a-marks"
                  type="number"
                  min={0.1}
                  step={0.5}
                  className="input"
                  value={form.marksPerQuestion}
                  onChange={(e) => setForm((f) => ({ ...f, marksPerQuestion: e.target.value }))}
                />
              </Field>
              <Field id="a-pass" label="Passing percentage" error={formErrors.passingPercentage}>
                <input
                  id="a-pass"
                  type="number"
                  min={0}
                  max={100}
                  className="input"
                  value={form.passingPercentage}
                  onChange={(e) => setForm((f) => ({ ...f, passingPercentage: e.target.value }))}
                />
              </Field>
              <Field id="a-count" label="Questions per attempt" error={formErrors.questionCount}>
                <input
                  id="a-count"
                  type="number"
                  min={1}
                  max={200}
                  className="input"
                  value={form.questionCount}
                  onChange={(e) => setForm((f) => ({ ...f, questionCount: e.target.value }))}
                />
              </Field>
              <Field id="a-attempts" label="Attempt limit" error={formErrors.maxAttempts}>
                <input
                  id="a-attempts"
                  type="number"
                  min={1}
                  max={20}
                  className="input"
                  value={form.maxAttempts}
                  onChange={(e) => setForm((f) => ({ ...f, maxAttempts: e.target.value }))}
                />
              </Field>
              <Field id="a-status" label="Initial status">
                <select
                  id="a-status"
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'draft' | 'published' }))}
                >
                  <option value="draft">Draft (hidden from candidates)</option>
                  <option value="published">Published</option>
                </select>
              </Field>
            </div>

            <div>
              <p className="label">
                Question pool{' '}
                <span className="font-normal text-slate-500">({form.questionPool.length} selected)</span>
              </p>
              {poolQuestions.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  No active questions exist in {categoryLabel(form.category)} yet. Create some in the question bank
                  first.
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {poolQuestions.map((question) => {
                    const selected = form.questionPool.includes(question.id);
                    return (
                      <label
                        key={question.id}
                        className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                          checked={selected}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              questionPool: selected
                                ? f.questionPool.filter((id) => id !== question.id)
                                : [...f.questionPool, question.id],
                            }))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-navy-800">{question.text}</span>
                          <span className="text-xs text-slate-500">
                            {question.topic} &middot; {question.difficulty}
                            {!question.scorable && ' · not scorable'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {formErrors.questionPool && (
                <p className="error-text" role="alert">
                  {formErrors.questionPool}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving...
                  </>
                ) : (
                  'Create test set'
                )}
              </button>
            </div>
          </form>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!assessments && !error && <Skeleton className="h-64 w-full" />}

      {assessments && (
        <Card bodyClassName="p-0">
          <SearchFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search test sets..."
          >
            <FilterSelect
              label="Category"
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All categories' },
                { value: 'aptitude', label: 'Aptitude' },
                { value: 'logical_reasoning', label: 'Logical Reasoning' },
                { value: 'technical_knowledge', label: 'Technical Knowledge' },
                { value: 'domain_knowledge', label: 'Domain Knowledge' },
                { value: 'personality', label: 'Personality' },
              ]}
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </SearchFilters>

          {assessments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
                title="No test sets found"
                description="Create a test set or adjust the filters."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Questions</th>
                    <th>Duration</th>
                    <th>Marks</th>
                    <th>Pass</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((assessment) => (
                    <tr key={assessment.id}>
                      <td>
                        <span className="font-medium text-navy-900">{assessment.title}</span>
                        <p className="mt-0.5 max-w-sm truncate text-xs text-slate-500">{assessment.description}</p>
                        {assessment.availableUntil && (
                          <p className="text-xs text-slate-400">Closes {formatDate(assessment.availableUntil)}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <Badge tone={assessment.category === 'personality' ? 'warning' : 'info'}>
                          {categoryLabel(assessment.category)}
                        </Badge>
                      </td>
                      <td className="tabular-nums">{assessment.questionCount}</td>
                      <td className="whitespace-nowrap tabular-nums">{assessment.durationMinutes} min</td>
                      <td className="tabular-nums">{assessment.totalMarks}</td>
                      <td className="tabular-nums">
                        {assessment.category === 'personality' ? 'n/a' : `${assessment.passingPercentage}%`}
                      </td>
                      <td>
                        <Badge
                          tone={
                            assessment.status === 'published'
                              ? 'success'
                              : assessment.status === 'draft'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {statusLabel(assessment.status)}
                        </Badge>
                      </td>
                      <td className="text-right">
                        {hasPermission('assessments:publish') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setPublishTarget(assessment)}
                          >
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            {assessment.status === 'published' ? 'Archive' : 'Publish'}
                          </button>
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
            label="test sets"
          />
        </Card>
      )}

      <ConfirmDialog
        open={publishTarget !== null}
        title={publishTarget?.status === 'published' ? 'Archive this test set?' : 'Publish this test set?'}
        message={
          publishTarget?.status === 'published' ? (
            <p>
              Archiving hides &ldquo;{publishTarget?.title}&rdquo; from candidates. Existing attempts and results are
              preserved and remain viewable in history.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                &ldquo;{publishTarget?.title}&rdquo; will become visible to eligible candidates immediately.
              </p>
              <p className="text-slate-500">
                The server validates that the question pool contains enough active, scorable questions before
                allowing publication.
              </p>
            </div>
          )
        }
        confirmLabel={publishTarget?.status === 'published' ? 'Archive' : 'Publish'}
        busy={publishing}
        onConfirm={confirmPublish}
        onCancel={() => setPublishTarget(null)}
      />
    </div>
  );
}

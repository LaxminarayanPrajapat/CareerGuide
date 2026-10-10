import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Database, Loader2, Plus, Trash2, X } from 'lucide-react';
import { api, ApiClientError } from '../../lib/api';
import type { Question, Skill } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Pagination, SearchFilters, FilterSelect } from '../../components/common/Pagination';
import { Field, fieldErrors } from '../public/components/AuthCard';
import { categoryLabel, statusLabel } from '../../lib/format';

interface QuestionForm {
  text: string;
  category: string;
  topic: string;
  questionType: 'mcq' | 'likert';
  difficulty: 'easy' | 'medium' | 'hard';
  marks: string;
  explanation: string;
  options: Array<{ optionId: string; text: string; preferencePoints: string }>;
  correctOptionId: string;
  preferenceDimension: string;
  scaleMin: string;
  scaleMax: string;
  skillMappings: Array<{ skill: string; weight: number }>;
}

const emptyForm = (): QuestionForm => ({
  text: '',
  category: 'aptitude',
  topic: '',
  questionType: 'mcq',
  difficulty: 'medium',
  marks: '1',
  explanation: '',
  options: [
    { optionId: 'a', text: '', preferencePoints: '' },
    { optionId: 'b', text: '', preferencePoints: '' },
    { optionId: 'c', text: '', preferencePoints: '' },
    { optionId: 'd', text: '', preferencePoints: '' },
  ],
  correctOptionId: '',
  preferenceDimension: '',
  scaleMin: '1',
  scaleMax: '5',
  skillMappings: [],
});

export default function QuestionsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<QuestionForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{ questions: Question[] }>('/questions', {
        page,
        limit: 15,
        search: search || undefined,
        category: category || undefined,
        difficulty: difficulty || undefined,
      });
      setQuestions(data.questions);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search, category, difficulty]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  useEffect(() => {
    api
      .get<{ skills: Skill[] }>('/skills', { limit: 200, isActive: true })
      .then(({ data }) => setSkills(data.skills))
      .catch(() => setSkills([]));
  }, []);

  async function createQuestion(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormErrors({});
    setSaving(true);

    const isLikert = form.questionType === 'likert';
    const payload = {
      text: form.text.trim(),
      category: form.category,
      topic: form.topic.trim(),
      questionType: form.questionType,
      difficulty: form.difficulty,
      marks: Number(form.marks) || 1,
      explanation: form.explanation.trim() || undefined,
      options: form.options
        .filter((o) => o.text.trim())
        .map((o) => ({
          optionId: o.optionId,
          text: o.text.trim(),
          ...(isLikert ? { preferencePoints: Number(o.preferencePoints) || 0 } : {}),
        })),
      ...(isLikert
        ? {
            preferenceDimension: form.preferenceDimension,
            scaleMin: Number(form.scaleMin),
            scaleMax: Number(form.scaleMax),
          }
        : { correctOptionId: form.correctOptionId }),
      skillMappings: form.skillMappings,
    };

    try {
      await api.post('/questions', payload);
      toast.success('Question created.');
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

  async function toggleActive(question: Question) {
    try {
      await api.patch(`/questions/${question.id}/status`, { isActive: !question.isActive });
      toast.success(question.isActive ? 'Question deactivated.' : 'Question activated.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await api.delete<{ removedFromAssessments: number }>(`/questions/${deleteTarget.id}`);
      toast.success(
        data.removedFromAssessments > 0
          ? `Question deleted and removed from ${data.removedFromAssessments} test set(s).`
          : 'Question deleted.',
      );
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const isLikert = form.questionType === 'likert';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Question bank</h1>
          <p className="mt-1 text-sm text-slate-600">
            Items are mapped to skills, and the answer key is stored server-side only. Items already used in a recorded
            attempt cannot have their scoring data edited.
          </p>
        </div>
        {hasPermission('questions:write') && (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> New question
          </button>
        )}
      </header>

      {showCreate && (
        <Card
          title="Create a question"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" aria-hidden="true" /> Close
            </button>
          }
        >
          <form onSubmit={createQuestion} className="space-y-4" noValidate>
            {formError && <ErrorState message={formError} />}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="q-category" label="Category" error={formErrors.category}>
                <select
                  id="q-category"
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="aptitude">Aptitude</option>
                  <option value="logical_reasoning">Logical Reasoning</option>
                  <option value="technical_knowledge">Technical Knowledge</option>
                  <option value="domain_knowledge">Domain Knowledge</option>
                  <option value="personality">Personality / Working Preferences</option>
                </select>
              </Field>
              <Field id="q-type" label="Type">
                <select
                  id="q-type"
                  className="input"
                  value={form.questionType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, questionType: e.target.value as 'mcq' | 'likert' }))
                  }
                >
                  <option value="mcq">Multiple choice</option>
                  <option value="likert">Preference scale</option>
                </select>
              </Field>
              <Field id="q-topic" label="Topic" error={formErrors.topic}>
                <input
                  id="q-topic"
                  className="input"
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                />
              </Field>
              <Field id="q-difficulty" label="Difficulty">
                <select
                  id="q-difficulty"
                  className="input"
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as never }))}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
            </div>

            <Field id="q-text" label="Question text" error={formErrors.text}>
              <textarea
                id="q-text"
                rows={3}
                className="input"
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              />
            </Field>

            {isLikert ? (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="q-dimension" label="Preference dimension" error={formErrors.preferenceDimension}>
                    <select
                      id="q-dimension"
                      className="input"
                      value={form.preferenceDimension}
                      onChange={(e) => setForm((f) => ({ ...f, preferenceDimension: e.target.value }))}
                    >
                      <option value="">Select a dimension...</option>
                      <option value="analytical">Analytical</option>
                      <option value="creative">Creative</option>
                      <option value="structured">Structured</option>
                      <option value="collaborative">Collaborative</option>
                      <option value="leadership">Leadership</option>
                      <option value="detail_oriented">Detail oriented</option>
                      <option value="exploratory">Exploratory</option>
                    </select>
                  </Field>
                  <Field id="q-scaleMin" label="Scale minimum">
                    <input
                      id="q-scaleMin"
                      type="number"
                      min={1}
                      className="input"
                      value={form.scaleMin}
                      onChange={(e) => setForm((f) => ({ ...f, scaleMin: e.target.value }))}
                    />
                  </Field>
                  <Field id="q-scaleMax" label="Scale maximum">
                    <input
                      id="q-scaleMax"
                      type="number"
                      min={2}
                      className="input"
                      value={form.scaleMax}
                      onChange={(e) => setForm((f) => ({ ...f, scaleMax: e.target.value }))}
                    />
                  </Field>
                </div>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Preference items contribute points to the selected dimension. They are never marked right or wrong.
                </p>
              </div>
            ) : null}

            <div>
              <p className="label">
                Options {isLikert ? <span className="font-normal text-slate-500">(preferencePoints from -2 to +2)</span> : null}
              </p>
              <div className="space-y-2">
                {form.options.map((option, index) => (
                  <div key={option.optionId} className="flex flex-wrap items-center gap-2">
                    <span className="w-8 shrink-0 text-xs font-medium uppercase text-slate-500">
                      {option.optionId}
                    </span>
                    <div className="min-w-[200px] flex-1">
                      <label className="sr-only" htmlFor={`option-${option.optionId}`}>
                        Option {option.optionId} text
                      </label>
                      <input
                        id={`option-${option.optionId}`}
                        className="input"
                        value={option.text}
                        placeholder={`Option ${option.optionId}`}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            options: f.options.map((o, i) =>
                              i === index ? { ...o, text: e.target.value } : o,
                            ),
                          }))
                        }
                      />
                    </div>
                    {isLikert && (
                      <div className="w-24">
                        <label className="sr-only" htmlFor={`points-${option.optionId}`}>
                          Preference points for option {option.optionId}
                        </label>
                        <input
                          id={`points-${option.optionId}`}
                          type="number"
                          min={-2}
                          max={2}
                          className="input"
                          value={option.preferencePoints}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              options: f.options.map((o, i) =>
                                i === index ? { ...o, preferencePoints: e.target.value } : o,
                              ),
                            }))
                          }
                        />
                      </div>
                    )}
                    {!isLikert && (
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={form.correctOptionId === option.optionId}
                          onChange={() => setForm((f) => ({ ...f, correctOptionId: option.optionId }))}
                          className="h-3.5 w-3.5 text-accent-600 focus:ring-accent-500"
                        />
                        Correct
                      </label>
                    )}
                  </div>
                ))}
              </div>
              {!isLikert && formErrors.correctOptionId && (
                <p className="error-text" role="alert">
                  {formErrors.correctOptionId}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="q-marks" label="Marks" error={formErrors.marks}>
                <input
                  id="q-marks"
                  type="number"
                  min={0.1}
                  step={0.5}
                  className="input"
                  value={form.marks}
                  onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value }))}
                />
              </Field>
              <Field id="q-explanation" label="Explanation (shown after submission)">
                <input
                  id="q-explanation"
                  className="input"
                  value={form.explanation}
                  onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
                />
              </Field>
            </div>

            <div>
              <p className="label">Skill mappings (what this question measures)</p>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => {
                  const mapped = form.skillMappings.find((m) => m.skill === skill._id);
                  return (
                    <button
                      key={skill._id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          skillMappings: mapped
                            ? f.skillMappings.filter((m) => m.skill !== skill._id)
                            : [...f.skillMappings, { skill: skill._id, weight: 1 }],
                        }))
                      }
                      aria-pressed={Boolean(mapped)}
                      className={mapped ? 'badge-info' : 'badge-neutral'}
                    >
                      {skill.code}
                    </button>
                  );
                })}
              </div>
              {formErrors.skillMappings && (
                <p className="error-text" role="alert">
                  {formErrors.skillMappings}
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
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" /> Create question
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!questions && !error && <Skeleton className="h-64 w-full" />}

      {questions && (
        <Card bodyClassName="p-0">
          <SearchFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search question text or topic..."
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
              label="Difficulty"
              value={difficulty}
              onChange={(value) => {
                setDifficulty(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All levels' },
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
          </SearchFilters>

          {questions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Database className="h-8 w-8" aria-hidden="true" />}
                title="No questions match these filters"
                description="Adjust the filters or create a new question."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Difficulty</th>
                    <th>Usage</th>
                    <th>State</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.id}>
                      <td>
                        <button
                          type="button"
                          className="max-w-md truncate text-left text-sm font-medium text-navy-900 hover:underline"
                          onClick={() => setExpanded(expanded === question.id ? null : question.id)}
                        >
                          {question.text}
                        </button>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {question.topic}
                          {question.scorable ? '' : ' - not scorable (missing answer key or dimension)'}
                        </p>
                        {expanded === question.id && (
                          <div className="mt-2 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                            {question.options.map((option) => (
                              <p key={option.optionId} className="flex items-start gap-2 py-0.5">
                                <span className="font-medium uppercase text-slate-500">{option.optionId}</span>
                                <span className="flex-1 text-navy-800">{option.text}</span>
                                {question.correctOptionId === option.optionId && (
                                  <Badge tone="success">Correct</Badge>
                                )}
                                {option.preferencePoints !== undefined && (
                                  <Badge tone="info">{option.preferencePoints} pts</Badge>
                                )}
                              </p>
                            ))}
                            {question.explanation && (
                              <p className="mt-2 border-t border-slate-200 pt-2 text-slate-600">
                                <strong>Explanation:</strong> {question.explanation}
                              </p>
                            )}
                            {question.preferenceDimension && (
                              <p className="mt-2 text-slate-600">
                                <strong>Dimension:</strong> {question.preferenceDimension} (scale{' '}
                                {question.scaleMin}–{question.scaleMax})
                              </p>
                            )}
                            <p className="mt-2 text-slate-600">
                              <strong>Skills:</strong>{' '}
                              {question.skillMappings
                                .map((m) => skills.find((s) => s._id === m.skill)?.code ?? m.skill)
                                .join(', ') || 'none'}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <Badge tone={question.category === 'personality' ? 'warning' : 'info'}>
                          {categoryLabel(question.category)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-600">
                        {question.questionType === 'likert' ? 'Scale' : 'MCQ'}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-600">{statusLabel(question.difficulty)}</td>
                      <td className="tabular-nums text-slate-600">{question.usageCount > 0 ? 'Used' : 'Unused'}</td>
                      <td>
                        <Badge tone={question.isActive ? 'success' : 'neutral'}>
                          {question.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {hasPermission('questions:write') && (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => void toggleActive(question)}
                            >
                              {question.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          {hasPermission('questions:delete') && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => setDeleteTarget(question)}
                              aria-label="Delete question"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
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
            label="questions"
          />
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this question?"
        message={
          <div className="space-y-2">
            <p>
              &ldquo;{deleteTarget?.text.slice(0, 120)}
              {deleteTarget && deleteTarget.text.length > 120 ? '...' : ''}&rdquo;
            </p>
            <p className="text-slate-500">
              The question will be removed from any test set that references it. If it has already appeared in a
              recorded attempt the server will refuse the deletion, because that would corrupt assessment history.
            </p>
          </div>
        }
        confirmLabel="Delete question"
        tone="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

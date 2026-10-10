import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import clsx from 'clsx';
import { api, ApiClientError } from '../../lib/api';
import type { AttemptPayload, AttemptResult } from '../../types';
import { useToast } from '../../components/common/ToastProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Badge, Card, ErrorState, LoadingBlock, ProgressBar } from '../../components/common';
import { categoryLabel, formatCountdown } from '../../lib/format';

/**
 * Timed assessment runner.
 *
 * The countdown is derived from `expiresAt` recorded by the server and is
 * re-synchronised against `serverTime` on every load, so a client clock change
 * cannot buy extra time. Submission is explicit, and an expiry triggers an
 * automatic submit request.
 */
export default function AttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const autoSubmitted = useRef(false);

  // Load the attempt. A refresh restores the same attempt and remaining time.
  useEffect(() => {
    if (!attemptId) return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<AttemptPayload>(`/attempts/${attemptId}`, undefined, controller.signal);

        if (data.attempt.isFinalised) {
          navigate(`/assessments/result/${attemptId}`, { replace: true });
          return;
        }

        setPayload(data);
        setAnswers(Object.fromEntries(data.savedAnswers.map((a) => [a.questionId, a.selectedOptionId ?? ''])));
        setFlagged(Object.fromEntries(data.savedAnswers.map((a) => [a.questionId, a.isFlagged])));

        // Anchor the countdown to the server's own clock, not the browser's.
        const skew = new Date(data.attempt.serverTime).getTime() - Date.now();
        setSecondsLeft(Math.max(0, Math.floor((new Date(data.attempt.expiresAt).getTime() - (Date.now() + skew)) / 1000)));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [attemptId, navigate]);

  const questions = payload?.questions ?? [];
  const question = questions[current];

  // Local countdown. The server remains authoritative and re-checks on submit.
  useEffect(() => {
    if (!payload || payload.attempt.isFinalised) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [payload]);

  const persist = useCallback(
    async (patch: Array<{ questionId: string; selectedOptionId?: string; isFlagged?: boolean }>, silent = true) => {
      if (patch.length === 0) return;
      setSaving(true);
      try {
        const { data } = await api.put<{ secondsRemaining: number }>(`/attempts/${attemptId}/answers`, {
          answers: patch,
        });
        setLastSavedAt(new Date());
        setSecondsLeft(data.secondsRemaining);
        if (!silent) toast.success('Answers saved.');
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 410) {
          toast.error('Time expired. Your saved answers were submitted automatically.');
          navigate(`/assessments/result/${attemptId}`, { replace: true });
          return;
        }
        if (err instanceof ApiClientError && err.status === 409) {
          toast.error('This attempt has already been submitted.');
          navigate(`/assessments/result/${attemptId}`, { replace: true });
          return;
        }
        if (!silent) toast.error((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [attemptId, navigate, toast],
  );

  // Auto-submit exactly once when the countdown reaches zero.
  useEffect(() => {
    if (!payload || payload.attempt.isFinalised || secondsLeft > 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void (async () => {
      try {
        await persist([], true);
        await api.post(`/attempts/${attemptId}/submit`, { confirm: true });
        toast.notify('Time expired. Your saved answers were submitted automatically.', 'info');
      } catch {
        // The server sweep will finalise it even if this request fails.
      }
      navigate(`/assessments/result/${attemptId}`, { replace: true });
    })();
  }, [secondsLeft, payload, attemptId, navigate, persist, toast]);

  // Periodic safety save of anything changed but not yet persisted.
  useEffect(() => {
    const handler = window.setInterval(() => {
      const unanswered = questions.filter((q) => answers[q.id] && !lastSavedAt).map((q) => ({
        questionId: q.id,
        selectedOptionId: answers[q.id],
      }));
      if (unanswered.length > 0) void persist(unanswered);
    }, 30000);
    return () => window.clearInterval(handler);
  }, [questions, answers, lastSavedAt, persist]);

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [questions, answers],
  );

  function selectOption(optionId: string) {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
    void persist([{ questionId: question.id, selectedOptionId: optionId }]);
  }

  function toggleFlag() {
    if (!question) return;
    const next = !flagged[question.id];
    setFlagged((prev) => ({ ...prev, [question.id]: next }));
    void persist([{ questionId: question.id, isFlagged: next }]);
  }

  async function submit() {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<AttemptResult>(`/attempts/${attemptId}/submit`, { confirm: true });
      setSubmitOpen(false);
      toast.success('Assessment submitted and scored.');
      navigate(`/assessments/result/${data.id}`, { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading your attempt" />;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/assessments')}>
          Back to assessments
        </button>
      </div>
    );
  }
  if (!payload || !question) return null;

  const urgent = secondsLeft <= 60;
  const critical = secondsLeft <= 300;

  return (
    <div className="space-y-5">
      {/* Sticky header with the server-anchored countdown */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy-900">{payload.attempt.assessmentTitle}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge tone={payload.attempt.category === 'personality' ? 'warning' : 'info'}>
                {categoryLabel(payload.attempt.category)}
              </Badge>
              <span>
                Question {current + 1} of {questions.length}
              </span>
              {saving ? (
                <span className="flex items-center gap-1 text-slate-400">
                  <Save className="h-3 w-3" aria-hidden="true" /> saving...
                </span>
              ) : lastSavedAt ? (
                <span className="text-emerald-600">all answers saved</span>
              ) : null}
            </p>
          </div>

          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-lg font-semibold tabular-nums',
              urgent ? 'bg-red-100 text-red-700' : critical ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-navy-900',
            )}
            role="timer"
            aria-live={urgent ? 'assertive' : 'off'}
            aria-label="Time remaining"
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatCountdown(secondsLeft)}
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar
            value={answeredCount}
            max={questions.length}
            label={`${answeredCount} of ${questions.length} answered`}
            showValue={false}
            colourClass="bg-accent-500"
          />
        </div>
      </div>

      {urgent && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Less than a minute remaining. Your saved answers will be submitted automatically when time expires.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        {/* Question */}
        <Card className="min-h-[420px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{question.topic}</p>
              <p className="mt-1 text-sm text-slate-500">
                {payload.attempt.category === 'personality'
                  ? 'Rate how far you agree with this statement.'
                  : 'Select the single best answer.'}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleFlag}
              className={clsx(
                'btn btn-sm shrink-0',
                flagged[question.id] ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'btn-secondary',
              )}
              aria-pressed={Boolean(flagged[question.id])}
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              {flagged[question.id] ? 'Flagged' : 'Flag'}
            </button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-base font-medium leading-relaxed text-navy-900">{question.text}</legend>
            <div className="mt-4 space-y-2.5">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.optionId;
                return (
                  <label
                    key={option.optionId}
                    className={clsx(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
                      selected
                        ? 'border-accent-500 bg-accent-50 text-navy-900'
                        : 'border-slate-200 bg-white text-navy-800 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option.optionId}
                      checked={selected}
                      onChange={() => selectOption(option.optionId)}
                      className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-accent-600 focus:ring-accent-500"
                    />
                    <span className="leading-relaxed">{option.text}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
            </button>
            {current < questions.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => setCurrent((c) => c + 1)}>
                Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-accent" onClick={() => setSubmitOpen(true)}>
                <Send className="h-4 w-4" aria-hidden="true" /> Review &amp; submit
              </button>
            )}
          </div>
        </Card>

        {/* Question palette */}
        <aside className="lg:sticky lg:top-44 lg:self-start">
          <Card
            title="Questions"
            actions={
              <button
                type="button"
                className="btn btn-sm btn-accent lg:hidden"
                onClick={() => setSubmitOpen(true)}
              >
                Submit
              </button>
            }
          >
            <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
              {questions.map((q, index) => {
                const isCurrent = index === current;
                const answered = Boolean(answers[q.id]);
                const isFlagged = Boolean(flagged[q.id]);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrent(index)}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={`Question ${index + 1}${answered ? ', answered' : ', not answered'}${isFlagged ? ', flagged' : ''}`}
                    className={clsx(
                      'relative flex h-9 items-center justify-center rounded-md text-xs font-medium transition-colors',
                      isCurrent
                        ? 'bg-navy-800 text-white ring-2 ring-accent-500 ring-offset-1'
                        : answered
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {index + 1}
                    {isFlagged && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-emerald-100" aria-hidden="true" /> Answered
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-slate-100" aria-hidden="true" /> Not answered
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden="true" /> Flagged for review
              </li>
            </ul>

            <button type="button" className="btn btn-accent mt-4 w-full" onClick={() => setSubmitOpen(true)}>
              <Send className="h-4 w-4" aria-hidden="true" /> Submit assessment
            </button>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={submitOpen}
        title="Submit this assessment?"
        message={
          <div className="space-y-2">
            <p>
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length && (
                <>
                  {' '}
                  <strong>{questions.length - answeredCount}</strong> will be marked unanswered.
                </>
              )}
            </p>
            {flagged[question.id] && <p className="text-amber-700">One or more questions are still flagged for review.</p>}
            <p className="text-slate-500">
              Submission is final. After submitting you will see your score, per-skill analysis and a full answer
              review.
            </p>
          </div>
        }
        confirmLabel="Submit now"
        busy={submitting}
        onConfirm={submit}
        onCancel={() => setSubmitOpen(false)}
      />

      {submitting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy-950/40">
          <div className="flex items-center gap-2 rounded-lg bg-white px-5 py-4 text-sm font-medium text-navy-900 shadow-raised">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Scoring your assessment...
          </div>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {saving ? 'Saving answers' : lastSavedAt ? 'Answers saved' : ''}
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => setPaletteOpen((v) => !v)}
          aria-expanded={paletteOpen}
        >
          {paletteOpen ? 'Hide question list' : 'Show question list'}
        </button>
        {paletteOpen && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Use the numbered grid above to jump to any question.
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
        Answers save automatically as you select them.
      </div>
    </div>
  );
}

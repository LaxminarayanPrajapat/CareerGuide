import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Flag, Loader2, PlayCircle, ShieldCheck } from 'lucide-react';
import { api, ApiClientError } from '../../lib/api';
import type { AssessmentSummary } from '../../types';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, ErrorState, LoadingBlock } from '../../components/common';
import { categoryLabel } from '../../lib/format';

export default function InstructionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [assessment, setAssessment] = useState<AssessmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ assessment: AssessmentSummary }>(`/assessments/${id}`);
      setAssessment(data.assessment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    if (!assessment) return;
    setStarting(true);
    try {
      const { data } = await api.post<{ attempt: { id: string } }>('/attempts', {
        assessmentId: assessment.id,
      });
      toast.success('Attempt started. The timer is now running.');
      navigate(`/assessments/attempt/${data.attempt.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 410) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error((err as Error).message);
      }
    } finally {
      setStarting(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading assessment instructions" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!assessment) return null;

  const isPersonality = assessment.category === 'personality';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/assessments" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to assessments
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isPersonality ? 'warning' : 'info'}>{categoryLabel(assessment.category)}</Badge>
          {assessment.attemptCount > 0 && <Badge tone="neutral">{assessment.attemptCount} attempts recorded</Badge>}
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900">{assessment.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{assessment.description}</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 sm:grid-cols-4">
          {[
            { label: 'Questions', value: assessment.questionCount },
            { label: 'Duration', value: `${assessment.durationMinutes} minutes` },
            { label: isPersonality ? 'Items' : 'Total marks', value: isPersonality ? assessment.questionCount : assessment.totalMarks },
            { label: 'Attempts allowed', value: assessment.maxAttempts },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</dt>
              <dd className="mt-1 text-lg font-semibold text-navy-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Instructions">
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{assessment.instructions}</p>
      </Card>

      <Card title="Rules you should know">
        <ul className="space-y-3 text-sm leading-relaxed text-slate-600">
          <li className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
            <span>
              <strong className="text-navy-800">The server controls time.</strong> Starting the attempt records a
              deadline on the server. Reloading the page keeps the same attempt with the remaining time intact.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
            <span>
              <strong className="text-navy-800">Flag and review.</strong> Mark any question for review, move freely
              between questions, and change answers until you submit.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
            <span>
              <strong className="text-navy-800">Automatic submission.</strong> When the deadline passes, your saved
              answers are scored without any further action.
            </span>
          </li>
          <li className="flex gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <span>
              <strong className="text-navy-800">Submission is final.</strong> Once submitted you cannot reopen or
              change the attempt.
            </span>
          </li>
          {isPersonality && (
            <li className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                This is a working-preference instrument. There are no right or wrong answers and no pass mark.
                Results describe the kind of work you prefer - they are not a psychological assessment and they never
                restrict which careers you can pursue.
              </span>
            </li>
          )}
        </ul>
      </Card>

      {assessment.scoringNote && (
        <Card title="How this will be scored">
          <p className="text-sm leading-relaxed text-slate-600">{assessment.scoringNote}</p>
        </Card>
      )}

      <Card>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span className="text-sm text-navy-800">
            I have read the instructions and understand that the timer starts immediately and cannot be paused.
          </span>
        </label>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link to="/assessments" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="button" className="btn btn-primary" onClick={start} disabled={!confirmed || starting}>
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Starting...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" aria-hidden="true" /> Start assessment
              </>
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}

export { CheckCircle2 };

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, ClipboardList, RefreshCw, Target } from 'lucide-react';
import { api } from '../../lib/api';
import type { AvailableAssessment } from '../../types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  scoreColour,
} from '../../components/common';
import { categoryLabel, formatDate, formatDuration, statusLabel } from '../../lib/format';

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<AvailableAssessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<{ assessments: AvailableAssessment[] }>('/attempts/available');
      setAssessments(data.assessments);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Available assessments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Each test is timed by the server and scored automatically. Your answers are saved as you go.
        </p>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && !assessments && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      )}

      {assessments && assessments.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
          title="No assessments are available right now"
          description="Test sets appear here once an administrator publishes them. Check back later or contact your counsellor."
        />
      )}

      {assessments && assessments.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {assessments.map((assessment) => {
            const isPersonality = assessment.category === 'personality';
            const exhausted = assessment.attemptsRemaining === 0 && !assessment.liveAttemptId;

            return (
              <li key={assessment.id}>
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={isPersonality ? 'warning' : 'info'}>
                          {categoryLabel(assessment.category)}
                        </Badge>
                        {isSampleBadge(assessment) && <Badge tone="neutral">Sample</Badge>}
                        {assessment.batchRestricted && <Badge tone="neutral">Batch assigned</Badge>}
                      </div>
                      <h2 className="mt-2 text-base font-semibold text-navy-900">{assessment.title}</h2>
                    </div>
                    {assessment.liveAttemptId && <Badge tone="warning">In progress</Badge>}
                  </div>

                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{assessment.description}</p>

                  <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-center">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">Questions</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-navy-900">{assessment.questionCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">Duration</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-navy-900">
                        {assessment.durationMinutes} min
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                        {isPersonality ? 'Items' : 'Total marks'}
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-navy-900">
                        {isPersonality ? assessment.questionCount : assessment.totalMarks}
                      </dd>
                    </div>
                  </dl>

                  {assessment.availableUntil && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Closes {formatDate(assessment.availableUntil)}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Attempts used{' '}
                      <span className="font-medium text-navy-800">
                        {assessment.attemptsUsed}/{assessment.maxAttempts}
                      </span>
                    </p>
                    {assessment.liveAttemptId ? (
                      <Link
                        to={`/assessments/attempt/${assessment.liveAttemptId}`}
                        className="btn btn-sm btn-warning bg-amber-500 text-white hover:bg-amber-600"
                      >
                        Resume <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : (
                      <Link
                        to={`/assessments/${assessment.id}/instructions`}
                        className={`btn btn-sm ${exhausted ? 'btn-secondary pointer-events-none opacity-60' : 'btn-primary'}`}
                        aria-disabled={exhausted}
                        tabIndex={exhausted ? -1 : 0}
                      >
                        {exhausted ? 'No attempts left' : 'Start'}
                        {!exhausted && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                      </Link>
                    )}
                  </div>

                  {exhausted && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      You have used all {assessment.maxAttempts} attempts for this test. Your historical result is
                      preserved in your{' '}
                      <Link to="/history" className="font-medium text-accent-700 hover:underline">
                        assessment history
                      </Link>
                      .
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card title="Before you start">
        <ul className="space-y-2.5 text-sm text-slate-600">
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            The countdown is enforced on the server. Refreshing the page or closing the tab will not extend your time.
          </li>
          <li className="flex gap-2">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
            Once you submit, an attempt is final and cannot be changed. Use the flag feature to mark questions for review.
          </li>
          <li className="flex gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
            If the time expires, whatever you had saved is scored automatically.
          </li>
        </ul>
      </Card>
    </div>
  );
}

/** Sample test sets are seeded for demonstration and are labelled as such. */
function isSampleBadge(assessment: AvailableAssessment): boolean {
  return /sample/i.test(assessment.title);
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, RotateCcw, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { AttemptResult } from '../../types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  StatCard,
  scoreBarColour,
  scoreColour,
} from '../../components/common';
import { categoryLabel, formatDateTime, formatDuration } from '../../lib/format';

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<AttemptResult>(`/attempts/${attemptId}/result`);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ErrorState message="Loading your result..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!result) return null;

  const isPreference = result.scoringModel === 'preference';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isPreference ? 'warning' : 'info'}>{categoryLabel(result.category)}</Badge>
            {result.submissionReason === 'time_expired' && (
              <Badge tone="warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Auto-submitted: time expired
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900">{result.assessmentTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Submitted {formatDateTime(result.submittedAt)} &middot; took {formatDuration(result.timeSpentSeconds)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/assessments" className="btn btn-secondary">
            Other assessments
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/reports')}>
            Career reports
          </button>
        </div>
      </div>

      {isPreference ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-navy-900">Working preferences recorded</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Thank you for answering honestly. This instrument has no right or wrong answers and produces no pass
                mark. The scores below indicate which kinds of work you tend to prefer - they are not personality
                types, abilities or psychological findings, and they never restrict the careers you can pursue.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Your score"
            value={`${result.marksObtained} / ${result.scorableMarks ?? result.totalMarks}`}
            hint={
              result.percentage !== null
                ? `${result.percentage}% of scorable items${
                    result.scorableMarks !== null && result.scorableMarks !== result.totalMarks
                      ? ` (${result.totalMarks} nominal, ${result.invalidItemCount} item(s) excluded)`
                      : ''
                  }`
                : undefined
            }
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            tone={result.passed ? 'accent' : 'default'}
          />
          <StatCard
            label="Result"
            value={result.passed === null ? 'n/a' : result.passed ? 'Passed' : 'Not passed'}
            hint={result.passed === null ? undefined : 'Threshold set by the test administrator'}
            icon={result.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          />
          <StatCard
            label="Questions answered"
            value={`${result.answeredCount} / ${result.totalQuestions}`}
            hint={result.totalQuestions - result.answeredCount > 0 ? 'Unanswered items count as zero' : 'All answered'}
            icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          />
          <StatCard
            label="Skills measured"
            value={result.skillResults.length}
            hint="Added to your skill profile"
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      )}

      {result.invalidItemCount > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {result.invalidItemCount} item{result.invalidItemCount === 1 ? ' was' : 's were'} flagged by the
            system&rsquo;s test-validation rule and excluded from scoring. No answer was invented for them.
          </p>
        </div>
      )}

      {result.skillResults.length > 0 && (
        <Card title="Skill analysis for this attempt" description="What this attempt contributed to your skill profile">
          <ul className="space-y-4">
            {result.skillResults.map((skill) => (
              <li key={skill.skill}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-navy-900">
                    {skill.skillName}
                    <span className="ml-2 text-xs font-normal text-slate-400">{skill.skillCode}</span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${scoreColour(skill.score)}`}>
                    {skill.score}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ({skill.marksObtained}/{skill.marksPossible})
                    </span>
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={skill.score} showValue={false} colourClass={scoreBarColour(skill.score)} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
            These values are merged into your existing skill profile as an evidence-weighted average. A single short
            assessment does not overwrite a well-evidenced earlier result.
          </p>
        </Card>
      )}

      {result.preferenceResults.length > 0 && (
        <Card
          title="Indicative working-preference profile"
          description="50 means no preference expressed in either direction"
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {result.preferenceResults.map((pref) => (
              <li key={pref.dimension}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize text-navy-800">{pref.dimension.replace(/_/g, ' ')}</span>
                  <span className="font-medium tabular-nums text-navy-900">{pref.normalisedScore}</span>
                </div>
                <div className="mt-1.5">
                  <div className="relative h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-slate-400"
                      style={{ left: '50%' }}
                      aria-hidden="true"
                    />
                    <div
                      className="h-2 rounded-full bg-accent-500"
                      style={{
                        width: `${Math.max(2, pref.normalisedScore)}%`,
                        marginLeft: pref.normalisedScore > 50 ? 0 : 0,
                      }}
                      role="progressbar"
                      aria-valuenow={pref.normalisedScore}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${pref.dimension} preference score`}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{pref.itemsAnswered} statement(s) answered</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.review.length > 0 && (
        <Card title="Answer review" description="Expand an item to see the question, your response and the correct answer">
          <ul className="divide-y divide-slate-100">
            {result.review.map((item, index) => {
              const isOpen = expanded === item.questionId;
              return (
                <li key={item.questionId}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 py-3 text-left hover:bg-slate-50"
                    onClick={() => setExpanded(isOpen ? null : item.questionId)}
                    aria-expanded={isOpen}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900">{item.text}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        {item.evaluationStatus === 'preference' && <Badge tone="info">Preference item</Badge>}
                        {item.evaluationStatus === 'invalid' && (
                          <Badge tone="warning">Excluded: {item.invalidReason}</Badge>
                        )}
                        {item.evaluationStatus === 'unanswered' && <Badge tone="neutral">Not answered</Badge>}
                        {item.isCorrect === true && <Badge tone="success">Correct</Badge>}
                        {item.isCorrect === false && <Badge tone="danger">Incorrect</Badge>}
                        {item.marksAwarded !== null && (
                          <span className="text-xs text-slate-500">
                            {item.marksAwarded} / {item.marksPossible} marks
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronDown
                      className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div className="mb-3 ml-9 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                      <p className="leading-relaxed text-navy-900">{item.text}</p>
                      <dl className="mt-3 space-y-1.5">
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-xs font-medium text-slate-500">Your response</dt>
                          <dd className="text-navy-800">
                            {item.selectedOptionId ? `Option ${item.selectedOptionId.toUpperCase()}` : 'Not answered'}
                          </dd>
                        </div>
                        {item.correctOptionId && (
                          <div className="flex gap-2">
                            <dt className="w-24 shrink-0 text-xs font-medium text-slate-500">Correct answer</dt>
                            <dd className="font-medium text-emerald-700">Option {item.correctOptionId.toUpperCase()}</dd>
                          </div>
                        )}
                      </dl>
                      {item.explanation && (
                        <p className="mt-3 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs leading-relaxed text-accent-900">
                          <strong>Explanation:</strong> {item.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {result.review.length === 0 && (
        <EmptyState title="No review available" description="This attempt did not record any answer items." />
      )}

      <Card>
        <p className="text-sm leading-relaxed text-slate-600">
          Your result has been saved to your assessment history and your skill profile has been updated. Generate a
          career report to see how these skills compare against the roles in the career catalogue.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/reports')}>
            Go to career reports
          </button>
          <Link to="/history" className="btn btn-secondary">
            View full history
          </Link>
          <Link to="/compatibility" className="btn btn-secondary">
            Skill profile &amp; compatibility
          </Link>
        </div>
      </Card>
    </div>
  );
}

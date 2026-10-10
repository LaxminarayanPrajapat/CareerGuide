import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, Target } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import type { CareerMatch } from '../../types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
  confidenceBadge,
  scoreBarColour,
  scoreColour,
} from '../../components/common';

interface CompatibilityResponse {
  scoringVersion: string;
  completedAssessments: number;
  dataCoverage: number;
  matches: CareerMatch[];
}

export default function CompatibilityPage() {
  const [data, setData] = useState<CompatibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await api.get<CompatibilityResponse>('/compatibility');
      setData(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const visible = data.matches.filter((m) => m.compatibilityScore >= minScore);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Skill profile &amp; career compatibility</h1>
        <p className="mt-1 text-sm text-slate-600">
          Computed live by the deterministic scoring engine (version {data.scoringVersion}). No AI is involved in
          these numbers.
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-navy-900">Evidence available</p>
            <p className="mt-1 text-sm text-slate-600">
              {data.completedAssessments} assessment{data.completedAssessments === 1 ? '' : 's'} completed &middot;{' '}
              {Math.round(data.dataCoverage * 100)}% of the skill catalogue measured
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="min-score" className="text-sm text-slate-600">
              Minimum score
            </label>
            <input
              id="min-score"
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-32 accent-accent-600"
            />
            <span className="w-8 text-sm font-medium tabular-nums text-navy-900">{minScore}</span>
          </div>
        </div>
      </Card>

      {data.completedAssessments === 0 && (
        <EmptyState
          icon={<Target className="h-8 w-8" aria-hidden="true" />}
          title="No evidence to match yet"
          description="Compatibility scores require real assessment results. Complete at least one assessment so the system has measured competencies to compare against the career catalogue."
          action={
            <Link to="/assessments" className="btn btn-primary">
              Take an assessment
            </Link>
          }
        />
      )}

      {data.completedAssessments > 0 && data.matches.some((m) => m.insufficientData) && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Some roles have low data coverage, so their scores carry low confidence. Requirements that have not been
            measured are reported as unknown rather than treated as weaknesses - completing more assessments raises the
            reliability of these numbers.
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <Card title="Compatibility scores across the catalogue" description="All active career definitions">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={visible.slice(0, 16).map((m) => ({ name: m.title, score: m.compatibilityScore }))}
                margin={{ top: 8, right: 8, left: -20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={80}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => [`${value} / 100`, 'Compatibility']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={42}>
                  {visible.slice(0, 16).map((m) => (
                    <Cell key={m.careerId} fill={scoreBarColour(m.compatibilityScore).replace('bg-', '#')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Bar colours are a visual aid only. The underlying value is the number shown on hover.
          </p>
        </Card>
      )}

      <ul className="space-y-4">
        {visible.map((match) => {
          const isOpen = expanded === match.slug;
          const unmeasured = match.evidence.filter((e) => e.state === 'unmeasured');
          return (
            <li key={match.careerId}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-navy-900">{match.title}</h2>
                      <Badge tone="neutral">{match.category}</Badge>
                      <Badge tone="neutral" className={confidenceBadge(match.confidence)}>
                        {match.confidence} confidence
                      </Badge>
                      {match.insufficientData && <Badge tone="warning">Limited evidence</Badge>}
                    </div>
                    <div className="mt-3 max-w-md">
                      <ProgressBar
                        value={match.compatibilityScore}
                        label="Career compatibility score"
                        colourClass={scoreBarColour(match.compatibilityScore)}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Coverage {Math.round(match.dataCoverage * 100)}% &middot; skill fit {match.skillFitScore}
                      {match.aptitudeFitScore !== null && ` · aptitude ${match.aptitudeFitScore}`}
                      {match.preferenceFitScore !== null && ` · preferences ${match.preferenceFitScore}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold tabular-nums ${scoreColour(match.compatibilityScore)}`}>
                      {match.compatibilityScore}
                    </p>
                    <p className="text-xs text-slate-500">out of 100</p>
                  </div>
                </div>

                <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  {match.deterministicSummary}
                </p>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary mt-4"
                  onClick={() => setExpanded(isOpen ? null : match.slug)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? 'Hide requirement breakdown' : 'Show requirement breakdown'}
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                    {match.strengths.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-700">Requirements you already meet</h3>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {match.strengths.map((strength) => (
                            <li key={strength.skillCode}>
                              <Badge tone="success">
                                {strength.skillName} ({strength.measured} / {strength.required})
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {match.gaps.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-amber-700">Requirements below the target level</h3>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {match.gaps.map((gap) => (
                            <li key={gap.skillCode}>
                              <Badge tone={gap.priority === 'high' ? 'danger' : gap.priority === 'medium' ? 'warning' : 'neutral'}>
                                {gap.skillName} &minus;{Math.round(gap.gap)}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {unmeasured.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                          Not yet measured ({unmeasured.length})
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {unmeasured.map((e) => e.skillName).join(', ')} &mdash; no assessment you completed measures
                          these, so they are reported as unknown rather than as weaknesses.
                        </p>
                      </div>
                    )}

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Competency</th>
                            <th>Importance</th>
                            <th>Required</th>
                            <th>Effective</th>
                            <th>Contribution</th>
                            <th>Interpretation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {match.evidence.map((item) => (
                            <tr key={`${match.slug}-${item.skillCode}`}>
                              <td className="font-medium text-navy-900">{item.skillName}</td>
                              <td>
                                <Badge tone={item.importance === 'core' ? 'info' : 'neutral'}>
                                  {item.importance}
                                </Badge>
                              </td>
                              <td className="tabular-nums">{item.requiredLevel}</td>
                              <td className="tabular-nums">
                                {item.state === 'unmeasured' ? (
                                  <span className="text-slate-400">n/a</span>
                                ) : (
                                  <span className={scoreColour(item.measuredLevel)}>{item.measuredLevel}</span>
                                )}
                              </td>
                              <td className="tabular-nums text-slate-600">{(item.weight * 100).toFixed(0)}%</td>
                              <td className="max-w-md text-xs text-slate-600">{item.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

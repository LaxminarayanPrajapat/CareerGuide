import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Download, Info, Printer, Sparkles, Target } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import type { CareerReport, ReportRecommendation } from '../../types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ProgressBar,
  StatCard,
  confidenceBadge,
  scoreBarColour,
  scoreColour,
} from '../../components/common';
import { categoryLabel, formatDateTime, statusLabel } from '../../lib/format';

const PRIORITY_COLOURS: Record<string, string> = {
  high: '#dc2626',
  medium: '#f59e0b',
  low: '#64748b',
};

const RADAR_COLOURS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#e11d48', '#65a30d'];

export default function ReportDetailPage() {
  const { reportNumber } = useParams<{ reportNumber: string }>();
  const [report, setReport] = useState<CareerReport | null>(null);
  const [candidate, setCandidate] = useState<{ fullName: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCareer, setExpandedCareer] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!reportNumber) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ report: CareerReport; candidate: { fullName: string; email: string } }>(
        `/reports/${reportNumber}`,
      );
      setReport(data.report);
      setCandidate(data.candidate);
      if (data.report.recommendations.length > 0) setExpandedCareer(data.report.recommendations[0].careerSlug);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [reportNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading your report" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!report) return null;

  const skillData = report.skillSnapshot.slice(0, 12);
  const radarData = report.skillSnapshot.slice(0, 6).map((s) => ({ skill: s.skillName, level: s.score }));

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/reports" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-navy-900">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to reports
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900">Career report {report.reportNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {candidate?.fullName} &middot; generated {formatDateTime(report.generatedAt)} &middot; scoring version{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{report.scoringVersion}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/v1/reports/${report.reportNumber}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <Printer className="h-4 w-4" aria-hidden="true" /> Print / save as PDF
          </a>
          <Link to="/roadmaps" className="btn btn-secondary">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> My roadmaps
          </Link>
        </div>
      </div>

      {/* Disclaimer banner - always visible, never hidden behind a toggle. */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Read this before acting on the report</h2>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">{report.disclaimer}</p>
          </div>
        </div>
      </div>

      {/* AI provenance - stated honestly whether or not AI was used. */}
      <Card className="no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Sparkles className="h-4 w-4 text-accent-600" aria-hidden="true" /> How this report was produced
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {report.aiProviderUsed === 'none' ? (
                <>
                  <strong>Deterministic report.</strong> No AI provider is configured on this deployment, so every
                  explanation below is template text generated from the scoring algorithm. Nothing was written by a
                  language model.
                </>
              ) : (
                <>
                  <strong>AI narrative enabled ({report.aiProviderUsed}).</strong> Scores, rankings and gaps were
                  computed by the deterministic algorithm. The AI provider was given only that evidence and asked to
                  write the wording, and its output was schema-validated before being stored.
                </>
              )}
            </p>
            {report.aiFailureReason && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                The AI provider did not produce a usable response ({report.aiFailureReason}). Deterministic
                explanations were used instead.
              </p>
            )}
          </div>
          <Badge tone={report.aiProviderUsed === 'none' ? 'neutral' : 'success'}>
            {report.aiProviderUsed === 'none' ? 'No AI used' : `Provider: ${report.aiProviderUsed}`}
          </Badge>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assessments used"
          value={report.completedAssessments}
          hint={`Skill profile revision ${report.skillProfileRevision}`}
          icon={<Target className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Skills measured"
          value={report.skillSnapshot.length}
          hint={`${Math.round(report.dataCoverage * 100)}% catalogue coverage`}
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          tone="accent"
        />
        <StatCard
          label="Career options"
          value={report.recommendations.length}
          hint="Ranked by compatibility"
          icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Unmeasured skills"
          value={report.unmeasuredSkillCodes.length}
          hint="Reported as unknown, not as weaknesses"
          icon={<Info className="h-4 w-4" aria-hidden="true" />}
          tone="warning"
        />
      </div>

      {/* Assessments used */}
      {report.inputAssessments.length > 0 && (
        <Card title="Assessments used in this report">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Category</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {report.inputAssessments.map((assessment, index) => (
                  <tr key={index}>
                    <td className="font-medium text-navy-900">{assessment.title}</td>
                    <td>
                      <Badge tone={assessment.category === 'personality' ? 'warning' : 'info'}>
                        {categoryLabel(assessment.category)}
                      </Badge>
                    </td>
                    <td>
                      {assessment.category === 'personality' ? (
                        <span className="text-xs text-slate-500">Preference profile</span>
                      ) : (
                        <span className={`font-semibold ${scoreColour(assessment.percentage)}`}>
                          {assessment.percentage}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Skill profile */}
      {skillData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Measured skill levels" description="Combined from all completed assessments">
            <ul className="space-y-3">
              {skillData.map((skill) => (
                <li key={skill.skillCode}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-navy-800">
                      {skill.skillName}
                      <span className="ml-2 text-xs text-slate-400">{skill.evidence} evidence</span>
                    </span>
                    <span className={`shrink-0 font-medium tabular-nums ${scoreColour(skill.score)}`}>{skill.score}</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={skill.score} showValue={false} colourClass={scoreBarColour(skill.score)} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Skill profile overview">
            {radarData.length >= 3 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <Radar dataKey="level" stroke="#2563eb" fill="#2563eb" fillOpacity={0.25} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                Complete more assessments to build a profile rich enough for this chart.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Strengths / gaps */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Strongest demonstrated skills">
          {report.strongestSkills.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No skills measured yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {report.strongestSkills.map((skill) => (
                <li key={skill.skillCode} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-navy-800">{skill.skillName}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${scoreColour(skill.score)}`}>
                    {skill.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Lowest measured skills" description="Measured areas with the most room to grow">
          {report.weakestSkills.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No skills measured yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {report.weakestSkills.map((skill) => (
                <li key={skill.skillCode} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-navy-800">{skill.skillName}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${scoreColour(skill.score)}`}>
                    {skill.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {report.unmeasuredSkillCodes.length > 0 && (
        <Card title="Not yet measured" description="Reported as unknown so they are not mistaken for weaknesses">
          <div className="flex flex-wrap gap-2">
            {report.unmeasuredSkillCodes.map((code) => (
              <Badge key={code} tone="neutral">
                {code.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            These skills appear in one or more career definitions but no assessment you completed measures them.
            Complete additional assessments to raise the confidence of your recommendations.
          </p>
        </Card>
      )}

      {/* Working preferences */}
      {report.preferenceProfile.length > 0 && (
        <Card
          title="Indicative working preferences"
          description="From the personality instrument - not personality types or psychological findings"
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.preferenceProfile.map((p) => ({
                  dimension: p.dimension.replace(/_/g, ' '),
                  score: p.score,
                }))}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="dimension" tick={{ fontSize: 11, fill: '#64748b' }} width={110} />
                <Tooltip
                  formatter={(value: number) => [value, 'Preference score']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {report.preferenceProfile.map((p) => (
                    <Cell key={p.dimension} fill="#14a89c" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            A score of 50 means no preference was expressed in either direction. These results describe the kind of work
            you tend to prefer. They are not diagnoses, they do not measure ability, and they do not restrict your
            career options.
          </p>
        </Card>
      )}

      {/* AI narrative */}
      {report.aiNarrative?.overview && (
        <Card title="Summary explanation">
          <p className="text-sm leading-relaxed text-slate-700">{report.aiNarrative.overview}</p>
          {report.aiNarrative.strengths && report.aiNarrative.strengths.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-navy-900">Strengths highlighted</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                {report.aiNarrative.strengths.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.aiNarrative.developmentAreas && report.aiNarrative.developmentAreas.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-navy-900">Development areas highlighted</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                {report.aiNarrative.developmentAreas.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {/* Recommendations */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-navy-900">Recommended career options</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ranked by compatibility score. Expand an option to see the exact evidence used.
        </p>
      </div>

      {report.recommendations.length === 0 ? (
        <EmptyState
          title="No recommendations produced"
          description="Complete at least one assessment so the system has evidence to match against the career catalogue."
          action={
            <Link to="/assessments" className="btn btn-primary">
              Take an assessment
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {report.recommendations.map((rec, index) => {
            const isOpen = expandedCareer === rec.careerSlug;
            return (
              <li key={rec.careerSlug}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                        <h3 className="text-base font-semibold text-navy-900">{rec.careerTitle}</h3>
                        <Badge tone="neutral">{rec.careerCategory}</Badge>
                        <Badge tone="neutral" className={confidenceBadge(rec.confidence)}>
                          {rec.confidence} confidence
                        </Badge>
                      </div>
                      <div className="mt-3 max-w-md">
                        <ProgressBar
                          value={rec.compatibilityScore}
                          label="Career compatibility score (not a success probability)"
                          colourClass={scoreBarColour(rec.compatibilityScore)}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {Math.round(rec.dataCoverage * 100)}% of this role&rsquo;s requirements measured &middot; skill fit{' '}
                        {rec.skillFitScore} &middot; aptitude {rec.aptitudeFitScore} &middot; preferences{' '}
                        {rec.preferenceFitScore}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold tabular-nums ${scoreColour(rec.compatibilityScore)}`}>
                        {rec.compatibilityScore}
                      </p>
                      <p className="text-xs text-slate-500">out of 100</p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                    {rec.deterministicSummary}
                  </p>

                  {rec.aiExplanation && (
                    <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent-800">
                        AI explanation ({' '}
                        {report.aiProviderUsed})
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-accent-900">{rec.aiExplanation}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm btn-secondary mt-4 no-print"
                    onClick={() => setExpandedCareer(isOpen ? null : rec.careerSlug)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? 'Hide evidence' : 'Show evidence for this score'}
                  </button>

                  {isOpen && <RecommendationEvidence recommendation={rec} />}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <div className="no-print flex flex-wrap gap-2">
        <a
          href={`/api/v1/reports/${report.reportNumber}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Print / save as PDF
        </a>
        <Link to="/roadmaps" className="btn btn-secondary">
          Open my learning roadmaps
        </Link>
      </div>
    </div>
  );
}

/** Full evidence table behind a single compatibility score. */
function RecommendationEvidence({ recommendation }: { recommendation: ReportRecommendation }) {
  const gapChart = recommendation.topGaps.map((gap) => ({
    name: gap.skillName,
    gap: Math.round(gap.gap),
  }));

  return (
    <div className="mt-4 space-y-5 border-t border-slate-200 pt-5">
      {gapChart.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-navy-900">Priority gaps for this role</h4>
          <div className="mt-2 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gapChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={130} />
                <Tooltip
                  formatter={(value: number) => [`${value} points`, 'Gap']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="gap" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {recommendation.topGaps.map((gap) => (
                    <Cell key={gap.skillCode} fill={PRIORITY_COLOURS[gap.priority] ?? '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-navy-900">How each requirement contributed</h4>
        <div className="table-wrap mt-2">
          <table className="data-table">
            <thead>
              <tr>
                <th>Competency</th>
                <th>Importance</th>
                <th>Required</th>
                <th>Measured</th>
                <th>Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recommendation.evidence.map((item) => (
                <tr key={`${recommendation.careerSlug}-${item.skillCode}`}>
                  <td className="font-medium text-navy-900">{item.skillName}</td>
                  <td>
                    <Badge tone={item.importance === 'core' ? 'info' : 'neutral'}>{statusLabel(item.importance)}</Badge>
                  </td>
                  <td className="tabular-nums">{item.requiredLevel}</td>
                  <td className="tabular-nums">
                    {item.state === 'unmeasured' ? (
                      <span className="text-slate-400">Not measured</span>
                    ) : (
                      <span className={scoreColour(item.measuredLevel)}>{item.measuredLevel}</span>
                    )}
                  </td>
                  <td className="tabular-nums text-slate-600">{(item.weight * 100).toFixed(0)}%</td>
                  <td className="text-xs text-slate-600">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

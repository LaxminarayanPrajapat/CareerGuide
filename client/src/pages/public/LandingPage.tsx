import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  ClipboardCheck,
  FileText,
  GitBranch,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { PublicLayout, HowItWorksSection } from '../../components/layout/PublicLayout';

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'Five assessment categories',
    body: 'Aptitude, logical reasoning, technical knowledge, domain knowledge and indicative working preferences - all scored automatically by the server.',
  },
  {
    icon: Timer,
    title: 'Server-enforced timing',
    body: 'Attempt deadlines are recorded on the server, survive a browser refresh, and finalise automatically when time expires.',
  },
  {
    icon: Brain,
    title: 'Evidence-weighted skill profile',
    body: 'Each skill accumulates a level from the assessments that measured it. A single short test never overwrites a well-evidenced result.',
  },
  {
    icon: GitBranch,
    title: 'Transparent matching',
    body: 'A documented algorithm shows exactly which skills were measured, which were not, and how each affected the compatibility score.',
  },
  {
    icon: FileText,
    title: 'Explainable reports',
    body: 'Every recommendation includes its evidence, the skill gaps behind it, and a personalised roadmap you can actually track.',
  },
  {
    icon: ShieldCheck,
    title: 'Responsible by design',
    body: 'No diagnoses, no guarantees, no hidden traits. Personality results are labelled as indicative working preferences only.',
  },
];

const CATEGORIES = [
  { name: 'Aptitude', body: 'Numerical, verbal and general reasoning.' },
  { name: 'Logical Reasoning', body: 'Patterns, deduction, analogy and spatial reasoning.' },
  { name: 'Technical Knowledge', body: 'Programming, web, databases, version control, testing.' },
  { name: 'Domain Knowledge', body: 'Data, security, cloud, design and business practice.' },
  { name: 'Working Preferences', body: 'Indicative preferences - never right or wrong.' },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="badge-info">
                <Target className="h-3 w-3" aria-hidden="true" /> MCA Semester III academic project
              </span>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-navy-900 sm:text-4xl lg:text-5xl">
                Turn your assessments into an{' '}
                <span className="text-accent-600">explainable career path</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
                Complete timed assessments across aptitude, reasoning, technical and domain knowledge. The system
                builds a structured skill profile, compares it against a real career catalogue, and produces a
                personal report showing exactly why each career matches - and where the gaps are.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="btn btn-primary">
                  Create your free account <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/login" className="btn btn-secondary">
                  Sign in
                </Link>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-200 pt-6">
                {[
                  { label: 'Assessment categories', value: '5' },
                  { label: 'Sample career paths', value: '16' },
                  { label: 'Scored', value: 'Server-side' },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.label}</dt>
                    <dd className="mt-1 text-lg font-semibold text-navy-900">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Decorative but honest: shows the shape of a compatibility result. */}
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Example report shape (illustrative)
                </p>
              </div>
              <div className="space-y-4 p-5">
                {[
                  { title: 'Data Analyst', score: 78, width: '78%', colour: 'bg-emerald-500' },
                  { title: 'Full Stack Developer', score: 71, width: '71%', colour: 'bg-blue-500' },
                  { title: 'UI/UX Designer', score: 58, width: '58%', colour: 'bg-amber-500' },
                ].map((row) => (
                  <div key={row.title}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-navy-900">{row.title}</span>
                      <span className="font-semibold tabular-nums text-navy-800">{row.score}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200">
                      <div className={`h-2 rounded-full ${row.colour}`} style={{ width: row.width }} />
                    </div>
                  </div>
                ))}
                <p className="border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
                  Numbers above are illustrative only. In the running system every score is computed from your own
                  completed assessments and can be traced back to the evidence used.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-navy-900">What you will be assessed on</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Each category measures a different part of your profile, so the recommendation reflects a broad picture
              rather than a single test result.
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category, index) => (
              <li key={category.name} className="card p-5">
                <span className="text-xs font-semibold text-accent-600">0{index + 1}</span>
                <h3 className="mt-1 text-sm font-semibold text-navy-900">{category.name}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{category.body}</p>
              </li>
            ))}
            <li className="card flex items-center justify-center border-dashed p-5">
              <Link to="/assessments-info" className="text-sm font-medium text-accent-700 hover:underline">
                See full assessment details
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <HowItWorksSection />

      {/* Features */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-navy-900">Built to be trustworthy</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A career recommendation is only useful if you can see where it came from. This system is designed around
              showing its work.
            </p>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="card p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-navy-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Roles */}
      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-navy-900">One platform, four workspaces</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Access is enforced on the server for every request - the interface only mirrors what the backend allows.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { role: 'Candidates', body: 'Take assessments, view skill analysis, generate reports and track roadmaps.' },
              { role: 'Counsellors', body: 'Review assigned students, author question banks and test sets, and monitor progress.' },
              { role: 'Management', body: 'Read-only institutional analytics, batch comparisons and aggregate exports.' },
              { role: 'Administrators', body: 'Manage users, master data, test sets, system settings and audit records.' },
            ].map((item) => (
              <li key={item.role} className="card p-5">
                <h3 className="text-sm font-semibold text-navy-900">{item.role}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-900 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <TrendingUp className="mx-auto h-8 w-8 text-accent-400" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
            Start with your first assessment
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-navy-200">
            Registration takes a minute. Complete the aptitude and working-preference instruments first, then add
            technical and domain assessments to sharpen your recommendations.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn bg-accent-500 text-white hover:bg-accent-600">
              Create account
            </Link>
            <Link to="/about" className="btn border border-navy-600 text-white hover:bg-navy-800">
              Learn how scoring works
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

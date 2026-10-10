import { Link } from 'react-router-dom';
import {
  Accessibility,
  Clock,
  FileSearch,
  Lock,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Card } from '../../components/common';

const FOR_CANDIDATES = [
  {
    icon: Target,
    title: 'Guidance built on your own evidence',
    body: 'Recommendations come from assessments you completed here, not from generic advice. Every score can be traced back to the questions that produced it.',
  },
  {
    icon: FileSearch,
    title: 'You can see the gaps, not just the score',
    body: 'Each career option shows the specific competencies you have met, the ones you have not, and the ones that have not been measured yet.',
  },
  {
    icon: Clock,
    title: 'No waiting for a counsellor slot',
    body: 'Assessments and reports are available immediately. A counsellor can then review the evidence with you and add human judgement.',
  },
  {
    icon: RefreshCw,
    title: 'Progress you can track',
    body: 'Retake assessments and watch your skill profile and compatibility scores change, with full history preserved rather than overwritten.',
  },
];

const FOR_STAFF = [
  {
    icon: Users,
    title: 'Less manual scoring',
    body: 'Objective items are scored automatically and personality instruments are aggregated by a documented model, removing repetitive manual evaluation.',
  },
  {
    icon: FileSearch,
    title: 'Centralised question bank and test sets',
    body: 'Counsellors and administrators author questions once and reuse them across test sets, with skill mappings kept consistent.',
  },
  {
    icon: Lock,
    title: 'Access enforced on the server',
    body: 'Every endpoint validates the session and role. A candidate cannot read another candidate\'s answers or report, even with a guessed identifier.',
  },
  {
    icon: Accessibility,
    title: 'Institutional insight without exposing individuals',
    body: 'Management reporting is aggregate only: completion rates, batch distributions and career-interest summaries, with no candidate-level records.',
  },
];

export default function BenefitsPage() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">Why this system is useful</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
            Career guidance is often either generic or inaccessible. This system aims to be neither: structured enough
            to be consistent, and transparent enough that you can disagree with it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-lg font-semibold text-navy-900">For candidates and students</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {FOR_CANDIDATES.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <Card>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-navy-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </Card>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-14 text-lg font-semibold text-navy-900">For counsellors, management and administrators</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {FOR_STAFF.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <Card>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-navy-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </Card>
              </li>
            );
          })}
        </ul>

        <div className="mt-14 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-sm font-semibold text-navy-900">What this system deliberately does not do</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>It does not promise a job, an interview or any placement outcome.</li>
            <li>It does not produce psychological, clinical or diagnostic results.</li>
            <li>It does not rank you against other candidates, and it reports no percentile scores.</li>
            <li>It does not exclude a career simply because you have not yet learned a required skill.</li>
            <li>It does not integrate with job boards or make hiring decisions.</li>
          </ul>
          <Link to="/privacy" className="btn btn-secondary mt-6">
            Read the full privacy policy and AI disclaimer
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

import { Link } from 'react-router-dom';
import { Link as LinkIcon, Lock, Sigma, Search } from 'lucide-react';
import { PublicLayout, HowItWorksSection } from '../../components/layout/PublicLayout';
import { Card } from '../../components/common';

export default function AboutPage() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">How this system works</h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            The system is built so that every number it shows can be traced back to an assessment you actually
            completed. This page explains the scoring method in plain language, including where the system refuses to
            guess.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-10 px-4 py-14 sm:px-6 lg:px-8">
        <Card title="1. Assessments are timed and scored on the server">
          <p className="text-sm leading-relaxed text-slate-600">
            When you start a test, the server records the start time and the deadline. The countdown you see in the
            browser is only a display - the server decides when an attempt is late. Refreshing the page, closing the
            tab or changing your computer clock does not extend your time. When the deadline passes, the system scores
            whatever you had saved, whether or not you clicked submit.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <Sigma className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              Objective items are marked from a stored answer key. Marks are never calculated in the browser.
            </li>
            <li className="flex gap-2">
              <Sigma className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              If an item is malformed - for example it is missing an answer key - it is flagged and excluded from the
              total. The system never invents a correct answer to keep a score looking neat.
            </li>
            <li className="flex gap-2">
              <Sigma className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              Working-preference items are not marked right or wrong. They contribute points to declared preference
              dimensions and are reported separately.
            </li>
          </ul>
        </Card>

        <Card title="2. Your skill profile accumulates evidence">
          <p className="text-sm leading-relaxed text-slate-600">
            Each question is mapped to one or more structured skills. When an attempt is scored, the result for each
            skill is merged into your profile as an evidence-weighted average:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-navy-900 px-4 py-3 text-xs leading-relaxed text-navy-100">
{`newLevel = (oldLevel x oldEvidence + newObservation x newEvidence)
            / (oldEvidence + newEvidence)`}
          </pre>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            In practice this means one short test will not erase a well-evidenced earlier result, and a later
            assessment always moves your level towards the newly observed value. Every update is versioned, so skill
            progression can be reviewed over time rather than overwritten.
          </p>
        </Card>

        <Card title="3. Career compatibility is a transparent calculation">
          <p className="text-sm leading-relaxed text-slate-600">
            For each career in the catalogue, and for each competency that career requires, the system:
          </p>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              <strong className="text-navy-800">Damps low-evidence measurements.</strong> A skill measured from very
              little evidence is trusted slightly less, but is never discarded and never counted as zero.
            </li>
            <li>
              <strong className="text-navy-800">Compares the level to the requirement.</strong>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">ratio = min(1, level / required)</code>, weighted
              by how important the requirement is for that role.
            </li>
            <li>
              <strong className="text-navy-800">Applies a coverage penalty.</strong> Requirements that have not been
              measured reduce the score, but the reduction is limited - so &ldquo;not yet assessed&rdquo; is reported as{' '}
              <em>unknown</em> rather than as a weakness.
            </li>
            <li>
              <strong className="text-navy-800">Adds aptitude and preference fit</strong> as smaller components, only
              where the career declares them and you have the relevant evidence.
            </li>
            <li>
              <strong className="text-navy-800">Reports a confidence level</strong> based on how much of the role you
              have actually been measured against.
            </li>
          </ol>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <strong>This is a compatibility score, not a probability.</strong> It does not estimate the likelihood that
            you will get a job, succeed in a profession or be hired. It says only: based on the evidence recorded
            here, this role lines up with what you have demonstrated so far.
          </p>
        </Card>

        <Card title="4. AI explains, it does not decide">
          <p className="text-sm leading-relaxed text-slate-600">
            Scores and career rankings are computed by the deterministic algorithm above. If an AI provider is
            configured, it receives only the already-computed evidence and is asked to write an explanation. Its
            output is validated against a strict schema, and any career it invents is discarded. If no provider is
            configured, or the request fails, the report still generates using clearly labelled template text - the
            system never claims an AI call succeeded when it did not.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              AI output never affects permissions, scores or rankings.
            </li>
            <li className="flex gap-2">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              Missing evidence is stated as missing. The model is instructed not to invent figures.
            </li>
          </ul>
        </Card>

        <Card title="Where this system will not go">
          <p className="text-sm leading-relaxed text-slate-600">
            Results are not psychological or clinical findings, and working preferences are not personality types.
            The system does not claim psychometric validity, prediction accuracy or placement rates, and it does not
            use protected personal characteristics to narrow career options. Because the catalogue and the scoring
            version are documented, results can be audited and the scoring rules improved over time without losing
            comparability.
          </p>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link to="/register" className="btn btn-primary">
            Create an account
          </Link>
          <Link to="/privacy" className="btn btn-secondary">
            Read the privacy policy
            <LinkIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <HowItWorksSection />
    </PublicLayout>
  );
}

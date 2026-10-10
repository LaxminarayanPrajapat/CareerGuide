import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Brain,
  ClipboardCheck,
  GitBranch,
  Menu,
  ShieldCheck,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';

const NAV = [
  { to: '/about', label: 'How it works', icon: Target },
  { to: '/assessments-info', label: 'Assessment categories', icon: ClipboardCheck },
  { to: '/benefits', label: 'Why use it', icon: TrendingUp },
  { to: '/privacy', label: 'Privacy & AI disclaimer', icon: ShieldCheck },
];

const STEPS = [
  {
    icon: ClipboardCheck,
    title: 'Complete the assessments',
    body: 'Five categories: aptitude, logical reasoning, technical knowledge, domain knowledge and indicative working preferences. Each test is timed by the server and scored automatically.',
  },
  {
    icon: Brain,
    title: 'Build your skill profile',
    body: 'Your answers are mapped onto a structured skill catalogue. Each skill accumulates an evidence-weighted level that updates as you complete more assessments.',
  },
  {
    icon: GitBranch,
    title: 'Compute career compatibility',
    body: 'A documented, deterministic algorithm compares your measured competencies against each career definition in the catalogue, weighting requirements and accounting for skills that are not yet measured.',
  },
  {
    icon: Target,
    title: 'Get an explainable report',
    body: 'You receive a ranked set of career options with the evidence behind every score, your identified skill gaps, and a personalised development roadmap you can track.',
  },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [children]);

  const home = user?.role === 'admin' ? '/admin' : user?.role === 'counsellor' ? '/counsellor' : user?.role === 'management' ? '/management' : '/dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#public-main" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-sm font-bold text-white">
              CG
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy-900">AI Career Guide</span>
              <span className="block text-[11px] text-slate-500">Career Path &amp; Skill Recommendation</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Public navigation">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-navy-700 hover:bg-slate-100"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to={home} className="btn btn-primary btn-sm">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Create account
                </Link>
              </>
            )}
            <button
              type="button"
              className="rounded p-1.5 text-navy-700 hover:bg-slate-100 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-slate-200 bg-white md:hidden" aria-label="Mobile navigation">
            <ul className="mx-auto max-w-7xl px-4 py-2">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="block rounded-lg px-3 py-2 text-sm font-medium text-navy-700 hover:bg-slate-100">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="public-main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-navy-900">AI Career Path &amp; Skill Recommendation System</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                An academic project that demonstrates assessment, scoring and explainable career matching.
                Recommendations are indicative and based on the evidence recorded in this system.
              </p>
            </div>
            <div className="text-xs text-slate-600">
              <p className="font-medium text-navy-800">Quick links</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link to="/privacy" className="hover:text-navy-900 hover:underline">
                    Privacy policy and AI advice disclaimer
                  </Link>
                </li>
                <li>
                  <Link to="/assessments-info" className="hover:text-navy-900 hover:underline">
                    Assessment categories
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-navy-900 hover:underline">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-6 border-t border-slate-200 pt-4 text-[11px] text-slate-500">
            Career compatibility scores are computed by a deterministic algorithm and are not statistical
            predictions of career success, hiring decisions or guaranteed outcomes.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section className="bg-slate-50 py-16" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-navy-900">How the process works</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Every figure shown in a report is computed from assessments you actually completed. Nothing is
            estimated, and no score is generated without evidence.
          </p>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-navy-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

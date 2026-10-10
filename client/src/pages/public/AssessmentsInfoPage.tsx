import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Card, EmptyState, ErrorState, Badge } from '../../components/common';
import { api } from '../../lib/api';
import { CATEGORY_LABELS } from '../../lib/format';

interface Category {
  _id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  scoringModel: 'objective' | 'preference';
  isActive: boolean;
  displayOrder: number;
}

/** Public explanation of each assessment category, read from the database. */
export default function AssessmentsInfoPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ categories: Category[] }>('/assessment-categories', undefined, controller.signal)
      .then(({ data }) => setCategories(data.categories))
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">Assessment categories</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
            Each category contributes a different part of your skill profile. Completing more categories increases the
            confidence of your recommendations, because more of each career's requirements can be compared against
            real evidence.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {error && <ErrorState message={error} />}

        {!error && !categories && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading categories...
          </div>
        )}

        {categories && categories.length === 0 && (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" aria-hidden="true" />}
            title="No assessment categories are configured yet"
            description="An administrator needs to configure the assessment categories before test sets can be published."
          />
        )}

        {categories && categories.length > 0 && (
          <ul className="grid gap-5 sm:grid-cols-2">
            {categories.map((category) => (
              <li key={category._id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-navy-900">{category.name}</h2>
                    <Badge tone={category.scoringModel === 'preference' ? 'warning' : 'info'}>
                      {category.scoringModel === 'preference' ? 'Preference instrument' : 'Objectively scored'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{category.description}</p>
                  {category.scoringModel === 'preference' ? (
                    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                      Working-preference results describe the kind of work you prefer. They are not personality types,
                      abilities or psychological findings, and they never limit the careers you can pursue.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                      <li>Scored automatically from the stored answer key.</li>
                      <li>Time limit enforced by the server.</li>
                      <li>Explanations are shown after submission.</li>
                    </ul>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-sm font-semibold text-navy-900">A note on scores</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Scores are reported per assessment as a percentage of the scorable items in that test. They are not
            compared against other candidates, and no percentile rank, grade or cohort comparison is produced. A
            higher percentage means more of the items in that particular test were answered correctly - nothing more.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Category key: {Object.values(CATEGORY_LABELS).join(', ')}.
          </p>
        </div>

        <div className="mt-8">
          <Link to="/register" className="btn btn-primary">
            Start assessing
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

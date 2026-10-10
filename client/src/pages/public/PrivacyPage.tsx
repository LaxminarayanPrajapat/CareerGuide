import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Card } from '../../components/common';

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">Privacy policy and AI advice disclaimer</h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Assessment responses, skill profiles and career reports are treated as sensitive records. This page
            explains what is stored, who can see it, and the limits of the advice the system produces.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-4 py-14 sm:px-6 lg:px-8">
        <Card title="What is collected">
          <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
            <li>Account details: name, email address, role and password (stored only as a bcrypt hash).</li>
            <li>Optional academic profile: institution, department, year, batch, objective and interests.</li>
            <li>Assessment activity: which questions you answered, your selections, timing, and the resulting scores.</li>
            <li>Derived data: your skill profile, its revision history, generated reports and roadmap progress.</li>
            <li>Audit events: sign-in, submission and administrative actions, without passwords or raw answer payloads.</li>
          </ul>
        </Card>

        <Card title="Who can see what">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Candidate</td>
                  <td>Own profile, answers, results, reports and roadmaps only.</td>
                </tr>
                <tr>
                  <td className="font-medium">Counsellor</td>
                  <td>Records of candidates explicitly assigned to them, plus the shared question bank and test sets.</td>
                </tr>
                <tr>
                  <td className="font-medium">Management</td>
                  <td>Aggregate analytics and exports only. Individual candidate records are not available.</td>
                </tr>
                <tr>
                  <td className="font-medium">Administrator</td>
                  <td>Platform configuration, user accounts, master data and audit logs.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            These restrictions are enforced by the API on every request, not only by hiding buttons in the interface.
          </p>
        </Card>

        <Card title="Security measures">
          <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
            <li>Passwords are hashed with bcrypt using a per-password salt and a deliberately high work factor.</li>
            <li>Sessions use an httpOnly, SameSite cookie with CSRF protection on every state-changing request.</li>
            <li>All inputs are validated against a schema before reaching the database, and queries are parameterised.</li>
            <li>Repeated failed sign-ins temporarily lock an account and raise an audit event.</li>
            <li>AI provider credentials are held only in server environment variables and are never sent to the browser.</li>
          </ul>
        </Card>

        <Card title="How the AI component is used">
          <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
            <li>Scores and career rankings are computed by a deterministic, versioned algorithm - not by a language model.</li>
            <li>If an AI provider is configured, it receives only the already-computed evidence and writes the narrative explanation.</li>
            <li>Its output is validated against a strict schema; unknown career references and malformed responses are rejected.</li>
            <li>If no provider is configured, or the request fails or times out, the report still generates using clearly labelled template text.</li>
            <li>AI text never influences permissions, scores or which careers appear in a report.</li>
          </ul>
        </Card>

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">Important: limits of this advice</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-900">
            <li>
              A <strong>career compatibility score</strong> compares your measured competencies with a career
              definition. It is <strong>not</strong> a probability of getting a job, a hiring prediction, or a
              guarantee of success in any profession.
            </li>
            <li>
              Working-preference results describe the kind of work you prefer. They are{' '}
              <strong>not</strong> psychological, clinical or diagnostic findings and must not be used as such.
            </li>
            <li>
              No psychometric validity, prediction accuracy or placement-success figure is claimed anywhere in this
              system.
            </li>
            <li>
              Recommendations depend on the quality of the assessments, the accuracy of the career catalogue and the
              documented scoring assumptions. Missing evidence lowers confidence rather than implying low ability.
            </li>
            <li>
              Discuss your report with a qualified counsellor before making academic or career decisions.
            </li>
          </ul>
        </div>

        <Card title="Contact and data handling">
          <p className="text-sm leading-relaxed text-slate-600">
            This is an academic project. Data you enter is stored in the MongoDB instance configured by the operator of
            this deployment. To request correction or deletion of your records, contact your institution's
            administrator, who can deactivate your account and manage the underlying data.
          </p>
        </Card>

        <Link to="/register" className="btn btn-primary">
          Create an account
        </Link>
      </section>
    </PublicLayout>
  );
}

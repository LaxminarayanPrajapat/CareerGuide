import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Card } from '../components/common';

export default function UnauthorizedPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-navy-900">You do not have access to this page</h1>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Your account role does not include the permission required for this area. If you believe this is a
              mistake, contact your administrator or career counsellor.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/dashboard" className="btn btn-primary">
                Go to my dashboard
              </Link>
              <Link to="/" className="btn btn-secondary">
                Back to home
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}

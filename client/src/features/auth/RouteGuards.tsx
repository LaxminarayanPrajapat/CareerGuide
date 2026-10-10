import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AppLayout } from '../../components/layout/AppLayout';
import { LoadingBlock } from '../../components/common';
import type { Role } from '../../types';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm px-6">
        <LoadingBlock label="Checking your session" />
      </div>
    </div>
  );
}

/** Requires a signed-in session; sends anonymous visitors to the login page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/**
 * Requires a signed-in session plus one of the given roles.
 * This mirrors the server-side permission matrix; it hides UI affordances but
 * the API independently rejects unauthorised requests.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return <AppLayout>{children}</AppLayout>;
}

/** Blocks signed-in users from the login / register screens. */
export function RequireAnonymous({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <FullPageLoader />;
  if (isAuthenticated && user) {
    const home =
      user.role === 'admin'
        ? '/admin'
        : user.role === 'counsellor'
          ? '/counsellor'
          : user.role === 'management'
            ? '/management'
            : '/dashboard';
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}

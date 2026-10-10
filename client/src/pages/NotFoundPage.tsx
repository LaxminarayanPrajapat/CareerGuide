import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';

export default function NotFoundPage({ children }: { children: ReactNode }) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">{children}</div>
    </PublicLayout>
  );
}

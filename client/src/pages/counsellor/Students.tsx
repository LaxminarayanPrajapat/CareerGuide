import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api } from '../../lib/api';
import type { User } from '../../types';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { SearchFilters } from '../../components/common/Pagination';
import { formatRelative } from '../../lib/format';

export default function StudentsPage() {
  const [students, setStudents] = useState<User[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<{ students: User[] }>('/analytics/students', {
        search: search || undefined,
      });
      setStudents(data.students);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [search]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">My students</h1>
        <p className="mt-1 text-sm text-slate-600">
          Only candidates assigned to you are listed. This restriction is enforced by the API.
        </p>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!students && !error && <Skeleton className="h-64 w-full" />}

      {students && (
        <Card bodyClassName="p-0">
          <SearchFilters search={search} onSearchChange={setSearch} searchPlaceholder="Search by name or email..." />
          {students.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Users className="h-8 w-8" aria-hidden="true" />}
                title="No students match"
                description="Try a different search term, or ask an administrator to assign candidates to you."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Batch</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last active</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td className="font-medium text-navy-900">{student.fullName}</td>
                      <td className="text-slate-600">{student.email}</td>
                      <td className="whitespace-nowrap text-slate-600">
                        {student.studentProfile?.batch ?? '-'}
                      </td>
                      <td className="text-slate-600">{student.studentProfile?.department ?? '-'}</td>
                      <td>
                        <Badge tone={student.isActive ? 'success' : 'danger'}>
                          {student.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {formatRelative(student.lastLoginAt)}
                      </td>
                      <td className="text-right">
                        <Link to={`/counsellor/students/${student.id}`} className="btn btn-sm btn-secondary">
                          View record
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

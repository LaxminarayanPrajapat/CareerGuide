import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({ page, totalPages, total, limit, onPageChange, label = 'records' }: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages: number[] = [];
  const window = 2;
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= window) pages.push(i);
    else if (pages[pages.length - 1] !== -1) pages.push(-1);
  }

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row"
      aria-label="Pagination"
    >
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>-
        <span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span> {label}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((p, index) =>
            p === -1 ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={
                  p === page
                    ? 'btn btn-sm bg-navy-800 text-white'
                    : 'btn btn-sm btn-secondary min-w-[32px] px-2'
                }
              >
                {p}
              </button>
            ),
          )}
        </div>
        <span className="px-2 text-xs text-slate-500 sm:hidden">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

interface SearchFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}

/** Search box plus optional filter controls, shared by every list screen. */
export function SearchFilters({ search, onSearchChange, searchPlaceholder = 'Search...', children }: SearchFilterProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <label className="sr-only" htmlFor="search-input">
          {searchPlaceholder}
        </label>
        <input
          id="search-input"
          type="search"
          className="input"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = `filter-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} className="input w-auto min-w-[140px]" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

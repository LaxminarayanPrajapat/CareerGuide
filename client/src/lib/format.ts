import type { Role, User } from '../types';

export const CATEGORY_LABELS: Record<string, string> = {
  aptitude: 'Aptitude',
  logical_reasoning: 'Logical Reasoning',
  technical_knowledge: 'Technical Knowledge',
  domain_knowledge: 'Domain Knowledge',
  personality: 'Working Preferences',
};

export const CATEGORY_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  aptitude: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  logical_reasoning: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  technical_knowledge: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  domain_knowledge: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  personality: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  counsellor: 'Counsellor',
  management: 'Management',
  student: 'Candidate',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

/** Human-friendly rendering for raw status values. */
export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (Number.isNaN(minutes)) return '-';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

export function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined) return '-';
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** mm:ss for the assessment countdown. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function scoreColour(score: number): string {
  if (score >= 75) return 'text-emerald-700';
  if (score >= 50) return 'text-blue-700';
  if (score >= 30) return 'text-amber-700';
  return 'text-red-700';
}

export function scoreBarColour(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-blue-500';
  if (score >= 30) return 'bg-amber-500';
  return 'bg-red-400';
}

export function confidenceBadge(confidence: string): string {
  if (confidence === 'good') return 'badge-success';
  if (confidence === 'moderate') return 'badge-warning';
  return 'badge-neutral';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function hasPermission(user: User | null, permission: string): boolean {
  return Boolean(user?.permissions?.includes(permission));
}

/** The landing page for each role after signing in. */
export function homeRouteForRole(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'counsellor':
      return '/counsellor';
    case 'management':
      return '/management';
    default:
      return '/dashboard';
  }
}

export const STORAGE_KEY = 'careerguide:preferences';

export function loadPreferences(): { reduceMotion: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { reduceMotion: false };
    return { reduceMotion: JSON.parse(raw).reduceMotion === true };
  } catch {
    return { reduceMotion: false };
  }
}

export function savePreferences(value: { reduceMotion: boolean }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* storage may be unavailable in private mode - preferences are optional */
  }
}

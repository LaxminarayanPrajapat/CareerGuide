import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Users,
  Brain,
  BookOpen,
  BarChart3,
  Database,
  Settings,
  ScrollText,
  GraduationCap,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  Menu as MenuIcon,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { hasPermission, initials, roleLabel } from '../../lib/format';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  end?: boolean;
}

/** Single navigation definition shared by the sidebar and the mobile drawer. */
export function navItemsForRole(role: string, permissions: string[]): NavItem[] {
  const allow = (p?: string) => (p ? permissions.includes(p) : true);

  const candidate: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/assessments', label: 'Assessments', icon: ClipboardList },
    { to: '/reports', label: 'Career Reports', icon: FileText },
    { to: '/roadmaps', label: 'Learning Roadmaps', icon: BookOpen, permission: 'roadmaps:manage-own' },
    { to: '/profile', label: 'My Profile', icon: UserIcon },
    { to: '/careers', label: 'Career Catalogue', icon: GraduationCap, permission: 'careers:read' },
  ];

  const counsellor: NavItem[] = [
    { to: '/counsellor', label: 'Counsellor Dashboard', icon: LayoutDashboard, end: true },
    { to: '/counsellor/students', label: 'My Students', icon: Users },
    { to: '/counsellor/questions', label: 'Question Bank', icon: Database, permission: 'questions:read' },
    { to: '/counsellor/assessments', label: 'Test Sets', icon: ClipboardList, permission: 'assessments:read' },
    { to: '/counsellor/analytics', label: 'Batch Analytics', icon: BarChart3 },
  ];

  const management: NavItem[] = [
    { to: '/management', label: 'Institutional Dashboard', icon: LayoutDashboard, end: true },
    { to: '/management/analytics', label: 'Aggregate Analytics', icon: BarChart3 },
    { to: '/management/reports', label: 'Aggregate Exports', icon: FileText },
    { to: '/careers', label: 'Career Catalogue', icon: GraduationCap },
  ];

  const admin: NavItem[] = [
    { to: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'User Management', icon: Users, permission: 'users:read' },
    { to: '/admin/questions', label: 'Question Bank', icon: Database, permission: 'questions:read' },
    { to: '/admin/assessments', label: 'Test Sets', icon: ClipboardList, permission: 'assessments:read' },
    { to: '/admin/careers', label: 'Career Catalogue', icon: GraduationCap, permission: 'careers:read' },
    { to: '/admin/skills', label: 'Skill Catalogue', icon: Brain, permission: 'skills:read' },
    { to: '/admin/categories', label: 'Assessment Categories', icon: ClipboardList, permission: 'categories:read' },
    { to: '/admin/settings', label: 'System Settings', icon: Settings, permission: 'settings:read' },
    { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText, permission: 'audit:read' },
    { to: '/admin/analytics', label: 'System Analytics', icon: BarChart3, permission: 'analytics:system' },
  ];

  const base = role === 'admin' ? admin : role === 'counsellor' ? counsellor : role === 'management' ? management : candidate;
  return base.filter((item) => allow(item.permission));
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasPermission: can } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;
  const items = navItemsForRole(user.role, user.permissions);

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main navigation">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">
          CG
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">AI Career Guide</p>
          <p className="truncate text-[11px] text-navy-300">{roleLabel(user.role)} workspace</p>
        </div>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-navy-700 text-white'
                      : 'text-navy-200 hover:bg-navy-800 hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-navy-700 px-5 py-3">
        <p className="truncate text-xs text-navy-300">{user.email}</p>
        <p className="text-[11px] text-navy-400">Signed in as {roleLabel(user.role)}</p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy-900 lg:flex">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex h-full w-64 flex-col bg-navy-900">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded p-1.5 text-navy-300 hover:bg-navy-800 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="rounded p-1.5 text-navy-700 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy-900">
              {items.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))?.label ??
                'AI Career Guide'}
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white">
                {initials(user.fullName)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-medium text-navy-900">{user.fullName}</span>
                <span className="block text-[11px] text-slate-500">{roleLabel(user.role)}</span>
              </span>
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-raised"
                >
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-xs font-medium text-navy-900">{user.fullName}</p>
                    <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                  </div>
                  <NavLink to="/profile" role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                    <UserIcon className="h-4 w-4" aria-hidden="true" /> Profile &amp; settings
                  </NavLink>
                  {can('settings:read') && (
                    <NavLink to="/admin/settings" role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                      <Settings className="h-4 w-4" aria-hidden="true" /> System settings
                    </NavLink>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { MenuIcon };

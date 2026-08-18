import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, Users, Package, CreditCard,
  ListTodo, MessageSquare, ScrollText, Settings, Menu, ExternalLink, LogOut,
} from 'lucide-react';
import { Logo } from '../components/layout/Logo.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { cn } from '../lib/cn.js';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/verifications', label: 'Verifications', icon: ShieldCheck },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/items', label: 'Listings', icon: Package },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

/**
 * Admin shell.
 *
 * Same brand palette as the marketplace — purple structure, orange for actions.
 * The console reads as the same product, not a separate bolted-on tool, which
 * was the main visual complaint about v1.
 */
export const AdminLayout = () => {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Admin">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo variant="light" imgClassName="h-8" />
        <span className="ml-2 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Admin
        </span>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-orange-500 text-white shadow-sm' : 'text-purple-100/75 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <entry.icon size={17} aria-hidden="true" />
            {entry.label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-white/10 p-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-purple-100/80 transition hover:bg-white/10 hover:text-white"
        >
          <ExternalLink size={17} aria-hidden="true" />
          View the marketplace
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-purple-100/80 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={17} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-canvas-sunken">
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-purple-800 lg:block">{sidebar}</aside>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-purple-900/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-purple-800 lg:hidden">{sidebar}</aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-ink-soft hover:bg-canvas-sunken lg:hidden"
            aria-label="Open admin menu"
          >
            <Menu size={20} />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-ink">{user?.full_name}</p>
              <p className="text-2xs uppercase tracking-wide text-ink-muted">{user?.role?.replace('_', ' ')}</p>
            </div>
            <Avatar src={user?.avatar_url} name={user?.full_name} size="sm" />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

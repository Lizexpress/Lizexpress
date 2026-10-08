import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Settings, Package, Heart, Shield, Megaphone } from 'lucide-react';
import { SmartLink as Link, SmartNavLink as NavLink } from '../ui/SmartLink.jsx';
import { Logo } from './Logo.jsx';
import { NotificationMenu } from './NotificationMenu.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotifications } from '../../hooks/useNotifications.js';
import { cn } from '../../lib/cn.js';

/**
 * Purple header, carried over from v1. Nav is sentence case, the account control is
 * an orange pill, and hover states go orange — all as they were.
 */
// Sentence case reads calmer than the old ALL-CAPS nav. The focus outline is
// white on purple; the global brand-purple ring was invisible against the bar.
const linkClass = ({ isActive }) =>
  cn(
    'rounded-full px-3 py-1 text-[15px] font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-0',
    isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:text-white',
  );

export const Header = () => {
  const { user, isAuthenticated, isStaff, signOut } = useAuth();
  const { counts } = useNotifications();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    const away = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const onSignOut = async () => {
    setAccountOpen(false);
    await signOut();
    navigate('/');
  };

  const accountLinks = [
    { to: '/dashboard', label: 'My Profile', icon: User },
    { to: '/dashboard/listings', label: 'My Listings', icon: Package },
    { to: '/dashboard/adverts', label: 'My Adverts', icon: Megaphone },
    { to: '/dashboard/favorites', label: 'Saved Items', icon: Heart },
    { to: '/settings', label: 'Settings', icon: Settings },
    ...(isStaff ? [{ to: '/admin', label: 'Admin Console', icon: Shield }] : []),
  ];

  return (
    <header className="relative z-50 bg-purple-600 py-1.5 text-white shadow-md">
      <div className="container-page flex items-center justify-between gap-3">
        <Logo variant="light" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/browse" className={linkClass}>Swap</NavLink>
          <NavLink to="/adverts" className={linkClass}>Adverts</NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
              <NavLink to="/list-item" className={linkClass}>List an item</NavLink>
            </>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <NotificationMenu unreadCount={counts.notifications} tone="dark" />

              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full bg-orange-500 px-3 py-1.5 font-bold text-white transition-colors hover:bg-orange-600"
                >
                  <span className="h-8 w-8 overflow-hidden rounded-full bg-white">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-purple-600">
                        <User size={16} className="text-white" />
                      </span>
                    )}
                  </span>
                  <span className="hidden max-w-[9rem] truncate lg:inline">
                    {user?.full_name ?? 'My Account'}
                  </span>
                </button>

                {accountOpen && (
                  <div role="menu" className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-md bg-white py-1 shadow-lg">
                    {accountLinks.map((entry) => (
                      <Link
                        key={entry.to}
                        to={entry.to}
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <entry.icon size={16} />
                        {entry.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="ml-2 rounded-full bg-accent-500 px-4 py-2 text-[15px] font-medium text-ink transition-colors hover:bg-accent-400"
            >
              Sign in
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          {isAuthenticated && <NotificationMenu unreadCount={counts.notifications} tone="dark" />}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="rounded p-2 text-white transition-colors hover:text-orange-500"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-purple-600 md:hidden">
          <nav className="container-page grid gap-1 py-3" aria-label="Mobile">
            <NavLink to="/" end onClick={() => setMobileOpen(false)} className="py-2.5 text-white hover:text-orange-500">Home</NavLink>
            <NavLink to="/browse" onClick={() => setMobileOpen(false)} className="py-2.5 text-white hover:text-orange-500">Swap</NavLink>
            <NavLink to="/adverts" onClick={() => setMobileOpen(false)} className="py-2.5 text-white hover:text-orange-500">Adverts</NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard" onClick={() => setMobileOpen(false)} className="py-2.5 text-white hover:text-orange-500">Dashboard</NavLink>
                <NavLink to="/list-item" onClick={() => setMobileOpen(false)} className="py-2.5 text-white hover:text-orange-500">List an item</NavLink>
                <NavLink to="/chats" onClick={() => setMobileOpen(false)} className="py-2.5 text-white hover:text-orange-500">Messages</NavLink>
                <NavLink to="/settings" onClick={() => setMobileOpen(false)} className="py-2.5 text-white hover:text-orange-500">Settings</NavLink>
                <button type="button" onClick={onSignOut} className="py-2.5 text-left text-white hover:text-orange-500">Sign out</button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-full bg-orange-500 px-6 py-2.5 text-center font-bold text-white"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;

import { SmartNavLink as NavLink } from '../ui/SmartLink.jsx';
import { Home, Search, PlusCircle, MessageCircle, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotifications } from '../../hooks/useNotifications.js';
import { cn } from '../../lib/cn.js';

/**
 * Bottom navigation for handsets.
 *
 * Placed at the bottom because that is where thumbs reach, with the primary
 * create action in the centre — the easiest position to hit one-handed. Sits
 * above the iOS home indicator via the safe-area inset.
 */
export const MobileNav = () => {
  const { isAuthenticated } = useAuth();
  const { counts } = useNotifications();

  const links = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/browse', label: 'Browse', icon: Search },
    { to: '/list-item', label: 'List', icon: PlusCircle, primary: true },
    { to: '/chats', label: 'Chats', icon: MessageCircle, badge: counts.messages },
    { to: isAuthenticated ? '/dashboard' : '/login', label: isAuthenticated ? 'You' : 'Sign in', icon: LayoutDashboard },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md pb-[var(--safe-bottom)] lg:hidden"
    >
      <div className="mx-auto flex h-[var(--nav-height)] max-w-lg items-stretch">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors',
                isActive ? 'text-purple-700' : 'text-ink-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <link.icon
                    size={link.primary ? 26 : 21}
                    className={cn(link.primary && 'text-orange-500')}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    aria-hidden="true"
                  />
                  {link.badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
                      {link.badge > 9 ? '9+' : link.badge}
                    </span>
                  )}
                </span>
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;

import { forwardRef, useCallback } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { prefetchRoute } from '../../routes/routeMap.js';

/**
 * A Link that fetches the destination's chunk before the click lands.
 *
 * Pointer intent gives roughly 100–300ms of warning on desktop, and
 * touchstart fires ~80ms before the tap completes on mobile. That window is
 * usually enough to have the chunk in memory by the time the route changes,
 * so the loading fallback never appears.
 *
 * onFocus is included so keyboard users get the same benefit.
 */
const usePrefetchHandlers = (to) => {
  const warm = useCallback(() => {
    if (typeof to === 'string') prefetchRoute(to);
  }, [to]);

  return {
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm,
  };
};

export const SmartLink = forwardRef(({ to, children, ...props }, ref) => (
  <Link ref={ref} to={to} {...usePrefetchHandlers(to)} {...props}>
    {children}
  </Link>
));
SmartLink.displayName = 'SmartLink';

export const SmartNavLink = forwardRef(({ to, children, ...props }, ref) => (
  <NavLink ref={ref} to={to} {...usePrefetchHandlers(to)} {...props}>
    {children}
  </NavLink>
));
SmartNavLink.displayName = 'SmartNavLink';

export default SmartLink;

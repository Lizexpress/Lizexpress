/**
 * Absolute URL on the public site.
 *
 * The admin console runs on admin.lizexpressltd.com, where only /admin routes
 * exist. A plain <Link to="/items/1"> there lands on the admin catch-all, so any
 * admin link to a public page must leave the admin host. On localhost both
 * trees run on one origin, so the path is returned unchanged.
 */
export const publicUrl = (path = '/') => {
  if (typeof window === 'undefined') return path;
  const { protocol, hostname, port } = window.location;
  if (!hostname.startsWith('admin.')) return path;
  const host = hostname.replace(/^admin\./, '');
  return `${protocol}//${host}${port ? `:${port}` : ''}${path}`;
};

export default publicUrl;

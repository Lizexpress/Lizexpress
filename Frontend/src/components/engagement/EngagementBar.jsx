import Icon from '../ui/Icon.jsx';
import { cn } from '../../lib/cn.js';
import { number } from '../../lib/format.js';

/**
 * Like · comment · save · share, with counts — the row people already know
 * from Instagram and Facebook, so nobody has to learn it.
 *
 * Counts are shown beside each action rather than in a separate sentence:
 * a vendor scanning their own advert should see "24 likes" without reading.
 */
export const EngagementBar = ({ engagement, title, onComment, className }) => {
  const { counts, liked, saved, toggleLike, toggleSave, share } = engagement;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Action
        icon="favorite"
        filled={liked}
        active={liked}
        activeClass="text-danger"
        label={liked ? 'Unlike' : 'Like'}
        count={counts.likes}
        onClick={toggleLike}
        pop
      />
      <Action icon="chat_bubble" label="Comments" count={counts.comments} onClick={onComment} />
      <Action icon="share" label="Share" count={counts.shares} onClick={() => share({ title })} />
      <span className="flex-1" />
      <Action
        icon="bookmark"
        filled={saved}
        active={saved}
        activeClass="text-brand-600"
        label={saved ? 'Remove from saved' : 'Save'}
        count={counts.saves}
        onClick={toggleSave}
      />
    </div>
  );
};

const Action = ({ icon, filled, active, activeClass, label, count, onClick, pop }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active === undefined ? undefined : active}
    aria-label={`${label}${count ? `, ${count}` : ''}`}
    className={cn(
      'group inline-flex h-10 items-center gap-1 rounded-full px-2 transition-colors hover:bg-canvas-sunken',
      active ? activeClass : 'text-ink-soft hover:text-ink',
    )}
  >
    <Icon
      name={icon}
      filled={filled}
      size="lg"
      className={cn('transition-transform duration-200 group-active:scale-90', pop && active && 'animate-[pop_0.3s_ease-out]')}
    />
    {count > 0 && <span className="mono text-sm">{number(count)}</span>}
  </button>
);

export default EngagementBar;

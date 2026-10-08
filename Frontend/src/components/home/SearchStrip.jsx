import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { cn } from '../../lib/cn.js';

/** Category list is shared with the footer so the two cannot disagree. */
export const CATEGORIES = [
  'Electronics', 'Furniture', 'Computer', 'Phones', 'Clothing',
  'Vehicles', 'Books', 'Sports', 'Baby & Kids', 'Services', 'Others',
];

/**
 * The orange search band under the hero.
 *
 * One search box with a two-way switch: swap items or business adverts. The
 * category dropdown only appears for items, because adverts are searched by
 * place, not by item category.
 */
export const SearchStrip = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('items');
  const [category, setCategory] = useState('');

  const onSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (mode === 'items' && category) params.set('category', category);
    navigate(`${mode === 'items' ? '/browse' : '/adverts'}${params.size ? `?${params}` : ''}`);
  };

  return (
    <section className="bg-accent-500">
      <div className="container-page py-4">
        <form onSubmit={onSubmit} role="search" className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="inline-flex shrink-0 self-start rounded-full bg-ink/10 p-1 lg:self-auto" role="group" aria-label="Search in">
            {[
              ['items', 'Swap items'],
              ['adverts', 'Businesses'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  'rounded-full px-4 py-1 text-sm transition-colors',
                  mode === value ? 'bg-canvas font-medium text-ink shadow-xs' : 'text-ink/80 hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={mode === 'items' ? 'What are you looking for, or want to swap?' : 'Caterer, tailor, phone repair…'}
                aria-label="Search"
                className="field border-transparent pl-12 shadow-xs"
              />
            </div>
            {mode === 'items' && (
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Category"
                className="field border-transparent shadow-xs sm:w-48"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            )}
            <button type="submit" className="btn-primary shrink-0 px-6">Search</button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default SearchStrip;

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** Category list is shared with the footer so the two cannot disagree. */
export const CATEGORIES = [
  'Electronics', 'Furniture', 'Computer', 'Phones', 'Clothing',
  'Vehicles', 'Books', 'Sports', 'Baby & Kids', 'Services', 'Others',
];

/**
 * The orange search band that sits directly under the hero, as in v1.
 * Kept as a full-bleed brand strip because it is the visual seam between the
 * carousel and the catalogue.
 */
export const SearchStrip = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const onSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category !== 'all') params.set('category', category);
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <section className="bg-orange-500">
      <div className="container-page py-3.5">
        <form
          onSubmit={onSubmit}
          role="search"
          className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <p className="text-center text-sm font-medium text-white lg:text-left">
            Swap and advertise your goods and services.
          </p>

          <div className="flex w-full flex-col gap-2.5 sm:flex-row lg:w-auto lg:flex-[0_1_36rem]">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items or what people want in return"
                aria-label="Search items"
                className="h-11 w-full rounded-xl border border-transparent bg-white pl-10 pr-3 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-purple-700"
              />
            </div>

            <label className="sr-only" htmlFor="home-category">Category</label>
            <select
              id="home-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 cursor-pointer rounded-xl border border-transparent bg-purple-600 px-3.5 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-white sm:w-44"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>

            <button
              type="submit"
              className="h-11 shrink-0 rounded-xl bg-purple-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Search
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default SearchStrip;

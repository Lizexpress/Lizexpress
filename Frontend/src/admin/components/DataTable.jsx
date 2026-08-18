import { RowsSkeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { cn } from '../../lib/cn.js';

/**
 * Shared admin table.
 *
 * Collapses to stacked cards below `md` — an admin checking the queue from a
 * phone should not have to pinch-zoom a horizontally scrolling table.
 */
export const DataTable = ({ columns, rows, isLoading, meta, onPageChange, emptyState, onRowClick, rowKey = (row) => row.id }) => {
  if (isLoading) return <RowsSkeleton count={6} />;
  if (!rows?.length) return emptyState ?? <EmptyState title="Nothing here yet" />;

  return (
    <>
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas-sunken text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cn('px-4 py-3 font-semibold', column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer transition hover:bg-canvas-sunken')}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('card p-4', onRowClick && 'cursor-pointer active:bg-canvas-sunken')}
          >
            {columns.map((column) => (
              <div key={column.key} className="flex items-start justify-between gap-3 py-1 text-sm">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-faint">{column.header}</span>
                <span className="min-w-0 text-right">{column.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {meta && meta.totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination">
          <p className="text-sm text-ink-muted">
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => onPageChange(meta.page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => onPageChange(meta.page + 1)}>
              Next
            </Button>
          </div>
        </nav>
      )}
    </>
  );
};

export default DataTable;

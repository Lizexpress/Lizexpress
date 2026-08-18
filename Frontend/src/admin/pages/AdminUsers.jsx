import { useCallback, useEffect, useState } from 'react';
import { Search, Ban, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Textarea, Select } from '../../components/ui/Input.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { dateLong, timeAgo } from '../../lib/format.js';

const STATUS_FILTERS = [
  ['', 'All'],
  ['verified', 'Verified'],
  ['unverified', 'Unverified'],
  ['pending_verification', 'Awaiting review'],
  ['suspended', 'Suspended'],
];

const AdminUsers = () => {
  const { isSuperAdmin, user: currentUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');

  const load = useCallback(() => {
    setIsLoading(true);
    endpoints.admin
      .users({ page, limit: 20, search: debouncedSearch || undefined, status: status || undefined })
      .then(({ data, meta: pageMeta }) => {
        setRows(data);
        setMeta(pageMeta);
      })
      .finally(() => setIsLoading(false));
  }, [page, debouncedSearch, status]);

  useEffect(load, [load]);

  const toggleSuspension = async (target, suspended) => {
    if (suspended && suspendReason.trim().length < 3) {
      toast.error('Give a reason — the member is told why.');
      return;
    }
    try {
      await endpoints.admin.suspendUser(target.id, { suspended, reason: suspended ? suspendReason.trim() : undefined });
      toast.success(suspended ? 'Account suspended and the member notified.' : 'Account reinstated.');
      setSelected(null);
      setSuspendReason('');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const changeRole = async (target, role) => {
    try {
      await endpoints.admin.setRole(target.id, role);
      toast.success('Role updated.');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    {
      key: 'user',
      header: 'Member',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={row.avatar_url} name={row.full_name} size="sm" verified={row.is_verified} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.full_name ?? 'Unnamed'}</p>
            <p className="truncate text-2xs text-ink-faint">{[row.city, row.country].filter(Boolean).join(', ') || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.is_suspended ? (
          <Badge tone="danger" size="sm">Suspended</Badge>
        ) : row.is_verified ? (
          <Badge tone="success" size="sm">Verified</Badge>
        ) : row.verification_submitted ? (
          <Badge tone="warning" size="sm">Awaiting review</Badge>
        ) : (
          <Badge tone="muted" size="sm">Unverified</Badge>
        ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <span className="text-sm capitalize text-ink-soft">{row.role?.replace('_', ' ')}</span>,
    },
    { key: 'joined', header: 'Joined', render: (row) => <span className="text-ink-soft">{dateLong(row.created_at)}</span> },
    {
      key: 'seen',
      header: 'Last seen',
      render: (row) => <span className="text-ink-muted">{row.last_seen_at ? timeAgo(row.last_seen_at) : 'Never'}</span>,
    },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(row)}>Manage</Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Members" description="Search, verify, suspend, and assign roles." />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full flex-1 sm:min-w-[16rem]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or country"
            aria-label="Search members"
            className="h-10 w-full rounded-lg border border-line-strong bg-white pl-9 pr-3 text-sm focus:border-purple-400 focus:outline-none"
          />
        </div>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          containerClassName="w-full sm:w-48 sm:flex-none"
          className="h-10"
        >
          {STATUS_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      <DataTable columns={columns} rows={rows} isLoading={isLoading} meta={meta} onPageChange={setPage} />

      <Modal
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setSuspendReason('');
        }}
        title={selected?.full_name ?? 'Member'}
        description={[selected?.city, selected?.country].filter(Boolean).join(', ')}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar src={selected.avatar_url} name={selected.full_name} size="lg" verified={selected.is_verified} />
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-1.5 text-ink-soft">
                  <ShieldCheck size={14} className={selected.is_verified ? 'text-success' : 'text-ink-faint'} />
                  {selected.is_verified ? 'Identity verified' : 'Not verified'}
                </p>
                <p className="text-ink-muted">Joined {dateLong(selected.created_at)}</p>
              </div>
            </div>

            {isSuperAdmin && selected.id !== currentUser?.id && (
              <div>
                <Select
                  label="Role"
                  value={selected.role}
                  onChange={(event) => changeRole(selected, event.target.value)}
                  hint="Only a super admin can grant super admin."
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </Select>
              </div>
            )}

            {selected.is_suspended ? (
              <div className="rounded-xl border border-danger/25 bg-danger-soft p-4">
                <p className="text-sm font-semibold text-danger">This account is suspended</p>
                {selected.suspension_reason && (
                  <p className="mt-1 text-sm text-danger/90">{selected.suspension_reason}</p>
                )}
                <Button variant="outline" size="sm" className="mt-3" onClick={() => toggleSuspension(selected, false)}>
                  Reinstate account
                </Button>
              </div>
            ) : (
              <div className="border-t border-line pt-4">
                <Textarea
                  label="Suspend this account"
                  value={suspendReason}
                  onChange={(event) => setSuspendReason(event.target.value)}
                  placeholder="Repeated reports of misrepresenting item condition."
                  hint="Emailed to the member. They lose access on their next request."
                  rows={2}
                />
                <Button variant="danger" size="sm" icon={Ban} className="mt-3" onClick={() => toggleSuspension(selected, true)}>
                  Suspend account
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default AdminUsers;

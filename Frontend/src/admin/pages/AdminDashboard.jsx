import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, CreditCard, ShieldCheck, TrendingUp, Activity } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { endpoints } from '../../lib/api.js';
import { money, number } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const Metric = ({ icon: Icon, label, value, sub, tone = 'text-purple-500', isLoading }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <Icon size={19} className={tone} aria-hidden="true" />
    </div>
    {isLoading ? (
      <Skeleton className="mt-3 h-8 w-24" />
    ) : (
      <p className="mt-3 font-display text-2xl font-bold text-ink">{value}</p>
    )}
    <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
    {sub && !isLoading && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
  </Card>
);

const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState([]);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      endpoints.admin.overview(),
      endpoints.admin.timeseries(30).catch(() => []),
      endpoints.admin.health().catch(() => null),
    ])
      .then(([data, timeseries, systemHealth]) => {
        setOverview(data);
        setSeries(timeseries ?? []);
        setHealth(systemHealth);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Overview" description="Live figures across the marketplace." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          icon={Users}
          label="Members"
          value={number(overview?.users.total ?? 0)}
          sub={`${overview?.users.newLast7Days ?? 0} joined this week`}
          isLoading={isLoading}
        />
        <Metric
          icon={ShieldCheck}
          label="Verified"
          value={`${overview?.users.verificationRate ?? 0}%`}
          sub={`${number(overview?.users.verified ?? 0)} of ${number(overview?.users.total ?? 0)}`}
          tone="text-success"
          isLoading={isLoading}
        />
        <Metric
          icon={Package}
          label="Live listings"
          value={number(overview?.items.active ?? 0)}
          sub={`${number(overview?.items.swapped ?? 0)} swaps completed`}
          isLoading={isLoading}
        />
        <Metric
          icon={CreditCard}
          label="Revenue, 30 days"
          value={money(overview?.revenue.last30Days ?? 0)}
          sub={`${money(overview?.revenue.allTime ?? 0)} all time`}
          tone="text-orange-500"
          isLoading={isLoading}
        />
      </div>

      {overview?.verifications?.pending > 0 && (
        <Card className="mt-5 border-orange-200 bg-orange-50">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-orange-700" aria-hidden="true" />
              <div>
                <p className="font-semibold text-orange-900">
                  {overview.verifications.pending} submission{overview.verifications.pending === 1 ? '' : 's'} waiting for review
                </p>
                <p className="text-sm text-orange-800">
                  Longest wait: {overview.verifications.oldestWaitingHours}h. Applicants cannot list or message until reviewed.
                </p>
              </div>
            </div>
            <Button as={Link} to="/admin/verifications" size="sm">Open the queue</Button>
          </CardBody>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title="Revenue, last 30 days" description="Settled listing fees per day." />
          <CardBody>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={224}>
                <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E3EC" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#857D8F' }}
                    tickFormatter={(value) => value.slice(5)}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#857D8F' }}
                    tickFormatter={(value) => (value >= 1000 ? `${value / 1000}k` : value)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [money(value), 'Revenue']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E8E3EC', fontSize: 13 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#F7941D" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="System" description="Live checks." />
          <CardBody className="space-y-3">
            {health ? (
              [
                ['Database', health.database, `${health.databaseLatencyMs}ms`],
                ['Email (Resend)', health.email, ''],
                ['Payments', health.payments, ''],
                ['Push notifications', health.push, ''],
              ].map(([label, state, extra]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-soft">{label}</span>
                  <span className="flex items-center gap-2">
                    {extra && <span className="text-xs text-ink-faint">{extra}</span>}
                    <Badge
                      tone={['operational', 'configured'].includes(state) ? 'success' : 'warning'}
                      size="sm"
                    >
                      {state === 'not_configured' ? 'Not set up' : state}
                    </Badge>
                  </span>
                </div>
              ))
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Card className="p-5">
          <Activity size={18} className="text-purple-500" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">{number(overview?.items.awaitingPayment ?? 0)}</p>
          <p className="text-sm text-ink-muted">Listings awaiting payment</p>
        </Card>
        <Card className="p-5">
          <TrendingUp size={18} className="text-purple-500" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">{money(overview?.revenue.averageTicket ?? 0)}</p>
          <p className="text-sm text-ink-muted">Average listing fee</p>
        </Card>
        <Card className={cn('p-5', overview?.users.suspended > 0 && 'border-danger/30')}>
          <Users size={18} className="text-danger" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">{number(overview?.users.suspended ?? 0)}</p>
          <p className="text-sm text-ink-muted">Suspended accounts</p>
        </Card>
      </div>
    </>
  );
};

export default AdminDashboard;

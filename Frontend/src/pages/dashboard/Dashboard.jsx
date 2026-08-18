import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, MessageCircle, Heart, ShieldCheck, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../lib/cn.js';

const Stat = ({ icon: Icon, label, value, to, isLoading }) => (
  <Card as={Link} to={to} interactive className="block p-5">
    <Icon size={19} className="text-purple-500" aria-hidden="true" />
    {isLoading ? (
      <Skeleton className="mt-3 h-7 w-12" />
    ) : (
      <p className="mt-3 font-display text-2xl font-bold text-ink">{value}</p>
    )}
    <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
  </Card>
);

const Dashboard = () => {
  const { user, isVerified } = useAuth();
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    endpoints.users
      .dashboard()
      .then(setSummary)
      .finally(() => setIsLoading(false));
  }, []);

  // Onboarding is a real sequence, so it is numbered and ordered by dependency.
  const steps = [
    { done: true, label: 'Create your account' },
    { done: isVerified, label: 'Verify your identity', to: '/id-verification' },
    { done: (summary?.totalListings ?? 0) > 0, label: 'List your first item', to: '/list-item' },
  ];
  const remaining = steps.filter((step) => !step.done);

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-8">
        <h1 className="text-title font-bold">
          Hello, {user?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-1.5 text-ink-muted">Here is where things stand.</p>
      </header>

      {remaining.length > 0 && (
        <Card className="mb-8 overflow-hidden">
          <div className="border-b border-line bg-canvas-warm px-5 py-3.5">
            <p className="text-sm font-semibold text-ink">
              {steps.filter((step) => step.done).length} of {steps.length} steps done
            </p>
          </div>
          <ol className="divide-y divide-line">
            {steps.map((step, index) => (
              <li key={step.label} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    step.done ? 'bg-success text-white' : 'bg-purple-100 text-purple-700',
                  )}
                  aria-hidden="true"
                >
                  {step.done ? <CheckCircle2 size={14} /> : index + 1}
                </span>
                <span className={cn('flex-1 text-sm', step.done ? 'text-ink-muted line-through' : 'font-medium text-ink')}>
                  {step.label}
                </span>
                {!step.done && step.to && (
                  <Button as={Link} to={step.to} size="sm" variant="ghost" iconRight={ArrowRight}>Start</Button>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Package} label="Active listings" value={summary?.activeListings ?? 0} to="/dashboard/listings" isLoading={isLoading} />
        <Stat icon={MessageCircle} label="Unread messages" value={summary?.unreadMessages ?? 0} to="/chats" isLoading={isLoading} />
        <Stat icon={Heart} label="Saved items" value={summary?.savedItems ?? 0} to="/dashboard/favorites" isLoading={isLoading} />
        <Stat icon={ShieldCheck} label="Completed swaps" value={summary?.swapped ?? 0} to="/dashboard/listings" isLoading={isLoading} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button as={Link} to="/list-item" icon={Plus}>List an item</Button>
        <Button as={Link} to="/browse" variant="outline">Browse the marketplace</Button>
      </div>
    </div>
  );
};

export default Dashboard;

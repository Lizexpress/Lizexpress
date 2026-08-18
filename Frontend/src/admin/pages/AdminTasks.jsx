import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ListTodo } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Textarea, Select } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { RowsSkeleton } from '../../components/ui/Skeleton.jsx';
import { endpoints } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { dateLong } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const PRIORITY_TONES = { high: 'danger', medium: 'warning', low: 'muted' };

const AdminTasks = () => {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });

  const load = useCallback(() => {
    setIsLoading(true);
    endpoints.admin
      .tasks({ limit: 50 })
      .then(({ data }) => setTasks(data))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  const create = async (event) => {
    event.preventDefault();
    try {
      await endpoints.admin.createTask({
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      });
      toast.success('Task added.');
      setIsCreating(false);
      setForm({ title: '', description: '', priority: 'medium', dueDate: '' });
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const setStatus = async (task, status) => {
    await endpoints.admin.updateTask(task.id, { status }).catch(() => {});
    load();
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Internal to-do list for the team."
        action={<Button icon={Plus} onClick={() => setIsCreating(true)}>New task</Button>}
      />

      {isLoading ? (
        <RowsSkeleton count={4} />
      ) : tasks.length ? (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                'flex items-start gap-3 card p-4',
                task.status === 'completed' && 'opacity-60',
              )}
            >
              <input
                type="checkbox"
                checked={task.status === 'completed'}
                onChange={(event) => setStatus(task, event.target.checked ? 'completed' : 'pending')}
                className="mt-1 h-4 w-4 rounded border-line-strong text-purple-600 focus:ring-purple-400"
                aria-label={`Mark "${task.title}" complete`}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('font-medium text-ink', task.status === 'completed' && 'line-through')}>{task.title}</p>
                {task.description && <p className="mt-0.5 text-sm text-ink-muted">{task.description}</p>}
                {task.due_date && <p className="mt-1 text-xs text-ink-faint">Due {dateLong(task.due_date)}</p>}
              </div>
              <Badge tone={PRIORITY_TONES[task.priority]} size="sm">{task.priority}</Badge>
              <button
                type="button"
                onClick={async () => {
                  await endpoints.admin.deleteTask(task.id).catch(() => {});
                  load();
                }}
                className="rounded p-1 text-ink-faint transition hover:text-danger"
                aria-label={`Delete "${task.title}"`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Track follow-ups and internal work here."
          action={<Button icon={Plus} onClick={() => setIsCreating(true)}>Add the first task</Button>}
        />
      )}

      <Modal
        open={isCreating}
        onClose={() => setIsCreating(false)}
        title="New task"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button onClick={create}>Add task</Button>
          </div>
        }
      >
        <form onSubmit={create} className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            data-autofocus
            required
          />
          <Textarea
            label="Details"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Priority"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
            <Input
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AdminTasks;

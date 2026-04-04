import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/features/auth/AuthContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Plus, X, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  ownerId: string;
  startDate: string | null;
  endDate: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignedToId: string | null;
  dueDate: string | null;
  deliverables?: Deliverable[];
}

interface Deliverable {
  id: string;
  title: string;
  fileUrl: string | null;
  notes: string | null;
  submittedAt: string;
}

interface Milestone {
  id: string;
  title: string;
  progressPercent: number;
  dueDate: string | null;
  completedAt: string | null;
}

interface AcceptanceScore {
  id: string;
  score: number;
  maxScore: number;
  feedback: string | null;
  createdAt: string;
}

const PROJECT_TRANSITIONS: Record<string, string[]> = {
  initiation: ['change', 'inspection'],
  change: ['inspection'],
  inspection: ['final_acceptance'],
  final_acceptance: ['archive'],
  archive: [],
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'tasks' | 'milestones' | 'scores'>('tasks');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const [milestoneForm, setMilestoneForm] = useState({ title: '', dueDate: '', progressPercent: '0' });
  const [scoreForm, setScoreForm] = useState({ score: '', feedback: '' });
  const [deliverableForm, setDeliverableForm] = useState<Record<string, { title: string; notes: string }>>({});
  const [confirmTransition, setConfirmTransition] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => apiClient.get(`/projects/${id}`).then((r) => r.data.data as Project),
    enabled: !!id,
  });

  const { data: tasks } = useQuery({
    queryKey: ['projects', id, 'tasks'],
    queryFn: () => apiClient.get(`/projects/${id}/tasks`).then((r) => r.data.data as Task[]),
    enabled: !!id,
  });

  const { data: milestones } = useQuery({
    queryKey: ['projects', id, 'milestones'],
    queryFn: () => apiClient.get(`/projects/${id}/milestones`).then((r) => r.data.data as Milestone[]),
    enabled: !!id,
  });

  const { data: scores } = useQuery({
    queryKey: ['projects', id, 'scores'],
    queryFn: () =>
      apiClient.get(`/projects/${id}/acceptance-score`).then((r) => r.data.data as AcceptanceScore[]),
    enabled: !!id && (user?.role === 'admin' || user?.role === 'supervisor'),
  });

  const canManage = user?.role === 'admin' || user?.role === 'supervisor';

  const advanceStatus = useMutation({
    mutationFn: (status: string) =>
      apiClient.patch(`/projects/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', id] });
      setConfirmTransition(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to advance status.');
    },
  });

  const createTask = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${id}/tasks`, {
        title: taskForm.title,
        description: taskForm.description || undefined,
        dueDate: taskForm.dueDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', id, 'tasks'] });
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', dueDate: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create task.');
    },
  });

  const advanceTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      apiClient.patch(`/projects/${id}/tasks/${taskId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'tasks'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to update task.');
    },
  });

  const submitDeliverable = useMutation({
    mutationFn: ({ taskId, title, notes }: { taskId: string; title: string; notes: string }) =>
      apiClient.post(`/projects/${id}/tasks/${taskId}/deliverables`, {
        title,
        notes: notes || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'tasks'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to submit deliverable.');
    },
  });

  const createMilestone = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${id}/milestones`, {
        title: milestoneForm.title,
        dueDate: milestoneForm.dueDate || undefined,
        progressPercent: Number(milestoneForm.progressPercent),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', id, 'milestones'] });
      setShowAddMilestone(false);
      setMilestoneForm({ title: '', dueDate: '', progressPercent: '0' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create milestone.');
    },
  });

  const updateMilestone = useMutation({
    mutationFn: ({ milestoneId, progressPercent }: { milestoneId: string; progressPercent: number }) =>
      apiClient.patch(`/projects/${id}/milestones/${milestoneId}`, { progressPercent }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'milestones'] }),
  });

  const addScore = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${id}/acceptance-score`, {
        score: Number(scoreForm.score),
        feedback: scoreForm.feedback || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', id, 'scores'] });
      setScoreForm({ score: '', feedback: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to submit score.');
    },
  });

  if (isLoading) return <PageLoader />;
  if (!project) return <p className="p-6 text-sm text-muted-foreground">Project not found.</p>;

  const nextStatuses = PROJECT_TRANSITIONS[project.status] ?? [];
  const overallProgress =
    milestones && milestones.length > 0
      ? Math.round(milestones.reduce((sum, m) => sum + m.progressPercent, 0) / milestones.length)
      : 0;

  return (
    <div className="p-6 max-w-5xl">
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Projects
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-foreground">{project.title}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        {canManage && nextStatuses.length > 0 && (
          <div className="flex gap-2">
            {nextStatuses.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="h-8 capitalize"
                onClick={() => setConfirmTransition(s)}
              >
                → {s.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* Overall progress bar */}
      {(milestones ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Overall Progress</span>
            <span className="text-sm font-bold text-primary">{overallProgress}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
        {(['tasks', 'milestones', 'scores'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'scores' ? 'Acceptance Scores' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {/* Tasks tab */}
          {tab === 'tasks' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Tasks</h2>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddTask(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Add Task
                </Button>
              </div>

              {showAddTask && (
                <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Task Title *</Label>
                      <Input
                        value={taskForm.title}
                        onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Task title"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Due Date</Label>
                      <Input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => createTask.mutate()} disabled={!taskForm.title || createTask.isPending}>
                      {createTask.isPending ? 'Adding…' : 'Add Task'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddTask(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {(tasks ?? []).length === 0 ? (
                <EmptyState title="No tasks" description="Add the first task for this project." />
              ) : (
                <div className="space-y-2">
                  {(tasks ?? []).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canManage={canManage}
                      deliverableForm={deliverableForm[task.id] ?? { title: '', notes: '' }}
                      onDeliverableFormChange={(f) =>
                        setDeliverableForm((prev) => ({ ...prev, [task.id]: f }))
                      }
                      onAdvanceStatus={(status) => advanceTaskStatus.mutate({ taskId: task.id, status })}
                      onSubmitDeliverable={() =>
                        submitDeliverable.mutate({
                          taskId: task.id,
                          title: deliverableForm[task.id]?.title ?? '',
                          notes: deliverableForm[task.id]?.notes ?? '',
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Milestones tab */}
          {tab === 'milestones' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Milestones</h2>
                {canManage && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddMilestone(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Milestone
                  </Button>
                )}
              </div>

              {showAddMilestone && canManage && (
                <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Title *</Label>
                      <Input
                        value={milestoneForm.title}
                        onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Milestone title"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Progress %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={milestoneForm.progressPercent}
                        onChange={(e) => setMilestoneForm((f) => ({ ...f, progressPercent: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => createMilestone.mutate()} disabled={!milestoneForm.title || createMilestone.isPending}>
                      {createMilestone.isPending ? 'Adding…' : 'Add'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddMilestone(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {(milestones ?? []).length === 0 ? (
                <EmptyState title="No milestones" description={canManage ? 'Add milestones to track progress.' : 'No milestones defined.'} />
              ) : (
                <div className="space-y-3">
                  {(milestones ?? []).map((m) => (
                    <div key={m.id} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{m.title}</span>
                          <span className="text-xs font-bold text-primary">{m.progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${m.progressPercent === 100 ? 'bg-green-500' : 'bg-primary'}`}
                            style={{ width: `${m.progressPercent}%` }}
                          />
                        </div>
                        {m.dueDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {format(new Date(m.dueDate), 'MMM d, yyyy')}
                            {m.completedAt && ' · Completed'}
                          </p>
                        )}
                      </div>
                      {canManage && m.progressPercent < 100 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs flex-shrink-0"
                          onClick={() => updateMilestone.mutate({ milestoneId: m.id, progressPercent: 100 })}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Complete
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scores tab */}
          {tab === 'scores' && canManage && (
            <div>
              <h2 className="text-sm font-semibold mb-4">Acceptance Scores</h2>
              <div className="flex items-end gap-3 mb-4">
                <div>
                  <Label className="text-xs mb-1 block">Score (0–100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreForm.score}
                    onChange={(e) => setScoreForm((f) => ({ ...f, score: e.target.value }))}
                    className="h-8 text-sm w-24"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Feedback</Label>
                  <Input
                    value={scoreForm.feedback}
                    onChange={(e) => setScoreForm((f) => ({ ...f, feedback: e.target.value }))}
                    placeholder="Optional feedback"
                    className="h-8 text-sm"
                  />
                </div>
                <Button size="sm" className="h-8" onClick={() => addScore.mutate()} disabled={!scoreForm.score || addScore.isPending}>
                  {addScore.isPending ? 'Saving…' : 'Add Score'}
                </Button>
              </div>
              {(scores ?? []).length === 0 ? (
                <EmptyState title="No scores yet" />
              ) : (
                <div className="space-y-2">
                  {(scores ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <span className="text-2xl font-bold text-foreground">{s.score}</span>
                        <span className="text-sm text-muted-foreground">/{s.maxScore}</span>
                        {s.feedback && <p className="text-xs text-muted-foreground mt-0.5">{s.feedback}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(s.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ErrorBoundary>
      </div>

      {/* Confirm status transition */}
      <ConfirmDialog
        open={!!confirmTransition}
        onOpenChange={(o) => !o && setConfirmTransition(null)}
        title={`Advance to ${confirmTransition?.replace(/_/g, ' ')}`}
        description="Are you sure you want to advance this project to the next status? This cannot be undone."
        confirmLabel="Advance"
        onConfirm={() => confirmTransition && advanceStatus.mutate(confirmTransition)}
      />
    </div>
  );
}

function TaskCard({
  task,
  canManage,
  deliverableForm,
  onDeliverableFormChange,
  onAdvanceStatus,
  onSubmitDeliverable,
}: {
  task: Task;
  canManage: boolean;
  deliverableForm: { title: string; notes: string };
  onDeliverableFormChange: (f: { title: string; notes: string }) => void;
  onAdvanceStatus: (status: string) => void;
  onSubmitDeliverable: () => void;
}) {
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);

  const TASK_TRANSITIONS: Record<string, string[]> = {
    open: ['in_progress', 'submitted'],
    in_progress: ['submitted'],
    submitted: canManage ? ['approved', 'rejected'] : [],
    approved: [],
    rejected: ['in_progress'],
  };

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {task.status === 'approved' ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium">{task.title}</p>
            {task.dueDate && (
              <p className="text-xs text-muted-foreground">
                Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={task.status} />
          {(TASK_TRANSITIONS[task.status] ?? []).map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] capitalize"
              onClick={() => onAdvanceStatus(s)}
            >
              → {s.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* Deliverables */}
      {(task.deliverables ?? []).length > 0 && (
        <div className="mt-2 pl-6">
          <p className="text-xs text-muted-foreground mb-1">Deliverables:</p>
          {task.deliverables!.map((d) => (
            <div key={d.id} className="text-xs text-foreground">
              · {d.title}
            </div>
          ))}
        </div>
      )}

      {/* Submit deliverable */}
      {['open', 'in_progress'].includes(task.status) && (
        <div className="mt-2 pl-6">
          {showDeliverableForm ? (
            <div className="space-y-2">
              <Input
                placeholder="Deliverable title"
                value={deliverableForm.title}
                onChange={(e) => onDeliverableFormChange({ ...deliverableForm, title: e.target.value })}
                className="h-7 text-xs"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => { onSubmitDeliverable(); setShowDeliverableForm(false); }}
                  disabled={!deliverableForm.title}
                >
                  Submit
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowDeliverableForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeliverableForm(true)}
              className="text-xs text-primary hover:underline"
            >
              + Submit deliverable
            </button>
          )}
        </div>
      )}
    </div>
  );
}

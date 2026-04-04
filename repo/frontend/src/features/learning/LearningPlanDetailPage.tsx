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
import { ChevronLeft, Plus, X, BookOpen, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface LearningPlan {
  id: string;
  title: string;
  description: string | null;
  status: string;
  userId: string;
  targetRole: string | null;
  goals?: LearningGoal[];
}

interface LearningGoal {
  id: string;
  title: string;
  priority: string;
  studyFrequencyRule: string | null;
  sessionsPerWeek: number;
  tags: string[];
}

interface LifecycleEvent {
  id: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  transitionedAt: string;
}

interface ComplianceData {
  goalId: string;
  sessionsPerWeek: number;
  sessionsThisWeek: number;
  compliancePercent: number;
  isBelowTarget: boolean;
}

const PLAN_TRANSITIONS: Record<string, string[]> = {
  not_started: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'archived'],
  completed: ['archived'],
  archived: [],
};

export function LearningPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const canManage = user?.role === 'admin' || user?.role === 'hr';
  const [tab, setTab] = useState<'goals' | 'lifecycle'>('goals');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: '', priority: 'medium', studyFrequencyRule: '3 sessions/week', sessionsPerWeek: '3', tags: '',
  });
  const [sessionGoalId, setSessionGoalId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({ durationMinutes: '60', notes: '' });
  const [confirmTransition, setConfirmTransition] = useState<string | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [error, setError] = useState('');

  const { data: plan, isLoading } = useQuery({
    queryKey: ['learning', 'plan', id],
    queryFn: () => apiClient.get(`/learning/plans/${id}`).then((r) => r.data.data as LearningPlan),
    enabled: !!id,
  });

  const { data: goals } = useQuery({
    queryKey: ['learning', 'plan', id, 'goals'],
    queryFn: () =>
      apiClient.get(`/learning/plans/${id}/goals`).then((r) => r.data.data as LearningGoal[]),
    enabled: !!id,
  });

  const { data: lifecycle } = useQuery({
    queryKey: ['learning', 'plan', id, 'lifecycle'],
    queryFn: () =>
      apiClient.get(`/learning/plans/${id}/lifecycle`).then((r) => r.data.data as LifecycleEvent[]),
    enabled: !!id,
  });

  const addGoal = useMutation({
    mutationFn: () =>
      apiClient.post(`/learning/plans/${id}/goals`, {
        title: goalForm.title,
        priority: goalForm.priority,
        studyFrequencyRule: goalForm.studyFrequencyRule || undefined,
        sessionsPerWeek: Number(goalForm.sessionsPerWeek),
        tags: goalForm.tags ? goalForm.tags.split(',').map((t) => t.trim()) : [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning', 'plan', id, 'goals'] });
      setShowAddGoal(false);
      setGoalForm({ title: '', priority: 'medium', studyFrequencyRule: '3 sessions/week', sessionsPerWeek: '3', tags: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to add goal.');
    },
  });

  const logSession = useMutation({
    mutationFn: (goalId: string) =>
      apiClient.post(`/learning/goals/${goalId}/sessions`, {
        durationMinutes: Number(sessionForm.durationMinutes),
        notes: sessionForm.notes || undefined,
        sessionDate: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning', 'plan', id, 'goals'] });
      setSessionGoalId(null);
      setSessionForm({ durationMinutes: '60', notes: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to log session.');
    },
  });

  const advanceStatus = useMutation({
    mutationFn: (status: string) =>
      apiClient.patch(`/learning/plans/${id}/status`, { status, reason: transitionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning', 'plan', id] });
      qc.invalidateQueries({ queryKey: ['learning', 'plan', id, 'lifecycle'] });
      setConfirmTransition(null);
      setTransitionReason('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to advance plan status.');
    },
  });

  if (isLoading) return <PageLoader />;
  if (!plan) return <p className="p-6 text-sm text-muted-foreground">Plan not found.</p>;

  const nextStatuses = PLAN_TRANSITIONS[plan.status] ?? [];

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => navigate('/learning')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Learning Plans
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-foreground">{plan.title}</h1>
            <StatusBadge status={plan.status} />
          </div>
          {plan.targetRole && (
            <p className="text-sm text-muted-foreground">Target Role: {plan.targetRole}</p>
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
        {(['goals', 'lifecycle'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'lifecycle' ? 'Status History' : 'Goals'}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {tab === 'goals' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Learning Goals</h2>
                {canManage && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddGoal(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Goal
                  </Button>
                )}
              </div>

              {showAddGoal && (
                <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">New Goal</span>
                    <button onClick={() => setShowAddGoal(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Title *</Label>
                      <Input
                        value={goalForm.title}
                        onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Goal title"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Study Frequency Rule</Label>
                      <Input
                        value={goalForm.studyFrequencyRule}
                        onChange={(e) => setGoalForm((f) => ({ ...f, studyFrequencyRule: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="e.g. 3 sessions/week"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Sessions / Week</Label>
                      <Input
                        type="number"
                        min={1}
                        value={goalForm.sessionsPerWeek}
                        onChange={(e) => setGoalForm((f) => ({ ...f, sessionsPerWeek: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Priority</Label>
                      <select
                        value={goalForm.priority}
                        onChange={(e) => setGoalForm((f) => ({ ...f, priority: e.target.value }))}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Tags (comma-separated)</Label>
                      <Input
                        value={goalForm.tags}
                        onChange={(e) => setGoalForm((f) => ({ ...f, tags: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="e.g. safety, compliance"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addGoal.mutate()}
                    disabled={!goalForm.title || addGoal.isPending}
                  >
                    {addGoal.isPending ? 'Adding…' : 'Add Goal'}
                  </Button>
                </div>
              )}

              {(goals ?? []).length === 0 ? (
                <EmptyState icon={BookOpen} title="No goals yet" description={canManage ? 'Add learning goals for this plan.' : ''} />
              ) : (
                <div className="space-y-3">
                  {(goals ?? []).map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      isActiveSession={sessionGoalId === goal.id}
                      sessionForm={sessionForm}
                      onSessionFormChange={setSessionForm}
                      onLogSession={() => logSession.mutate(goal.id)}
                      onToggleSession={() => setSessionGoalId(sessionGoalId === goal.id ? null : goal.id)}
                      isLogging={logSession.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'lifecycle' && (
            <div>
              <h2 className="text-sm font-semibold mb-4">Status History</h2>
              {(lifecycle ?? []).length === 0 ? (
                <EmptyState title="No status changes yet" />
              ) : (
                <div className="space-y-3">
                  {(lifecycle ?? []).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusBadge status={event.fromStatus} />
                        <span className="text-muted-foreground">→</span>
                        <StatusBadge status={event.toStatus} />
                      </div>
                      <div className="flex-1">
                        {event.reason && <p className="text-xs text-muted-foreground">{event.reason}</p>}
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {format(new Date(event.transitionedAt), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ErrorBoundary>
      </div>

      {/* Confirm transition dialog */}
      <ConfirmDialog
        open={!!confirmTransition}
        onOpenChange={(o) => !o && setConfirmTransition(null)}
        title={`Move to ${confirmTransition?.replace(/_/g, ' ')}`}
        description={
          <div>
            <p className="mb-2">Provide a reason for this status change (optional):</p>
            <Input
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder="Reason..."
              className="h-8 text-sm"
            />
          </div>
        }
        confirmLabel="Confirm"
        onConfirm={() => confirmTransition && advanceStatus.mutate(confirmTransition)}
      />
    </div>
  );
}

function GoalCard({
  goal,
  isActiveSession,
  sessionForm,
  onSessionFormChange,
  onLogSession,
  onToggleSession,
  isLogging,
}: {
  goal: LearningGoal;
  isActiveSession: boolean;
  sessionForm: { durationMinutes: string; notes: string };
  onSessionFormChange: (f: { durationMinutes: string; notes: string }) => void;
  onLogSession: () => void;
  onToggleSession: () => void;
  isLogging: boolean;
}) {
  const { data: compliance } = useQuery({
    queryKey: ['learning', 'goal', goal.id, 'compliance'],
    queryFn: () =>
      apiClient
        .get(`/learning/goals/${goal.id}/compliance`)
        .then((r) => r.data.data as ComplianceData),
  });

  const compliancePct = compliance?.compliancePercent ?? 0;

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium">{goal.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {goal.studyFrequencyRule && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3 inline mr-0.5" />
                {goal.studyFrequencyRule}
              </span>
            )}
            <span className={`text-xs capitalize px-2 py-0.5 rounded-full ${
              goal.priority === 'high' ? 'bg-red-100 text-red-700' :
              goal.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }`}>{goal.priority}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-shrink-0" onClick={onToggleSession}>
          {isActiveSession ? 'Cancel' : '+ Log Session'}
        </Button>
      </div>

      {/* Compliance indicator */}
      {compliance && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              This week: {compliance.sessionsThisWeek}/{compliance.sessionsPerWeek} sessions
            </span>
            <span className={`text-xs font-semibold ${compliance.isBelowTarget ? 'text-amber-600' : 'text-green-600'}`}>
              {compliancePct}%
              {compliance.isBelowTarget && ' — below target'}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${compliance.isBelowTarget ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${Math.min(compliancePct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Log session form */}
      {isActiveSession && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Duration (min)</Label>
              <Input
                type="number"
                min={1}
                value={sessionForm.durationMinutes}
                onChange={(e) => onSessionFormChange({ ...sessionForm, durationMinutes: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Notes</Label>
              <Input
                value={sessionForm.notes}
                onChange={(e) => onSessionFormChange({ ...sessionForm, notes: e.target.value })}
                className="h-7 text-xs"
                placeholder="Optional"
              />
            </div>
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={onLogSession} disabled={isLogging}>
            <CheckCircle className="w-3 h-3 mr-1" />
            {isLogging ? 'Logging…' : 'Log Session'}
          </Button>
        </div>
      )}
    </div>
  );
}

interface ComplianceData {
  goalId: string;
  sessionsPerWeek: number;
  sessionsThisWeek: number;
  compliancePercent: number;
  isBelowTarget: boolean;
}

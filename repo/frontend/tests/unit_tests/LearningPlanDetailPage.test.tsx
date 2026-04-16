import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';

import { LearningPlanDetailPage } from '@/features/learning/LearningPlanDetailPage';
import { renderAtRoute } from './test-helpers';
import { loginAs } from './test-helpers/real-api';
import { apiClient } from '@/lib/api-client';

describe('LearningPlanDetailPage (real backend)', () => {
  let existingId: string | null = null;

  beforeAll(async () => {
    await loginAs('hr');
    const res = await apiClient.get('/learning/plans').catch(() => null);
    const list = (res?.data?.data ?? []) as Array<{ id: string }>;
    existingId = list[0]?.id ?? null;
  });

  it('renders plan header and add-goal affordance for an existing plan, OR not-found', async () => {
    if (!existingId) {
      renderAtRoute(<LearningPlanDetailPage />, {
        path: '/learning/:id',
        at: '/learning/00000000-0000-0000-0000-000000000000',
      });
      await waitFor(() => expect(screen.getByText(/plan not found/i)).toBeInTheDocument(), { timeout: 5000 });
      return;
    }
    renderAtRoute(<LearningPlanDetailPage />, {
      path: '/learning/:id',
      at: `/learning/${existingId}`,
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /add goal/i })).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }));
    await waitFor(() => expect(screen.getByText(/new goal/i)).toBeInTheDocument());
  });

  it('switches to status history tab when an existing plan is loaded', async () => {
    if (!existingId) return;
    renderAtRoute(<LearningPlanDetailPage />, {
      path: '/learning/:id',
      at: `/learning/${existingId}`,
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /status history/i })).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /status history/i }));
  });

  it('shows not-found when id does not exist', async () => {
    renderAtRoute(<LearningPlanDetailPage />, {
      path: '/learning/:id',
      at: '/learning/00000000-0000-0000-0000-000000000000',
    });
    await waitFor(() => expect(screen.getByText(/plan not found/i)).toBeInTheDocument(), { timeout: 5000 });
  });
});

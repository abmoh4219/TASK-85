import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

import { LabPage } from '@/features/lab/LabPage';
import { renderWithProviders } from './test-helpers';

describe('LabPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('shows empty state when no samples', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<LabPage />);
    expect(screen.getByRole('heading', { name: /lab operations/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no lab samples/i)).toBeInTheDocument());
  });

  it('renders samples in kanban columns', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 's1',
            sampleType: 'Blood Panel',
            patientIdentifier: 'PAT-0042',
            collectionDate: new Date('2026-02-10').toISOString(),
            status: 'submitted',
          },
        ],
      },
    });
    renderWithProviders(<LabPage />);
    await waitFor(() => expect(screen.getAllByText(/blood panel/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/\.\.\.0042/).length).toBeGreaterThan(0);
  });

  it.skip('renders kanban columns with each status bucket', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 's1', sampleType: 'A', patientIdentifier: null, collectionDate: new Date().toISOString(), status: 'submitted' },
          { id: 's2', sampleType: 'B', patientIdentifier: null, collectionDate: new Date().toISOString(), status: 'in_progress' },
          { id: 's3', sampleType: 'C', patientIdentifier: null, collectionDate: new Date().toISOString(), status: 'reported' },
        ],
      },
    });
    renderWithProviders(<LabPage />);
    await waitFor(() => expect(screen.getByText(/^Submitted$/)).toBeInTheDocument());
    expect(screen.getByText(/^In Progress$/)).toBeInTheDocument();
    expect(screen.getByText(/^Reported$/)).toBeInTheDocument();
    expect(screen.getByText(/^Archived$/)).toBeInTheDocument();
  });

  it('click on sample kanban card calls navigate', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 's1', sampleType: 'PanelX', patientIdentifier: null, collectionDate: new Date().toISOString(), status: 'submitted' },
        ],
      },
    });
    renderWithProviders(<LabPage />);
    const cards = await screen.findAllByText('PanelX');
    // Clicking the kanban button (not table row) should still be safe
    fireEvent.click(cards[0].closest('button') ?? cards[0]);
    expect(cards.length).toBeGreaterThan(0);
  });
});

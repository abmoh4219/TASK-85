import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: vi.fn(),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

import { SampleDetailPage } from '@/features/lab/SampleDetailPage';
import { createTestQueryClient } from './test-helpers';

function renderAt(id = 's1') {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/lab/${id}`]}>
        <Routes>
          <Route path="/lab/:id" element={<SampleDetailPage />} />
          <Route path="/lab" element={<div>lab list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SampleDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockClear();
  });

  it('renders sample header and tabs', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/lab/samples/s1') {
        return Promise.resolve({
          data: {
            data: {
              id: 's1',
              sampleType: 'Blood Panel',
              status: 'submitted',
              collectionDate: new Date('2026-02-10').toISOString(),
              patientIdentifier: 'PAT-0042',
              results: [],
              report: null,
            },
          },
        });
      }
      if (url === '/lab/tests') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('Blood Panel')).toBeInTheDocument());
    expect(screen.getByText('...0042')).toBeInTheDocument();
    expect(screen.getByText(/no results entered/i)).toBeInTheDocument();
  });

  it('switches to report tab and shows generate controls', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/lab/samples/s1') {
        return Promise.resolve({
          data: {
            data: {
              id: 's1',
              sampleType: 'Urine',
              status: 'in_progress',
              collectionDate: new Date().toISOString(),
              patientIdentifier: null,
              results: [],
              report: null,
            },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('Urine')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^report$/i }));
    await waitFor(() => expect(screen.getByText(/generate report/i)).toBeInTheDocument());
  });

  it('adds a new result row via add-result button', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/lab/samples/s1') {
        return Promise.resolve({
          data: {
            data: {
              id: 's1',
              sampleType: 'Blood',
              status: 'in_progress',
              collectionDate: new Date().toISOString(),
              patientIdentifier: null,
              results: [],
              report: null,
            },
          },
        });
      }
      if (url === '/lab/tests')
        return Promise.resolve({ data: { data: [{ id: 't1', name: 'Glucose', code: 'GLU', isActive: true, referenceRanges: [{ minValue: 70, maxValue: 100, unit: 'mg/dL' }] }] } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('Blood')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add result/i }));
    await waitFor(() => expect(screen.getByText(/new results/i)).toBeInTheDocument());
  });

  it('shows not-found when API returns null', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/lab/samples/s1') return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText(/sample not found/i)).toBeInTheDocument());
  });
});

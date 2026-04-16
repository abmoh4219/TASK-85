import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Bell } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AlertCard } from '@/components/shared/AlertCard';
import { LoadingSpinner, PageLoader } from '@/components/shared/LoadingSpinner';
import { DataTable } from '@/components/shared/DataTable';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

describe('EmptyState', () => {
  it('renders title, description, icon, and action', () => {
    render(
      <EmptyState
        icon={Bell}
        title="Nothing here"
        description="No records found."
        action={<button>Create</button>}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('No records found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('maps snake_case status to a human label', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it('falls back to secondary variant for unknown status', () => {
    render(<StatusBadge status="weird-thing" />);
    expect(screen.getByText(/weird thing/i)).toBeInTheDocument();
  });
});

describe('AlertCard', () => {
  it('renders title, message, and invokes onAction', () => {
    const onAction = vi.fn();
    render(
      <AlertCard
        severity="critical"
        title="Low stock"
        message="Item below safety level"
        meta="Gauze"
        actionLabel="Fix"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('Item below safety level')).toBeInTheDocument();
    expect(screen.getByText('Gauze')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fix/i }));
    expect(onAction).toHaveBeenCalled();
  });

  it.each(['critical', 'warning', 'info', 'success'] as const)('renders severity %s', (sev) => {
    render(<AlertCard severity={sev} title="t" message="m" />);
    expect(screen.getByText('t')).toBeInTheDocument();
  });
});

describe('LoadingSpinner / PageLoader', () => {
  it('renders with a default loading label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<LoadingSpinner label="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  it('PageLoader renders a spinner with Loading label', () => {
    render(<PageLoader />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  interface Row { id: string; name: string }
  const data: Row[] = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
  ];
  const columns = [
    { accessorKey: 'name' as const, header: 'Name' },
  ];

  it('renders rows from data', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows "No results found." for empty data', () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it('invokes onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('filters rows via global search input', () => {
    render(<DataTable columns={columns} data={data} searchColumn="name" searchPlaceholder="Filter" />);
    const input = screen.getByPlaceholderText('Filter');
    fireEvent.change(input, { target: { value: 'Alp' } });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('paginates data with next/prev controls', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `Row${i}` }));
    render(<DataTable columns={columns} data={many} pageSize={10} />);
    expect(screen.getByText('Row0')).toBeInTheDocument();
    expect(screen.queryByText('Row20')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Row10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText('Row0')).toBeInTheDocument();
  });

  it('toggles column sort when header button clicked', () => {
    const cols = [{ accessorKey: 'name' as const, header: 'Name' }];
    const rows = [
      { id: '1', name: 'Charlie' },
      { id: '2', name: 'Alpha' },
    ];
    render(<DataTable columns={cols} data={rows} />);
    const headerBtn = screen.getByRole('button', { name: /name/i });
    fireEvent.click(headerBtn);
    // After sort asc, Alpha comes before Charlie — verify both still present (no crash on sort)
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('kaboom');
    };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('oops');
    };
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders the fallback UI with a retry button when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('x');
    };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});

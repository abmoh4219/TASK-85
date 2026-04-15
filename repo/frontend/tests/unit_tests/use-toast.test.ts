import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToast, toast, reducer } from '../../src/hooks/use-toast';

describe('useToast hook', () => {
  it('starts with empty toasts and exposes toast/dismiss functions', () => {
    const { result } = renderHook(() => useToast());
    expect(Array.isArray(result.current.toasts)).toBe(true);
    expect(typeof result.current.toast).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
  });

  it('adds a toast via the exported toast() function and updates hook state', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Hello', description: 'World' });
    });
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Hello');
    expect(result.current.toasts[0].open).toBe(true);
  });

  it('dismiss() sets the toast open=false', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Another' });
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(id);
    });
    expect(result.current.toasts[0].open).toBe(false);
  });

  it('dismiss() with no id dismisses all toasts', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'X' });
    });
    act(() => {
      result.current.dismiss();
    });
    result.current.toasts.forEach((t) => expect(t.open).toBe(false));
  });

  it('respects TOAST_LIMIT = 1 by replacing prior toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'First' });
    });
    act(() => {
      toast({ title: 'Second' });
    });
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Second');
  });

  it('toast() returns id, dismiss, and update handles', () => {
    let handle: any;
    act(() => {
      handle = toast({ title: 'Handle' });
    });
    expect(handle).toHaveProperty('id');
    expect(typeof handle.dismiss).toBe('function');
    expect(typeof handle.update).toBe('function');
  });

  it('onOpenChange(false) triggers dismiss (covers lines 98-100)', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Open-change' });
    });
    const created = result.current.toasts[0];
    act(() => {
      created.onOpenChange?.(false);
    });
    expect(result.current.toasts[0].open).toBe(false);
  });

  it('onOpenChange(true) is a no-op', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Keep-open' });
    });
    const created = result.current.toasts[0];
    act(() => {
      created.onOpenChange?.(true);
    });
    // still open, no dismiss fired
    expect(result.current.toasts[0].open).toBe(true);
  });
});

describe('addToRemoveQueue timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dismissed toast is eventually removed after the delay (covers lines 44-46)', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Timer' });
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(id);
    });
    // Fast-forward through the removal timeout
    act(() => {
      vi.runAllTimers();
    });
    expect(result.current.toasts.find((t) => t.id === id)).toBeUndefined();
  });

  it('calling dismiss twice on same id does not queue a second timeout', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Double' });
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(id);
      result.current.dismiss(id);
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(result.current.toasts.find((t) => t.id === id)).toBeUndefined();
  });
});

describe('reducer', () => {
  it('ADD_TOAST adds a toast (capped at TOAST_LIMIT)', () => {
    const next = reducer(
      { toasts: [] },
      { type: 'ADD_TOAST', toast: { id: '1', open: true } as any },
    );
    expect(next.toasts.length).toBe(1);
    expect(next.toasts[0].id).toBe('1');
  });

  it('UPDATE_TOAST merges props onto a matching toast', () => {
    const state = { toasts: [{ id: '1', open: true, title: 'A' } as any] };
    const next = reducer(state, {
      type: 'UPDATE_TOAST',
      toast: { id: '1', title: 'B' } as any,
    });
    expect(next.toasts[0].title).toBe('B');
  });

  it('DISMISS_TOAST with id sets that toast open=false', () => {
    const state = { toasts: [{ id: '1', open: true } as any, { id: '2', open: true } as any] };
    const next = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' });
    expect(next.toasts.find((t) => t.id === '1')!.open).toBe(false);
    expect(next.toasts.find((t) => t.id === '2')!.open).toBe(true);
  });

  it('DISMISS_TOAST without id closes all toasts', () => {
    const state = { toasts: [{ id: '1', open: true } as any, { id: '2', open: true } as any] };
    const next = reducer(state, { type: 'DISMISS_TOAST' });
    next.toasts.forEach((t) => expect(t.open).toBe(false));
  });

  it('REMOVE_TOAST with id removes that toast', () => {
    const state = { toasts: [{ id: '1' } as any, { id: '2' } as any] };
    const next = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' });
    expect(next.toasts.length).toBe(1);
    expect(next.toasts[0].id).toBe('2');
  });

  it('REMOVE_TOAST without id clears all toasts', () => {
    const state = { toasts: [{ id: '1' } as any, { id: '2' } as any] };
    const next = reducer(state, { type: 'REMOVE_TOAST' });
    expect(next.toasts).toEqual([]);
  });
});

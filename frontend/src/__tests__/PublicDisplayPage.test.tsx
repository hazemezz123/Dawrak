import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicDisplayPage from '../pages/PublicDisplayPage.js';
import * as api from '../lib/api.js';
import * as socketHook from '../hooks/useWindowSocket.js';

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    fetchWindowDisplay: vi.fn(),
  };
});

vi.mock('../hooks/useWindowSocket.js', () => ({
  useWindowSocket: vi.fn(),
}));

describe('PublicDisplayPage Component', () => {
  let queryClient: QueryClient;
  let socketCallback: ((data?: any) => void) | undefined;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    vi.mocked(socketHook.useWindowSocket).mockImplementation((_winId, cb) => {
      socketCallback = cb;
      return { isConnected: true } as any;
    });
  });

  const renderComponent = (windowId = 'win-1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/display/${windowId}`]}>
          <Routes>
            <Route path="/display/:windowId" element={<PublicDisplayPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('shows empty state "لا يوجد دور حالي" when nothing is called', async () => {
    vi.mocked(api.fetchWindowDisplay).mockResolvedValue({
      window: {
        id: 'win-1',
        name: 'شؤون الطلاب',
        location: 'المبنى الرئيسي',
        isActive: true,
      },
      called: null,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('شؤون الطلاب')).toBeDefined();
    });

    expect(screen.getByText('لا يوجد دور حالي')).toBeDefined();
    expect(screen.queryByTestId('called-number')).toBeNull();
  });

  it('shows the called ticket number when a ticket is called', async () => {
    vi.mocked(api.fetchWindowDisplay).mockResolvedValue({
      window: {
        id: 'win-1',
        name: 'شؤون الطلاب',
        location: 'المبنى الرئيسي',
        isActive: true,
      },
      called: {
        id: 't-1',
        number: 42,
        service: { id: 's-1', name: 'استخراج إفادة' },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('called-number')).toBeDefined();
    });

    expect(screen.getByTestId('called-number').textContent).toBe('42');
    expect(screen.getByText('استخراج إفادة')).toBeDefined();
    expect(screen.queryByText('لا يوجد دور حالي')).toBeNull();
  });

  it('updates live and shows the new called number after queue:update socket event', async () => {
    vi.mocked(api.fetchWindowDisplay).mockResolvedValue({
      window: {
        id: 'win-1',
        name: 'شؤون الطلاب',
        location: 'المبنى الرئيسي',
        isActive: true,
      },
      called: null,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('لا يوجد دور حالي')).toBeDefined();
    });

    // Simulate queue:update event passing the new snapshot with a called ticket
    socketCallback?.({
      called: {
        id: 't-99',
        number: 99,
        service: { id: 's-1', name: 'بيان درجات' },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('called-number')).toBeDefined();
    });

    expect(screen.getByTestId('called-number').textContent).toBe('99');
    expect(screen.getByText('بيان درجات')).toBeDefined();
    expect(screen.queryByText('لا يوجد دور حالي')).toBeNull();
  });

  it('never renders student name or phone from display or socket data', async () => {
    vi.mocked(api.fetchWindowDisplay).mockResolvedValue({
      window: {
        id: 'win-1',
        name: 'شؤون الطلاب',
        location: 'المبنى الرئيسي',
        isActive: true,
      },
      called: {
        id: 't-1',
        number: 12,
        service: { id: 's-1', name: 'استخراج إفادة' },
        student: { id: 'stu-1', fullName: 'أحمد علي', phone: '01012345678' },
      } as any,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('called-number').textContent).toBe('12');
    });

    socketCallback?.({
      called: {
        id: 't-2',
        number: 13,
        service: { id: 's-1', name: 'استخراج إفادة' },
        student: { id: 'stu-2', fullName: 'منى حسن', phone: '01098765432' },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('called-number').textContent).toBe('13');
    });

    expect(document.body.textContent).not.toContain('أحمد علي');
    expect(document.body.textContent).not.toContain('01012345678');
    expect(document.body.textContent).not.toContain('منى حسن');
    expect(document.body.textContent).not.toContain('01098765432');
  });
});

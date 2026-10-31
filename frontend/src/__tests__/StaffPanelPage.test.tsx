import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.js';
import StaffPanelPage from '../pages/StaffPanelPage.js';
import * as api from '../lib/api.js';

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    fetchCurrentUser: vi.fn().mockResolvedValue({
      id: 'staff-1',
      name: 'أحمد',
      role: 'STAFF',
      windowIds: ['win-1'],
    }),
    logoutUser: vi.fn().mockResolvedValue(undefined),
    fetchWindow: vi.fn(),
    fetchQueue: vi.fn(),
    callNext: vi.fn(),
    skipTicket: vi.fn(),
  };
});

vi.mock('../hooks/useWindowSocket.js', () => ({
  useWindowSocket: vi.fn(() => ({ isConnected: true })),
}));

describe('StaffPanelPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    vi.mocked(api.fetchWindow).mockResolvedValue({
      id: 'win-1',
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  });

  const renderWithProviders = (windowId: string = 'win-1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/admin/${windowId}`]}>
            <Routes>
              <Route path="/admin/:windowId" element={<StaffPanelPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  it('renders the waiting list in the correct order', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'ticket-1',
        number: 1,
        status: 'called',
        sortKey: 1,
        skipCount: 0,
        service: { id: 'srv-1', name: 'استخراج إفادة' },
      },
      waiting: [
        {
          id: 'ticket-2',
          number: 2,
          status: 'waiting',
          sortKey: 2,
          skipCount: 0,
          service: { id: 'srv-1', name: 'استخراج إفادة' },
        },
        {
          id: 'ticket-3',
          number: 3,
          status: 'waiting',
          sortKey: 3,
          skipCount: 0,
          service: { id: 'srv-2', name: 'دفع مصروفات' },
        },
        {
          id: 'ticket-4',
          number: 4,
          status: 'waiting',
          sortKey: 4,
          skipCount: 1,
          service: { id: 'srv-1', name: 'استخراج إفادة' },
        },
      ],
      waitingCount: 3,
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('1')).toBeDefined(); // Called ticket number
      expect(screen.getByText('تذكرة #2')).toBeDefined();
      expect(screen.getByText('تذكرة #3')).toBeDefined();
      expect(screen.getByText('تذكرة #4')).toBeDefined();
      expect(screen.getByText('مؤجل (تخطي سابق)')).toBeDefined();
    });

    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('تذكرة #2');
    expect(items[1].textContent).toContain('تذكرة #3');
    expect(items[2].textContent).toContain('تذكرة #4');
  });

  it('sends the correct currentTicketId when "التالي" is clicked with a ticket on screen', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'called-ticket-id-99',
        number: 5,
        status: 'called',
        sortKey: 5,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
      },
      waiting: [
        {
          id: 'waiting-ticket-id-100',
          number: 6,
          status: 'waiting',
          sortKey: 6,
          skipCount: 0,
          service: { id: 'srv-1', name: 'خدمة' },
        },
      ],
      waitingCount: 1,
    });

    vi.mocked(api.callNext).mockResolvedValue({
      ticket: {
        id: 'waiting-ticket-id-100',
        number: 6,
        status: 'called',
        sortKey: 6,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
      },
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('5')).toBeDefined();
    });

    const nextButton = screen.getByRole('button', { name: /التالي/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(api.callNext).toHaveBeenCalledWith('win-1', 'called-ticket-id-99');
    });
  });

  it('shows an Arabic message and refreshes the queue on a 409 STALE_TICKET response', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'stale-id',
        number: 8,
        status: 'called',
        sortKey: 8,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
      },
      waiting: [],
      waitingCount: 0,
    });

    vi.mocked(api.callNext).mockRejectedValue({
      code: 'STALE_TICKET',
      message: 'تم تحديث التذكرة بالفعل بواسطة موظف آخر، تم تحديث البيانات.',
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('8')).toBeDefined();
    });

    const nextButton = screen.getByRole('button', { name: /التالي/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(
        screen.getByText('تم تحديث التذكرة بالفعل بواسطة موظف آخر، تم تحديث البيانات.')
      ).toBeDefined();
      // Verifies fetchQueue was called to refresh
      expect(api.fetchQueue).toHaveBeenCalled();
    });
  });

  it('disables both buttons while a request is in flight', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'ticket-1',
        number: 1,
        status: 'called',
        sortKey: 1,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
      },
      waiting: [
        {
          id: 'ticket-2',
          number: 2,
          status: 'waiting',
          sortKey: 2,
          skipCount: 0,
          service: { id: 'srv-1', name: 'خدمة' },
        },
      ],
      waitingCount: 1,
    });

    // Promise that does not resolve immediately
    let resolveCall: any;
    const pendingPromise = new Promise<{ ticket: any }>((res) => {
      resolveCall = res;
    });
    vi.mocked(api.callNext).mockReturnValue(pendingPromise);

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('1')).toBeDefined();
    });

    const nextButton = screen.getByRole('button', { name: /التالي/i }) as HTMLButtonElement;
    const skipButton = screen.getByRole('button', { name: /تخطي/i }) as HTMLButtonElement;

    expect(nextButton.disabled).toBe(false);
    expect(skipButton.disabled).toBe(false);

    // Trigger next
    fireEvent.click(nextButton);

    // Both should now be disabled while in flight
    await waitFor(() => {
      expect(nextButton.disabled).toBe(true);
      expect(skipButton.disabled).toBe(true);
    });

    // Resolve request
    resolveCall({ ticket: null });

    await waitFor(() => {
      expect(nextButton.disabled).toBe(false);
    });
  });

  it('sends the correct currentTicketId when "تخطي" is clicked with a ticket on screen', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'called-ticket-id-88',
        number: 7,
        status: 'called',
        sortKey: 7,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
      },
      waiting: [],
      waitingCount: 0,
    });

    vi.mocked(api.skipTicket).mockResolvedValue({
      ticket: {
        id: 'called-ticket-id-88',
        number: 7,
        status: 'waiting',
        sortKey: 10,
        skipCount: 1,
        service: { id: 'srv-1', name: 'خدمة' },
      },
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('7')).toBeDefined();
    });

    const skipButton = screen.getByRole('button', { name: /تخطي/i });
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(api.skipTicket).toHaveBeenCalledWith('win-1', 'called-ticket-id-88');
    });
  });

  it('shows an Arabic message and refreshes the queue on a 409 STALE_TICKET response when skipping', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'stale-skip-id',
        number: 9,
        status: 'called',
        sortKey: 9,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
      },
      waiting: [],
      waitingCount: 0,
    });

    vi.mocked(api.skipTicket).mockRejectedValue({
      code: 'STALE_TICKET',
      message: 'تم تحديث التذكرة بالفعل بواسطة موظف آخر، تم تحديث البيانات.',
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('9')).toBeDefined();
    });

    const skipButton = screen.getByRole('button', { name: /تخطي/i });
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(
        screen.getByText('تم تحديث التذكرة بالفعل بواسطة موظف آخر، تم تحديث البيانات.')
      ).toBeDefined();
      expect(api.fetchQueue).toHaveBeenCalled();
    });
  });

  it('shows student name and phone on the current and waiting cards', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'called-with-student',
        number: 3,
        status: 'called',
        sortKey: 3,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
        student: { id: 'stu-1', fullName: 'أحمد علي', phone: '01012345678' },
      },
      waiting: [
        {
          id: 'waiting-with-student',
          number: 4,
          status: 'waiting',
          sortKey: 4,
          skipCount: 0,
          service: { id: 'srv-1', name: 'خدمة' },
          student: { id: 'stu-2', fullName: 'منى حسن', phone: '01098765432' },
        },
      ],
      waitingCount: 1,
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('أحمد علي')).toBeDefined();
      expect(screen.getByText('01012345678')).toBeDefined();
      expect(screen.getByText('منى حسن')).toBeDefined();
      expect(screen.getByText('01098765432')).toBeDefined();
    });
  });

  it('shows the neutral fallback for legacy tickets without student data', async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      windowId: 'win-1',
      date: '2026-10-24',
      called: {
        id: 'legacy-called',
        number: 5,
        status: 'called',
        sortKey: 5,
        skipCount: 0,
        service: { id: 'srv-1', name: 'خدمة' },
        student: null,
      },
      waiting: [
        {
          id: 'legacy-waiting',
          number: 6,
          status: 'waiting',
          sortKey: 6,
          skipCount: 0,
          service: { id: 'srv-1', name: 'خدمة' },
        },
      ],
      waitingCount: 1,
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('5')).toBeDefined();
      expect(screen.getAllByText('غير مسجل')).toHaveLength(2);
    });
  });
});

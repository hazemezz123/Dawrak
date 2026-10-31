import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TicketTrackingPage from '../pages/TicketTrackingPage.js';
import * as api from '../lib/api.js';
import * as socketHook from '../hooks/useWindowSocket.js';

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    fetchTicket: vi.fn(),
  };
});

vi.mock('../hooks/useWindowSocket.js', () => ({
  useWindowSocket: vi.fn(() => ({ isConnected: true })),
}));

describe('TicketTrackingPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  const renderWithProviders = (ticketId: string = 't-1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/w/win-1/ticket/${ticketId}`]}>
          <Routes>
            <Route path="/w/:windowId/ticket/:ticketId" element={<TicketTrackingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders ticket details with number and waiting status', async () => {
    vi.mocked(api.fetchTicket).mockResolvedValue({
      id: 't-1',
      number: 7,
      status: 'waiting',
      sortKey: 7,
      skipCount: 0,
      aheadCount: 3,
      windowId: 'win-1',
      windowName: 'شؤون الطلاب',
      windowLocation: 'المبنى الرئيسي - الدور الأول',
      service: { id: 'srv-1', name: 'استخراج إفادة قيد' },
      createdAt: new Date().toISOString(),
      calledAt: null,
    });

    renderWithProviders('t-1');

    await waitFor(() => {
      expect(screen.getByText('7')).toBeDefined();
      expect(screen.getByText('قيد الانتظار')).toBeDefined();
      expect(screen.getByText('يوجد 3 في قائمة الانتظار قبلك')).toBeDefined();
      expect(screen.getByText('استخراج إفادة قيد')).toBeDefined();
    });
  });

  it('displays the prominent "حان دورك الآن!" banner when status is called', async () => {
    vi.mocked(api.fetchTicket).mockResolvedValue({
      id: 't-2',
      number: 12,
      status: 'called',
      sortKey: 12,
      skipCount: 0,
      aheadCount: 0,
      windowId: 'win-1',
      windowName: 'شؤون الطلاب',
      service: { id: 'srv-1', name: 'سحب ملف' },
      createdAt: new Date().toISOString(),
      calledAt: new Date().toISOString(),
    });

    renderWithProviders('t-2');

    await waitFor(() => {
      expect(screen.getByText('حان دورك الآن!')).toBeDefined();
      expect(screen.getByText('يرجى التوجه إلى الشباك وتقديم أوراقك للموظف فوراً')).toBeDefined();
      expect(screen.getByText('مستدعاة الآن')).toBeDefined();
      expect(screen.getByText('12')).toBeDefined();
    });
  });

  it('renders served state clearly and clears cached active ticket', async () => {
    window.localStorage.setItem('dawrak_active_ticket_win-1', 't-3');

    vi.mocked(api.fetchTicket).mockResolvedValue({
      id: 't-3',
      number: 4,
      status: 'served',
      sortKey: 4,
      skipCount: 0,
      aheadCount: 0,
      windowId: 'win-1',
      service: { id: 'srv-1', name: 'سحب ملف' },
      createdAt: new Date().toISOString(),
      calledAt: new Date().toISOString(),
    });

    renderWithProviders('t-3');

    await waitFor(() => {
      expect(screen.getByText('تمت خدمتك بنجاح')).toBeDefined();
      expect(screen.getByText('تمت الخدمة')).toBeDefined();
    });

    // Check that active ticket in localStorage was cleared
    expect(window.localStorage.getItem('dawrak_active_ticket_win-1')).toBeNull();
  });

  it('renders cancelled note and clears cached active ticket', async () => {
    window.localStorage.setItem('dawrak_active_ticket_win-1', 't-4');

    vi.mocked(api.fetchTicket).mockResolvedValue({
      id: 't-4',
      number: 8,
      status: 'cancelled',
      sortKey: 8,
      skipCount: 2,
      aheadCount: 0,
      windowId: 'win-1',
      service: { id: 'srv-1', name: 'سحب ملف' },
      createdAt: new Date().toISOString(),
      calledAt: null,
    });

    renderWithProviders('t-4');

    await waitFor(() => {
      expect(screen.getByText('تم إلغاء التذكرة')).toBeDefined();
      expect(screen.getByText('ملغاة')).toBeDefined();
    });

    // Check that active ticket in localStorage was cleared
    expect(window.localStorage.getItem('dawrak_active_ticket_win-1')).toBeNull();
  });

  it('verifies that polling is turned off when socket is connected', async () => {
    vi.mocked(socketHook.useWindowSocket).mockReturnValue({ isConnected: true });

    vi.mocked(api.fetchTicket).mockResolvedValue({
      id: 't-5',
      number: 1,
      status: 'waiting',
      sortKey: 1,
      skipCount: 0,
      aheadCount: 0,
      windowId: 'win-1',
      service: { id: 'srv-1', name: 'خدمة' },
      createdAt: new Date().toISOString(),
      calledAt: null,
    });

    renderWithProviders('t-5');

    await waitFor(() => {
      expect(screen.getByText('1')).toBeDefined();
    });

    // Verify query option refetchInterval in queryClient cache
    const query = queryClient.getQueryCache().find({ queryKey: ['ticket', 't-5'] });
    expect(query).toBeDefined();
    expect((query?.options as any).refetchInterval).toBe(false);
  });
});

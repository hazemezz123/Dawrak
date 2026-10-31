import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WindowQrPage from '../pages/WindowQrPage.js';
import * as api from '../lib/api.js';

// Mock qrcode.react to inspect passed props while rendering
vi.mock('qrcode.react', () => ({
  QRCodeSVG: vi.fn((props: any) => (
    <svg data-testid="qr-code-svg" data-value={props.value} width={props.size} height={props.size} />
  )),
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    fetchWindow: vi.fn(),
  };
});

describe('WindowQrPage Component', () => {
  let queryClient: QueryClient;
  const WINDOW_1_ID = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderWithProviders = (windowId: string = WINDOW_1_ID) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/qr/${windowId}`]}>
          <Routes>
            <Route path="/qr/:windowId" element={<WindowQrPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders the QR with value equal to {VITE_PUBLIC_APP_URL}/w/{windowId} for window 1', async () => {
    vi.mocked(api.fetchWindow).mockResolvedValue({
      id: WINDOW_1_ID,
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي - الدور الأول',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    renderWithProviders(WINDOW_1_ID);

    await waitFor(() => {
      expect(screen.getByText('شؤون الطلاب')).toBeDefined();
      expect(screen.getByText('المبنى الرئيسي - الدور الأول')).toBeDefined();
      expect(screen.getByText('امسح الكود لأخذ دورك')).toBeDefined();
    });

    const expectedBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:5173';
    const expectedUrl = `${expectedBaseUrl}/w/${WINDOW_1_ID}`;

    const qrElement = screen.getByTestId('qr-code-svg');
    expect(qrElement).toBeDefined();
    expect(qrElement.getAttribute('data-value')).toBe(expectedUrl);

    // Verify visible URL text for manual check
    expect(screen.getByText(expectedUrl)).toBeDefined();
  });

  it('displays the Arabic "الشباك غير موجود" message for an unknown window ID', async () => {
    vi.mocked(api.fetchWindow).mockRejectedValue({
      code: 'WINDOW_NOT_FOUND',
      message: 'الشباك غير موجود',
    });

    renderWithProviders('unknown-window-id');

    await waitFor(() => {
      expect(screen.getByText('الشباك غير موجود')).toBeDefined();
      expect(screen.getByText('العودة للرئيسية')).toBeDefined();
    });
  });

  it('verifies the print button has the print:hidden class to avoid rendering inside @media print output', async () => {
    vi.mocked(api.fetchWindow).mockResolvedValue({
      id: WINDOW_1_ID,
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي - الدور الأول',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    renderWithProviders(WINDOW_1_ID);

    await waitFor(() => {
      expect(screen.getByText('شؤون الطلاب')).toBeDefined();
    });

    const printButton = screen.getByRole('button', { name: /طباعة/i });
    expect(printButton).toBeDefined();
    expect(printButton.className).toContain('print:hidden');
  });
});

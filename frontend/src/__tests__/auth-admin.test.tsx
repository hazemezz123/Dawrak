import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.js';
import LoginPage from '../pages/LoginPage.js';
import AdminDashboardPage from '../pages/AdminDashboardPage.js';
import { StaffWindowRoute } from '../App.js';
import * as api from '../lib/api.js';

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchAdminWindows: vi.fn(),
    fetchAdminUsers: vi.fn(),
    assignWindowStaff: vi.fn(),
    createAdminWindow: vi.fn(),
    updateAdminWindow: vi.fn(),
    createAdminService: vi.fn(),
    updateAdminService: vi.fn(),
    createAdminUser: vi.fn(),
    updateAdminUser: vi.fn(),
    fetchWindow: vi.fn(),
    fetchQueue: vi.fn(),
  };
});

describe('Frontend Auth & Admin Tests (Part 7)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('login form submits and redirects by role (SUPER_ADMIN -> /admin)', async () => {
    vi.mocked(api.fetchCurrentUser).mockRejectedValueOnce(new Error('Unauthorized'));
    vi.mocked(api.loginUser).mockResolvedValueOnce({
      user: {
        id: 'admin-1',
        name: 'مدير النظام',
        email: 'admin@dawrak.faculty.edu',
        role: 'SUPER_ADMIN',
        windowIds: [],
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={<div data-testid="admin-page">لوحة إدارة النظام</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const emailInput = screen.getByLabelText(/البريد الإلكتروني/i);
    const passwordInput = screen.getByLabelText(/كلمة المرور/i);
    const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول/i });

    fireEvent.change(emailInput, { target: { value: 'admin@dawrak.faculty.edu' } });
    fireEvent.change(passwordInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.loginUser).toHaveBeenCalledWith('admin@dawrak.faculty.edu', 'SuperSecret123!');
      expect(screen.getByTestId('admin-page')).toBeDefined();
    });
  });

  it('login form submits and redirects by role (STAFF -> /admin/:windowId)', async () => {
    vi.mocked(api.fetchCurrentUser).mockRejectedValueOnce(new Error('Unauthorized'));
    vi.mocked(api.loginUser).mockResolvedValueOnce({
      user: {
        id: 'staff-1',
        name: 'موظف 1',
        email: 'staff1@dawrak.faculty.edu',
        role: 'STAFF',
        windowIds: ['win-100'],
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin/:windowId" element={<div data-testid="staff-panel">لوحة الشباك</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const emailInput = screen.getByLabelText(/البريد الإلكتروني/i);
    const passwordInput = screen.getByLabelText(/كلمة المرور/i);
    const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول/i });

    fireEvent.change(emailInput, { target: { value: 'staff1@dawrak.faculty.edu' } });
    fireEvent.change(passwordInput, { target: { value: 'StaffSecret123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.loginUser).toHaveBeenCalledWith('staff1@dawrak.faculty.edu', 'StaffSecret123!');
      expect(screen.getByTestId('staff-panel')).toBeDefined();
    });
  });

  it('admin assignment save sends the right userIds', async () => {
    vi.mocked(api.fetchCurrentUser).mockResolvedValue({
      id: 'admin-1',
      name: 'مدير النظام',
      email: 'admin@dawrak.faculty.edu',
      role: 'SUPER_ADMIN',
      windowIds: [],
    });

    vi.mocked(api.fetchAdminWindows).mockResolvedValue([
      {
        id: 'win-1',
        name: 'شؤون الطلاب',
        location: 'المبنى الرئيسي',
        isActive: true,
        createdAt: new Date().toISOString(),
        services: [],
        staff: [],
      },
    ]);

    vi.mocked(api.fetchAdminUsers).mockResolvedValue([
      {
        id: 'user-staff-1',
        name: 'أحمد محمود',
        email: 'ahmed@dawrak.faculty.edu',
        role: 'STAFF',
        isActive: true,
        windowIds: [],
      },
      {
        id: 'user-staff-2',
        name: 'سارة خالد',
        email: 'sara@dawrak.faculty.edu',
        role: 'STAFF',
        isActive: true,
        windowIds: [],
      },
    ]);

    vi.mocked(api.assignWindowStaff).mockResolvedValue({
      message: 'تم تحديث طاقم عمل الشباك بنجاح',
      windowId: 'win-1',
      userIds: ['user-staff-1'],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <AdminDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Switch to Assignments tab
    const assignmentsTabBtn = await screen.findByRole('button', { name: /تعيينات الشبابيك/i });
    fireEvent.click(assignmentsTabBtn);

    // Check Ahmed's checkbox
    const ahmedCheckbox = await screen.findByLabelText(/أحمد محمود/i);
    fireEvent.click(ahmedCheckbox);

    // Click Save Assignments
    const saveBtn = screen.getByRole('button', { name: /حفظ التعيينات/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.assignWindowStaff).toHaveBeenCalledWith('win-1', ['user-staff-1']);
    });
  });

  it('unauthorized staff sees the 403 message when opening unassigned window', async () => {
    vi.mocked(api.fetchCurrentUser).mockResolvedValue({
      id: 'staff-2',
      name: 'موظف غير مصرح',
      email: 'staff2@dawrak.faculty.edu',
      role: 'STAFF',
      windowIds: ['win-other'], // Only assigned to win-other
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin/win-forbidden']}>
            <Routes>
              <Route
                path="/admin/:windowId"
                element={
                  <StaffWindowRoute>
                    <div data-testid="staff-panel">لوحة الشباك</div>
                  </StaffWindowRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/403 — غير مصرح/i)).toBeDefined();
      expect(screen.getByText(/ليس لديك صلاحية الوصول إلى هذا الشباك/i)).toBeDefined();
      expect(screen.queryByTestId('staff-panel')).toBeNull();
    });
  });
});

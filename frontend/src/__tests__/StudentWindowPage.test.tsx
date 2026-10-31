import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StudentWindowPage from '../pages/StudentWindowPage.js';
import * as api from '../lib/api.js';

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    fetchWindow: vi.fn(),
    fetchServices: vi.fn(),
    createTicket: vi.fn(),
    fetchStudentMe: vi.fn(),
    registerStudent: vi.fn(),
  };
});

const REGISTERED_STUDENT = {
  id: 'student-1',
  fullName: 'أحمد علي',
  phone: '01012345678',
};

describe('StudentWindowPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    window.localStorage.clear();
    vi.clearAllMocks();

    vi.mocked(api.fetchStudentMe).mockResolvedValue(REGISTERED_STUDENT);
    vi.mocked(api.fetchServices).mockResolvedValue([]);
  });

  const renderWithProviders = (windowId: string = 'win-1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/w/${windowId}`]}>
          <Routes>
            <Route path="/w/:windowId" element={<StudentWindowPage />} />
            <Route path="/w/:windowId/ticket/:ticketId" element={<div>صفحة التذكرة</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders window title, location, and list of services correctly', async () => {
    vi.mocked(api.fetchWindow).mockResolvedValue({
      id: 'win-1',
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي - الدور الأول',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    vi.mocked(api.fetchServices).mockResolvedValue([
      { id: 'srv-1', windowId: 'win-1', name: 'استخراج إفادة قيد', isActive: true },
      { id: 'srv-2', windowId: 'win-1', name: 'طباعة استمارة تدريب', isActive: true },
    ]);

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('شؤون الطلاب')).toBeDefined();
      expect(screen.getByText('المبنى الرئيسي - الدور الأول')).toBeDefined();
      expect(screen.getByText('استخراج إفادة قيد')).toBeDefined();
      expect(screen.getByText('طباعة استمارة تدريب')).toBeDefined();
    });
  });

  it('calls createTicket mutation when a service is clicked', async () => {
    vi.mocked(api.fetchWindow).mockResolvedValue({
      id: 'win-1',
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    vi.mocked(api.fetchServices).mockResolvedValue([
      { id: 'srv-1', windowId: 'win-1', name: 'استخراج إفادة قيد', isActive: true },
    ]);

    vi.mocked(api.createTicket).mockResolvedValue({
      id: 'ticket-123',
      number: 1,
      status: 'waiting',
      sortKey: 1,
      skipCount: 0,
      aheadCount: 0,
      windowId: 'win-1',
      service: { id: 'srv-1', name: 'استخراج إفادة قيد' },
      createdAt: new Date().toISOString(),
      calledAt: null,
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('استخراج إفادة قيد')).toBeDefined();
    });

    const serviceButton = screen.getByText('استخراج إفادة قيد').closest('button');
    expect(serviceButton).toBeDefined();
    fireEvent.click(serviceButton!);

    await waitFor(() => {
      expect(api.createTicket).toHaveBeenCalledWith(
        'win-1',
        'srv-1',
        expect.any(String)
      );
    });
  });

  it('shows an active ticket banner if student already has a saved ticket', async () => {
    window.localStorage.setItem('dawrak_active_ticket_win-1', 'active-ticket-99');

    vi.mocked(api.fetchWindow).mockResolvedValue({
      id: 'win-1',
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    vi.mocked(api.fetchServices).mockResolvedValue([]);

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('لديك تذكرة نشطة حالياً')).toBeDefined();
      expect(screen.getByText('عرض تذكرتي')).toBeDefined();
    });
  });

  it('shows the registration form when the device is not registered', async () => {
    vi.mocked(api.fetchStudentMe).mockRejectedValue({
      code: 'STUDENT_NOT_REGISTERED',
      message: 'لم يتم تسجيل بيانات الطالب على هذا الجهاز.',
    });

    renderWithProviders('win-1');

    await waitFor(() => {
      expect(screen.getByText('تسجيل بيانات الطالب')).toBeDefined();
      expect(screen.getByLabelText('الاسم بالكامل')).toBeDefined();
      expect(screen.getByLabelText('رقم الموبايل')).toBeDefined();
      expect(screen.queryByText('استخراج إفادة قيد')).toBeNull();
    });
  });

  it('registers the student and shows services without reloading', async () => {
    vi.mocked(api.fetchStudentMe).mockRejectedValue({
      code: 'STUDENT_NOT_REGISTERED',
      message: 'لم يتم تسجيل بيانات الطالب على هذا الجهاز.',
    });
    vi.mocked(api.fetchServices).mockResolvedValue([
      { id: 'srv-1', windowId: 'win-1', name: 'استخراج إفادة قيد', isActive: true },
    ]);
    vi.mocked(api.registerStudent).mockResolvedValue(REGISTERED_STUDENT);

    renderWithProviders('win-1');

    const nameInput = await screen.findByLabelText('الاسم بالكامل');
    fireEvent.change(nameInput, { target: { value: '  أحمد   علي ' } });
    fireEvent.change(screen.getByLabelText('رقم الموبايل'), {
      target: { value: '010 1234 5678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /تسجيل ومتابعة/ }));

    await waitFor(() => {
      expect(api.registerStudent).toHaveBeenCalledWith({
        deviceId: expect.any(String),
        fullName: '  أحمد   علي ',
        phone: '010 1234 5678',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('استخراج إفادة قيد')).toBeDefined();
      expect(screen.queryByText('تسجيل بيانات الطالب')).toBeNull();
    });
  });

  it('shows the exact generic message on PHONE_NAME_MISMATCH', async () => {
    vi.mocked(api.fetchStudentMe).mockRejectedValue({
      code: 'STUDENT_NOT_REGISTERED',
      message: 'لم يتم تسجيل بيانات الطالب على هذا الجهاز.',
    });
    vi.mocked(api.registerStudent).mockRejectedValue({
      code: 'PHONE_NAME_MISMATCH',
      message: 'البيانات دي مش مطابقة لسجل موجود، تأكد من الاسم والرقم أو كلم شؤون الطلاب.',
    });

    renderWithProviders('win-1');

    fireEvent.change(await screen.findByLabelText('الاسم بالكامل'), {
      target: { value: 'أحمد علي' },
    });
    fireEvent.change(screen.getByLabelText('رقم الموبايل'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /تسجيل ومتابعة/ }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'البيانات دي مش مطابقة لسجل موجود، تأكد من الاسم والرقم أو كلم شؤون الطلاب.'
        )
      ).toBeDefined();
    });
  });

  it('rejects an invalid phone inline without calling the API', async () => {
    vi.mocked(api.fetchStudentMe).mockRejectedValue({
      code: 'STUDENT_NOT_REGISTERED',
      message: 'لم يتم تسجيل بيانات الطالب على هذا الجهاز.',
    });

    renderWithProviders('win-1');

    fireEvent.change(await screen.findByLabelText('الاسم بالكامل'), {
      target: { value: 'أحمد علي' },
    });
    fireEvent.change(screen.getByLabelText('رقم الموبايل'), {
      target: { value: '02012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /تسجيل ومتابعة/ }));

    await waitFor(() => {
      expect(
        screen.getByText('يرجى إدخال رقم موبايل مصري صحيح يبدأ بـ 01.')
      ).toBeDefined();
    });
    expect(api.registerStudent).not.toHaveBeenCalled();
  });

  it('shows a generic retryable error when the device is linked to another student', async () => {
    vi.mocked(api.fetchStudentMe).mockRejectedValue({
      code: 'STUDENT_NOT_REGISTERED',
      message: 'لم يتم تسجيل بيانات الطالب على هذا الجهاز.',
    });
    vi.mocked(api.registerStudent).mockRejectedValue({
      code: 'DEVICE_ALREADY_LINKED',
      message: 'هذا الجهاز مرتبط ببيانات طالب آخر، يرجى التواصل مع شؤون الطلاب.',
    });

    renderWithProviders('win-1');

    fireEvent.change(await screen.findByLabelText('الاسم بالكامل'), {
      target: { value: 'أحمد علي' },
    });
    fireEvent.change(screen.getByLabelText('رقم الموبايل'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /تسجيل ومتابعة/ }));

    await waitFor(() => {
      expect(screen.getByText(/مرتبط ببيانات طالب آخر/)).toBeDefined();
    });
    expect(
      (screen.getByRole('button', { name: /تسجيل ومتابعة/ }) as HTMLButtonElement).disabled
    ).toBe(false);
  });
});

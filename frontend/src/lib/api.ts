export interface WindowData {
  id: string;
  name: string;
  location: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServiceData {
  id: string;
  windowId: string;
  name: string;
  isActive: boolean;
}

export type TicketStatus = 'waiting' | 'called' | 'served' | 'cancelled';

export interface TicketData {
  id: string;
  number: number;
  status: TicketStatus;
  sortKey: number;
  skipCount: number;
  aheadCount: number;
  windowId: string;
  windowName?: string;
  windowLocation?: string;
  service: {
    id: string;
    name: string;
  };
  createdAt: string;
  calledAt: string | null;
}

export interface QueueItem {
  id: string;
  number: number;
  status: TicketStatus;
  sortKey: number;
  skipCount: number;
  calledAt?: string | null;
  createdAt?: string;
  service: {
    id: string;
    name: string;
  };
  student?: StudentData | null;
}

export interface StudentData {
  id: string;
  fullName: string;
  phone: string;
}

export interface QueueSnapshot {
  windowId: string;
  date: string;
  called: QueueItem | null;
  waiting: QueueItem[];
  waitingCount: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export function translateError(error: any): string {
  if (error?.code === 'LOCALSTORAGE_UNAVAILABLE' || error?.message === 'LOCALSTORAGE_UNAVAILABLE') {
    return 'التخزين المحلي (LocalStorage) غير متاح في متصفحك. يرجى تعطيل وضع التصفح الخفي والسماح بحفظ البيانات للمتابعة.';
  }

  if (error?.code === 'ACTIVE_TICKET_EXISTS') {
    return 'لديك تذكرة نشطة بالفعل في هذا الشباك.';
  }

  if (error?.code === 'STALE_TICKET') {
    return 'تم تحديث التذكرة بالفعل بواسطة موظف آخر، تم تحديث البيانات.';
  }

  if (error?.code === 'NO_CALLED_TICKET') {
    return 'لا توجد تذكرة مستدعاة حالياً ليتم تخطيها.';
  }

  if (error?.code === 'NO_WAITING_TICKETS') {
    return 'لا توجد تذاكر في قائمة الانتظار لهذا الشباك اليوم.';
  }

  if (error?.code === 'WINDOW_NOT_FOUND') {
    return 'هذا الشباك غير موجود أو تم إيقافه.';
  }

  if (error?.code === 'SERVICE_NOT_FOUND') {
    return 'الخدمة المطلوبة غير متوفرة حالياً.';
  }

  if (error?.code === 'TICKET_NOT_FOUND') {
    return 'التذكرة غير موجودة.';
  }

  if (error?.code === 'STUDENT_NOT_REGISTERED') {
    return 'يرجى تسجيل بيانات الطالب أولاً قبل أخذ تذكرة.';
  }

  if (error?.code === 'PHONE_NAME_MISMATCH') {
    return 'البيانات دي مش مطابقة لسجل موجود، تأكد من الاسم والرقم أو كلم شؤون الطلاب.';
  }

  if (error?.code === 'DEVICE_ALREADY_LINKED') {
    return 'هذا الجهاز مرتبط ببيانات طالب آخر، يرجى التواصل مع شؤون الطلاب.';
  }

  if (error?.code === 'REGISTRATION_CONFLICT') {
    return 'تعذر إتمام التسجيل بسبب تعارض في البيانات، يرجى المحاولة مرة أخرى.';
  }

  if (error?.message && typeof error.message === 'string' && error.message !== 'Failed to fetch') {
    return error.message;
  }

  return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
}

export async function fetchWindow(windowId: string): Promise<WindowData> {
  const res = await fetch(`/api/windows/${windowId}`);
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'FETCH_ERROR', message: 'فشل جلب بيانات الشباك' };
  }
  return data;
}

export async function fetchServices(windowId: string): Promise<ServiceData[]> {
  const res = await fetch(`/api/windows/${windowId}/services`);
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'FETCH_ERROR', message: 'فشل جلب الخدمات المتاحة' };
  }
  return data;
}

export async function fetchStudentMe(deviceId: string): Promise<StudentData> {
  const res = await fetch(`/api/student/me?device_id=${encodeURIComponent(deviceId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'FETCH_STUDENT_ERROR', message: 'فشل جلب بيانات الطالب' };
  }
  return data;
}

export async function registerStudent(input: {
  deviceId: string;
  fullName: string;
  phone: string;
}): Promise<StudentData> {
  const res = await fetch('/api/student/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'REGISTER_STUDENT_ERROR', message: 'فشل تسجيل بيانات الطالب' };
  }
  return data;
}

export async function createTicket(
  windowId: string,
  serviceId: string,
  deviceId: string
): Promise<TicketData> {
  const res = await fetch(`/api/windows/${windowId}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceId, deviceId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'CREATE_TICKET_ERROR', message: 'فشل إصدار التذكرة' };
  }
  return data;
}

export async function fetchTicket(ticketId: string): Promise<TicketData> {
  const res = await fetch(`/api/tickets/${ticketId}`);
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'FETCH_TICKET_ERROR', message: 'فشل جلب بيانات التذكرة' };
  }
  return data;
}

export async function fetchQueue(windowId: string): Promise<QueueSnapshot> {
  const res = await fetch(`/api/windows/${windowId}/queue`);
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'FETCH_QUEUE_ERROR', message: 'فشل جلب قائمة الانتظار' };
  }
  return data;
}

export interface WindowDisplayData {
  window: {
    id: string;
    name: string;
    location: string;
    isActive: boolean;
  };
  called: {
    id: string;
    number: number;
    calledAt?: string | null;
    service: {
      id: string;
      name: string;
    };
  } | null;
}

export async function fetchWindowDisplay(windowId: string): Promise<WindowDisplayData> {
  const res = await fetch(`/api/windows/${windowId}/display`);
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'FETCH_DISPLAY_ERROR', message: 'فشل جلب بيانات شاشة العرض' };
  }
  return data;
}

export async function callNext(
  windowId: string,
  currentTicketId?: string
): Promise<{ ticket: QueueItem | null }> {
  const res = await fetch(`/api/windows/${windowId}/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentTicketId ? { currentTicketId } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'CALL_NEXT_ERROR', message: 'فشل استدعاء التذكرة التالية' };
  }
  return data;
}

export async function skipTicket(
  windowId: string,
  currentTicketId: string
): Promise<{ ticket: QueueItem }> {
  const res = await fetch(`/api/windows/${windowId}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentTicketId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'SKIP_TICKET_ERROR', message: 'فشل تخطي التذكرة' };
  }
  return data;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STAFF';
  isActive?: boolean;
  createdAt?: string;
  windowIds: string[];
  assignedWindows?: { id: string; name: string }[];
}

export interface AdminWindowData extends WindowData {
  services: ServiceData[];
  staff: {
    user: {
      id: string;
      name: string;
      email: string;
      isActive: boolean;
    };
  }[];
}

export async function loginUser(email: string, password: string): Promise<{ user: UserData }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'LOGIN_FAILED', message: 'فشل تسجيل الدخول' };
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function fetchCurrentUser(): Promise<UserData> {
  const res = await fetch('/api/auth/me');
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'UNAUTHORIZED', message: 'غير مسجل' };
  }
  return data;
}

export async function fetchAdminWindows(): Promise<AdminWindowData[]> {
  const res = await fetch('/api/admin/windows');
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل جلب الشبابيك' };
  }
  return data;
}

export async function createAdminWindow(windowData: {
  name: string;
  location: string;
  isActive?: boolean;
}): Promise<WindowData> {
  const res = await fetch('/api/admin/windows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(windowData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل إنشاء الشباك' };
  }
  return data;
}

export async function updateAdminWindow(
  id: string,
  windowData: { name?: string; location?: string; isActive?: boolean }
): Promise<WindowData> {
  const res = await fetch(`/api/admin/windows/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(windowData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل تحديث الشباك' };
  }
  return data;
}

export async function createAdminService(
  windowId: string,
  serviceData: { name: string; isActive?: boolean }
): Promise<ServiceData> {
  const res = await fetch(`/api/admin/windows/${windowId}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serviceData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل إضافة الخدمة' };
  }
  return data;
}

export async function updateAdminService(
  serviceId: string,
  serviceData: { name?: string; isActive?: boolean }
): Promise<ServiceData> {
  const res = await fetch(`/api/admin/services/${serviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serviceData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل تحديث الخدمة' };
  }
  return data;
}

export async function fetchAdminUsers(): Promise<UserData[]> {
  const res = await fetch('/api/admin/users');
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل جلب المستخدمين' };
  }
  return data;
}

export async function createAdminUser(userData: {
  name: string;
  email: string;
  password: string;
  role?: 'SUPER_ADMIN' | 'STAFF';
}): Promise<UserData> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل إنشاء المستخدم' };
  }
  return data;
}

export async function updateAdminUser(
  userId: string,
  userData: { name?: string; isActive?: boolean; password?: string }
): Promise<UserData> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل تحديث المستخدم' };
  }
  return data;
}

export async function assignWindowStaff(
  windowId: string,
  userIds: string[]
): Promise<{ message: string; windowId: string; userIds: string[] }> {
  const res = await fetch(`/api/admin/windows/${windowId}/staff`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data.error || { code: 'ADMIN_ERROR', message: 'فشل تعيين طاقم العمل' };
  }
  return data;
}

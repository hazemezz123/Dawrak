import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.js';
import { M3Select } from '../components/M3Select.js';
import {
  fetchAdminWindows,
  createAdminWindow,
  updateAdminWindow,
  createAdminService,
  updateAdminService,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  assignWindowStaff,
  translateError,
  type AdminWindowData,
  type UserData,
} from '../lib/api.js';

type Tab = 'windows' | 'services' | 'staff' | 'assignments';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('windows');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: windows = [], isLoading: isWindowsLoading } = useQuery({
    queryKey: ['admin', 'windows'],
    queryFn: fetchAdminWindows,
  });

  const { data: users = [], isLoading: isUsersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
  });

  // State for Windows tab
  const [newWindowName, setNewWindowName] = useState('');
  const [newWindowLocation, setNewWindowLocation] = useState('');
  const [editingWindow, setEditingWindow] = useState<{ id: string; name: string; location: string } | null>(null);

  // State for Services tab
  const [selectedWindowIdForService, setSelectedWindowIdForService] = useState<string>('');
  const [newServiceName, setNewServiceName] = useState('');
  const [editingService, setEditingService] = useState<{ id: string; name: string } | null>(null);

  // State for Staff tab
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [resettingUserPassword, setResettingUserPassword] = useState<{ id: string; name: string; password: string } | null>(null);

  // State for Assignments tab
  const [assignmentWindowId, setAssignmentWindowId] = useState<string>('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Mutations
  const createWindowMutation = useMutation({
    mutationFn: createAdminWindow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'windows'] });
      setNewWindowName('');
      setNewWindowLocation('');
      setFeedback({ type: 'success', message: 'تم إنشاء الشباك بنجاح' });
    },
    onError: (err: any) => setFeedback({ type: 'error', message: translateError(err) }),
  });

  const updateWindowMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAdminWindow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'windows'] });
      setEditingWindow(null);
      setFeedback({ type: 'success', message: 'تم تحديث بيانات الشباك بنجاح' });
    },
    onError: (err: any) => setFeedback({ type: 'error', message: translateError(err) }),
  });

  const createServiceMutation = useMutation({
    mutationFn: ({ windowId, name }: { windowId: string; name: string }) =>
      createAdminService(windowId, { name, isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'windows'] });
      setNewServiceName('');
      setFeedback({ type: 'success', message: 'تمت إضافة الخدمة بنجاح' });
    },
    onError: (err: any) => setFeedback({ type: 'error', message: translateError(err) }),
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAdminService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'windows'] });
      setEditingService(null);
      setFeedback({ type: 'success', message: 'تم تحديث الخدمة بنجاح' });
    },
    onError: (err: any) => setFeedback({ type: 'error', message: translateError(err) }),
  });

  const createUserMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setFeedback({ type: 'success', message: 'تم إنشاء حساب الموظف بنجاح' });
    },
    onError: (err: any) => setFeedback({ type: 'error', message: translateError(err) }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAdminUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setResettingUserPassword(null);
      setFeedback({ type: 'success', message: 'تم تحديث الحساب بنجاح' });
    },
    onError: (err: any) => setFeedback({ type: 'error', message: translateError(err) }),
  });

  const assignStaffMutation = useMutation({
    mutationFn: ({ windowId, userIds }: { windowId: string; userIds: string[] }) =>
      assignWindowStaff(windowId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'windows'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setFeedback({ type: 'success', message: 'تم حفظ تعيينات طاقم العمل بنجاح' });
    },
    onError: (err: any) => setFeedback({ type: 'error', message: translateError(err) }),
  });

  // Keep assignment window and staff selected in sync
  const currentAssignedWindow = windows.find((w) => w.id === (assignmentWindowId || windows[0]?.id));
  const activeWindowForServices = windows.find((w) => w.id === (selectedWindowIdForService || windows[0]?.id));

  const windowOptions = windows.map((w) => ({
    value: w.id,
    label: w.name,
    description: w.location,
    icon: 'storefront',
  }));

  const handleWindowSelectForAssignment = (winId: string) => {
    setAssignmentWindowId(winId);
    const win = windows.find((w) => w.id === winId);
    if (win) {
      setSelectedStaffIds(win.staff.map((s) => s.user.id));
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Top App Bar */}
      <header className="bg-surface-container-low border-b border-outline-variant/30 sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              <span className="material-symbols-rounded text-xl">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="text-title-medium font-bold text-on-surface leading-none">دَوْرَك</h1>
              <p className="text-label-small text-on-surface-variant mt-0.5">لوحة إدارة النظام</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-small font-bold transition min-h-[40px]"
            >
              <span className="material-symbols-rounded text-base">visibility</span>
              <span className="hidden sm:inline">معاينة النظام للطلاب</span>
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-error-container text-on-error-container text-label-small font-bold hover:opacity-90 transition min-h-[40px] cursor-pointer"
            >
              <span className="material-symbols-rounded text-base">logout</span>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Feedback Alert */}
        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-2xl border text-body-medium font-semibold flex items-center justify-between gap-2 transition-all ${
              feedback.type === 'success'
                ? 'bg-success-container text-on-success-container border-success/30'
                : 'bg-error-container text-on-error-container border-error/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-xl shrink-0">
                {feedback.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="p-1 rounded-full hover:bg-black/5 cursor-pointer text-sm"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-outline-variant/30" aria-label="أقسام الإدارة">
          <TabButton
            active={activeTab === 'windows'}
            onClick={() => setActiveTab('windows')}
            icon="view_week"
            label="الشبابيك"
            count={windows.length}
          />
          <TabButton
            active={activeTab === 'services'}
            onClick={() => setActiveTab('services')}
            icon="format_list_bulleted"
            label="الخدمات"
          />
          <TabButton
            active={activeTab === 'staff'}
            onClick={() => setActiveTab('staff')}
            icon="badge"
            label="حسابات الموظفين"
            count={users.length}
          />
          <TabButton
            active={activeTab === 'assignments'}
            onClick={() => {
              setActiveTab('assignments');
              if (windows.length > 0 && !assignmentWindowId) {
                handleWindowSelectForAssignment(windows[0].id);
              }
            }}
            icon="assignment_ind"
            label="تعيينات الشبابيك"
          />
        </nav>

        {/* TAB 1: WINDOWS */}
        {activeTab === 'windows' && (
          <section className="space-y-5" aria-labelledby="windows-heading">
            {/* Create Window Card */}
            <div className="bg-surface-container-low rounded-3xl p-5 sm:p-6 border border-outline-variant/30">
              <h2 id="windows-heading" className="text-title-medium font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-rounded text-primary">add_circle</span>
                <span>إضافة شباك جديد</span>
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newWindowName.trim() && newWindowLocation.trim()) {
                    createWindowMutation.mutate({
                      name: newWindowName.trim(),
                      location: newWindowLocation.trim(),
                      isActive: true,
                    });
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <input
                  type="text"
                  placeholder="اسم الشباك (مثال: شؤون الخريجين)"
                  value={newWindowName}
                  onChange={(e) => setNewWindowName(e.target.value)}
                  required
                  className="min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60 text-body-medium focus:border-primary focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="الموقع (مثال: المبنى الإداري - الدور الثاني)"
                  value={newWindowLocation}
                  onChange={(e) => setNewWindowLocation(e.target.value)}
                  required
                  className="min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60 text-body-medium focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={createWindowMutation.isPending}
                  className="min-h-[48px] px-6 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-full text-label-large transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-rounded text-lg">add</span>
                  <span>حفظ الشباك</span>
                </button>
              </form>
            </div>

            {/* Windows List */}
            <div className="bg-surface-container-low rounded-3xl border border-outline-variant/30 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="text-title-medium font-bold text-on-surface">الشبابيك المسجلة ({windows.length})</h3>
              </div>

              {isWindowsLoading ? (
                <div className="p-8 text-center text-on-surface-variant">جارٍ تحميل الشبابيك...</div>
              ) : windows.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">لا توجد شبابيك مضافة حتى الآن</div>
              ) : (
                <div className="divide-y divide-outline-variant/20" role="list">
                  {windows.map((win: AdminWindowData) => (
                    <div
                      key={win.id}
                      role="listitem"
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-container/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-title-medium font-bold text-on-surface">{win.name}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-label-small font-bold ${
                              win.isActive
                                ? 'bg-success-container text-on-success-container'
                                : 'bg-surface-container-highest text-outline'
                            }`}
                          >
                            {win.isActive ? 'نشط' : 'معطل'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-body-small text-on-surface-variant">
                          <span className="material-symbols-rounded text-sm">location_on</span>
                          <span>{win.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-label-small text-on-surface-variant mt-1">
                          <span>{win.services.length} خدمة</span>
                          <span>•</span>
                          <span>{win.staff.length} موظف مخصص</span>
                        </div>
                      </div>

                      {/* Window Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/qr/${win.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-small font-bold transition min-h-[44px]"
                          title="عرض رمز QR للطباعة"
                        >
                          <span className="material-symbols-rounded text-base text-primary">qr_code</span>
                          <span>رمز QR</span>
                        </Link>

                        <Link
                          to={`/display/${win.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-small font-bold transition min-h-[44px]"
                          title="عرض شاشة العرض العامة"
                        >
                          <span className="material-symbols-rounded text-base text-primary">tv</span>
                          <span>شاشة العرض</span>
                        </Link>

                        <Link
                          to={`/admin/${win.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-small font-bold transition min-h-[44px]"
                          title="فتح لوحة موظف الشباك"
                        >
                          <span className="material-symbols-rounded text-base text-primary">open_in_new</span>
                          <span>لوحة الموظف</span>
                        </Link>

                        <button
                          onClick={() => setEditingWindow({ id: win.id, name: win.name, location: win.location })}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-small font-bold transition min-h-[44px] cursor-pointer"
                        >
                          <span className="material-symbols-rounded text-base">edit</span>
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => updateWindowMutation.mutate({ id: win.id, data: { isActive: !win.isActive } })}
                          className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-label-small font-bold transition min-h-[44px] cursor-pointer ${
                            win.isActive
                              ? 'bg-error-container text-on-error-container hover:opacity-90'
                              : 'bg-success-container text-on-success-container hover:opacity-90'
                          }`}
                        >
                          <span className="material-symbols-rounded text-base">
                            {win.isActive ? 'pause_circle' : 'play_circle'}
                          </span>
                          <span>{win.isActive ? 'تعطيل' : 'تفعيل'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit Window Modal */}
            {editingWindow && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-surface-container-lowest rounded-3xl p-6 max-w-md w-full border border-outline-variant/40 space-y-4">
                  <h3 className="text-title-large font-bold text-on-surface">تعديل بيانات الشباك</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-label-medium font-bold mb-1">اسم الشباك</label>
                      <input
                        type="text"
                        value={editingWindow.name}
                        onChange={(e) => setEditingWindow({ ...editingWindow, name: e.target.value })}
                        className="w-full min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60"
                      />
                    </div>
                    <div>
                      <label className="block text-label-medium font-bold mb-1">الموقع</label>
                      <input
                        type="text"
                        value={editingWindow.location}
                        onChange={(e) => setEditingWindow({ ...editingWindow, location: e.target.value })}
                        className="w-full min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingWindow(null)}
                      className="px-4 py-2 rounded-full text-label-large font-bold text-on-surface-variant hover:bg-surface-container"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => {
                        updateWindowMutation.mutate({
                          id: editingWindow.id,
                          data: { name: editingWindow.name, location: editingWindow.location },
                        });
                      }}
                      className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-label-large hover:bg-primary-hover"
                    >
                      حفظ التعديلات
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: SERVICES */}
        {activeTab === 'services' && (
          <section className="space-y-5" aria-labelledby="services-tab-heading">
            {/* Select Window */}
            <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 id="services-tab-heading" className="text-title-medium font-bold text-on-surface">إدارة خدمات الشبابيك</h2>
                <p className="text-body-small text-on-surface-variant">اختر الشباك لإضافة وتعديل الخدمات المقدمة عليه</p>
              </div>

              <M3Select
                label="الشباك"
                value={selectedWindowIdForService || windows[0]?.id || ''}
                options={windowOptions}
                onChange={(val) => setSelectedWindowIdForService(val)}
                className="w-full sm:w-auto min-w-[300px]"
              />
            </div>

            {/* Add Service Card */}
            {activeWindowForServices && (
              <div className="bg-surface-container-low rounded-3xl p-5 sm:p-6 border border-outline-variant/30">
                <h3 className="text-title-small font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-rounded text-primary">add_circle</span>
                  <span>إضافة خدمة جديدة لشباك: {activeWindowForServices.name}</span>
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newServiceName.trim() && activeWindowForServices) {
                      createServiceMutation.mutate({
                        windowId: activeWindowForServices.id,
                        name: newServiceName.trim(),
                      });
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="text"
                    placeholder="اسم الخدمة (مثال: طلب بيان نجاح)"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    required
                    className="flex-1 min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60 text-body-medium focus:border-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={createServiceMutation.isPending}
                    className="min-h-[48px] px-6 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-full text-label-large transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-rounded text-lg">add</span>
                    <span>إضافة الخدمة</span>
                  </button>
                </form>
              </div>
            )}

            {/* Services List for Active Window */}
            {activeWindowForServices && (
              <div className="bg-surface-container-low rounded-3xl border border-outline-variant/30 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-outline-variant/20 flex items-center justify-between">
                  <h3 className="text-title-medium font-bold text-on-surface">
                    الخدمات المتاحة في {activeWindowForServices.name} ({activeWindowForServices.services.length})
                  </h3>
                </div>

                {activeWindowForServices.services.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant">لا توجد خدمات مسجلة لهذا الشباك</div>
                ) : (
                  <div className="divide-y divide-outline-variant/20" role="list">
                    {activeWindowForServices.services.map((svc) => (
                      <div
                        key={svc.id}
                        role="listitem"
                        className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-surface-container/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-rounded text-primary text-xl">description</span>
                          <span className="text-title-small font-bold text-on-surface">{svc.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-label-small font-bold ${
                              svc.isActive
                                ? 'bg-success-container text-on-success-container'
                                : 'bg-surface-container-highest text-outline'
                            }`}
                          >
                            {svc.isActive ? 'نشطة' : 'معطلة'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingService({ id: svc.id, name: svc.name })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-small font-bold transition min-h-[40px] cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base">edit</span>
                            <span>تعديل</span>
                          </button>
                          <button
                            onClick={() => updateServiceMutation.mutate({ id: svc.id, data: { isActive: !svc.isActive } })}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-label-small font-bold transition min-h-[40px] cursor-pointer ${
                              svc.isActive
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-success-container text-on-success-container'
                            }`}
                          >
                            <span>{svc.isActive ? 'تعطيل' : 'تفعيل'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Edit Service Modal */}
            {editingService && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-surface-container-lowest rounded-3xl p-6 max-w-md w-full border border-outline-variant/40 space-y-4">
                  <h3 className="text-title-large font-bold text-on-surface">تعديل اسم الخدمة</h3>
                  <div>
                    <label className="block text-label-medium font-bold mb-1">اسم الخدمة</label>
                    <input
                      type="text"
                      value={editingService.name}
                      onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                      className="w-full min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingService(null)}
                      className="px-4 py-2 rounded-full text-label-large font-bold text-on-surface-variant hover:bg-surface-container"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => {
                        updateServiceMutation.mutate({
                          id: editingService.id,
                          data: { name: editingService.name },
                        });
                      }}
                      className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-label-large hover:bg-primary-hover"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: STAFF ACCOUNTS */}
        {activeTab === 'staff' && (
          <section className="space-y-5" aria-labelledby="staff-heading">
            {/* Create Staff Account Card */}
            <div className="bg-surface-container-low rounded-3xl p-5 sm:p-6 border border-outline-variant/30">
              <h2 id="staff-heading" className="text-title-medium font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-rounded text-primary">person_add</span>
                <span>إنشاء حساب موظف شباك جديد</span>
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newStaffName.trim() && newStaffEmail.trim() && newStaffPassword.length >= 8) {
                    createUserMutation.mutate({
                      name: newStaffName.trim(),
                      email: newStaffEmail.trim(),
                      password: newStaffPassword,
                      role: 'STAFF',
                    });
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3"
              >
                <input
                  type="text"
                  placeholder="اسم الموظف"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  required
                  className="min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60 text-body-medium focus:border-primary focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  required
                  className="min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60 text-body-medium focus:border-primary focus:outline-none dir-ltr text-right"
                  dir="ltr"
                />
                <input
                  type="password"
                  placeholder="كلمة المرور (8+ أحرف)"
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  required
                  minLength={8}
                  className="min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60 text-body-medium focus:border-primary focus:outline-none dir-ltr text-right"
                  dir="ltr"
                />
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="min-h-[48px] px-6 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-full text-label-large transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-rounded text-lg">person_add</span>
                  <span>إنشاء الحساب</span>
                </button>
              </form>
            </div>

            {/* Users List */}
            <div className="bg-surface-container-low rounded-3xl border border-outline-variant/30 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="text-title-medium font-bold text-on-surface">قائمة الحسابات ({users.length})</h3>
              </div>

              {isUsersLoading ? (
                <div className="p-8 text-center text-on-surface-variant">جارٍ تحميل الحسابات...</div>
              ) : (
                <div className="divide-y divide-outline-variant/20" role="list">
                  {users.map((u: UserData) => {
                    const isSelf = u.id === user?.id;

                    return (
                      <div
                        key={u.id}
                        role="listitem"
                        className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-container/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-title-medium font-bold text-on-surface">{u.name}</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-label-small font-bold ${
                                u.role === 'SUPER_ADMIN'
                                  ? 'bg-primary-container text-on-primary-container'
                                  : 'bg-surface-container-high text-on-surface'
                              }`}
                            >
                              {u.role === 'SUPER_ADMIN' ? 'مسؤول النظام' : 'موظف شباك'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-label-small font-bold ${
                                u.isActive
                                  ? 'bg-success-container text-on-success-container'
                                  : 'bg-error-container text-on-error-container'
                              }`}
                            >
                              {u.isActive ? 'نشط' : 'معطل'}
                            </span>
                            {isSelf && (
                              <span className="px-2 py-0.5 rounded-full text-label-small font-bold bg-amber-100 text-amber-900">
                                أنت
                              </span>
                            )}
                          </div>
                          <p className="text-body-small text-on-surface-variant font-mono dir-ltr text-right" dir="ltr">
                            {u.email}
                          </p>
                          {u.assignedWindows && u.assignedWindows.length > 0 && (
                            <div className="flex items-center gap-1.5 text-label-small text-primary mt-1">
                              <span className="material-symbols-rounded text-sm">view_week</span>
                              <span>الشبابيك المخصصة: {u.assignedWindows.map((w) => w.name).join('، ')}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setResettingUserPassword({ id: u.id, name: u.name, password: '' })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-small font-bold transition min-h-[40px] cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base">key</span>
                            <span>إعادة تعيين كلمة المرور</span>
                          </button>

                          <button
                            disabled={isSelf}
                            onClick={() => updateUserMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-label-small font-bold transition min-h-[40px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              u.isActive
                                ? 'bg-error-container text-on-error-container hover:opacity-90'
                                : 'bg-success-container text-on-success-container hover:opacity-90'
                            }`}
                            title={isSelf ? 'لا يمكنك تعطيل حسابك الخاص' : ''}
                          >
                            <span>{u.isActive ? 'تعطيل' : 'تفعيل'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reset Password Modal */}
            {resettingUserPassword && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-surface-container-lowest rounded-3xl p-6 max-w-md w-full border border-outline-variant/40 space-y-4">
                  <h3 className="text-title-large font-bold text-on-surface">
                    إعادة تعيين كلمة المرور لـ {resettingUserPassword.name}
                  </h3>
                  <div>
                    <label className="block text-label-medium font-bold mb-1">كلمة المرور الجديدة (8+ أحرف)</label>
                    <input
                      type="password"
                      minLength={8}
                      value={resettingUserPassword.password}
                      onChange={(e) =>
                        setResettingUserPassword({ ...resettingUserPassword, password: e.target.value })
                      }
                      placeholder="••••••••"
                      className="w-full min-h-[48px] px-4 rounded-2xl bg-surface-container border border-outline-variant/60 dir-ltr text-right"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setResettingUserPassword(null)}
                      className="px-4 py-2 rounded-full text-label-large font-bold text-on-surface-variant hover:bg-surface-container"
                    >
                      إلغاء
                    </button>
                    <button
                      disabled={resettingUserPassword.password.length < 8}
                      onClick={() => {
                        updateUserMutation.mutate({
                          id: resettingUserPassword.id,
                          data: { password: resettingUserPassword.password },
                        });
                      }}
                      className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-label-large hover:bg-primary-hover disabled:opacity-50"
                    >
                      حفظ كلمة المرور
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 4: WINDOW ASSIGNMENTS */}
        {activeTab === 'assignments' && (
          <section className="space-y-5" aria-labelledby="assignments-heading">
            <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 id="assignments-heading" className="text-title-medium font-bold text-on-surface">
                  تعيين موظفي الشبابيك
                </h2>
                <p className="text-body-small text-on-surface-variant">
                  حدد الشباك ثم اختر الموظفين المصرح لهم بالدخول وإدارة هذا الشباك
                </p>
              </div>

              <M3Select
                label="الشباك"
                value={currentAssignedWindow?.id || ''}
                options={windowOptions}
                onChange={(val) => handleWindowSelectForAssignment(val)}
                className="w-full sm:w-auto min-w-[300px]"
              />
            </div>

            {currentAssignedWindow && (
              <div className="bg-surface-container-low rounded-3xl border border-outline-variant/30 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <h3 className="text-title-medium font-bold text-on-surface">
                    الموظفون المتاحون لتشغيل {currentAssignedWindow.name}
                  </h3>
                  <button
                    onClick={() =>
                      assignStaffMutation.mutate({
                        windowId: currentAssignedWindow.id,
                        userIds: selectedStaffIds,
                      })
                    }
                    disabled={assignStaffMutation.isPending}
                    className="min-h-[48px] px-6 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-full text-label-large transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {assignStaffMutation.isPending ? (
                      <span className="material-symbols-rounded animate-spin text-lg">progress_activity</span>
                    ) : (
                      <span className="material-symbols-rounded text-lg">save</span>
                    )}
                    <span>حفظ التعيينات</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {users
                    .filter((u) => u.role === 'STAFF')
                    .map((staffUser) => {
                      const isChecked = selectedStaffIds.includes(staffUser.id);

                      return (
                        <label
                          key={staffUser.id}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isChecked
                              ? 'bg-primary-container/40 border-primary text-on-primary-container'
                              : 'bg-surface-container border-outline-variant/40 hover:bg-surface-container-high text-on-surface'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStaffIds([...selectedStaffIds, staffUser.id]);
                              } else {
                                setSelectedStaffIds(selectedStaffIds.filter((id) => id !== staffUser.id));
                              }
                            }}
                            className="mt-1 w-5 h-5 rounded accent-primary cursor-pointer"
                          />
                          <div className="flex-1">
                            <span className="block text-title-small font-bold">{staffUser.name}</span>
                            <span className="block text-body-small opacity-80 dir-ltr text-right" dir="ltr">
                              {staffUser.email}
                            </span>
                            {!staffUser.isActive && (
                              <span className="inline-block mt-1 text-label-small font-bold text-error">
                                (حساب معطل)
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-label-large font-bold transition-all min-h-[48px] shrink-0 cursor-pointer ${
        active
          ? 'bg-primary text-on-primary shadow-xs'
          : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <span className="material-symbols-rounded text-xl">{icon}</span>
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`px-2 py-0.5 rounded-full text-label-small ${
            active ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-on-surface'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

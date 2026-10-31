import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import StudentWindowPage from './pages/StudentWindowPage';
import TicketTrackingPage from './pages/TicketTrackingPage';
import WindowQrPage from './pages/WindowQrPage';
import PublicDisplayPage from './pages/PublicDisplayPage';

// Lazy load auth & admin pages to keep student bundle lightweight
const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage.js'));
const StaffPanelPage = lazy(() => import('./pages/StaffPanelPage.js'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

/**
 * Guard for /admin: Super Admin only
 */
export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'SUPER_ADMIN') {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container-low rounded-3xl p-6 text-center border border-outline-variant/30">
          <span className="material-symbols-rounded text-error text-5xl mb-3">gpp_bad</span>
          <h1 className="text-title-large font-bold text-on-surface mb-2">غير مصرح بالدخول</h1>
          <p className="text-body-medium text-on-surface-variant mb-6">
            لوحة الإدارة الرئيسية مخصصة فقط لمدير النظام (Super Admin).
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-label-large"
          >
            العودة لتسجيل الدخول
          </Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

/**
 * Guard for /admin/:windowId: Super Admin or Assigned Staff
 */
export function StaffWindowRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const { windowId } = useParams<{ windowId: string }>();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Staff check
  const hasAccess = windowId && user.windowIds?.includes(windowId);
  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container-low rounded-3xl p-6 text-center border border-outline-variant/30">
          <span className="material-symbols-rounded text-error text-5xl mb-3">block</span>
          <h1 className="text-title-large font-bold text-on-surface mb-2">403 — غير مصرح</h1>
          <p className="text-body-medium text-on-surface-variant mb-6">
            ليس لديك صلاحية الوصول إلى هذا الشباك. يرجى مراجعة مسؤول النظام لتعيينك على هذا الشباك.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-high text-on-surface font-bold text-label-large"
            >
              العودة
            </Link>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-error-container text-on-error-container font-bold text-label-large cursor-pointer"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

/**
 * Login route - redirects if already logged in
 */
function PublicLoginRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user) {
    if (user.role === 'SUPER_ADMIN') {
      return <Navigate to="/admin" replace />;
    }
    if (user.windowIds && user.windowIds.length > 0) {
      return <Navigate to={`/admin/${user.windowIds[0]}`} replace />;
    }
  }

  return <LoginPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              {/* Student-facing public routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/w/:windowId" element={<StudentWindowPage />} />
              <Route path="/w/:windowId/ticket/:ticketId" element={<TicketTrackingPage />} />
              <Route path="/qr/:windowId" element={<WindowQrPage />} />
              <Route path="/display/:windowId" element={<PublicDisplayPage />} />

              {/* Auth Route */}
              <Route path="/login" element={<PublicLoginRoute />} />

              {/* Admin Dashboard (Super Admin only) */}
              <Route
                path="/admin"
                element={
                  <SuperAdminRoute>
                    <AdminDashboardPage />
                  </SuperAdminRoute>
                }
              />

              {/* Staff Window Panel (Super Admin or Assigned Staff) */}
              <Route
                path="/admin/:windowId"
                element={
                  <StaffWindowRoute>
                    <StaffPanelPage />
                  </StaffWindowRoute>
                }
              />

              {/* Catch-all redirect to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

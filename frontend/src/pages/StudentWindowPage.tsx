import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWindow,
  fetchServices,
  fetchStudentMe,
  createTicket,
  translateError,
  type ServiceData,
  type StudentData,
} from '../lib/api.js';
import {
  getOrCreateDeviceId,
  saveActiveTicket,
  getActiveTicket,
} from '../lib/device.js';
import { useWindowSocket } from '../hooks/useWindowSocket.js';
import { DisconnectionBanner } from '../components/DisconnectionBanner.js';
import { StudentRegistrationCard } from '../components/StudentRegistrationCard.js';

export default function StudentWindowPage() {
  const { windowId } = useParams<{ windowId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Live socket update for window status
  const { isConnected } = useWindowSocket(windowId);

  // Check localStorage and active ticket on mount
  useEffect(() => {
    if (!windowId) return;
    try {
      setDeviceId(getOrCreateDeviceId());
      const existing = getActiveTicket(windowId);
      if (existing) {
        setActiveTicketId(existing);
      }
    } catch (err: any) {
      setDeviceError(translateError(err));
    }
  }, [windowId]);

  // Resolve the student linked to this device
  const {
    isLoading: isStudentLoading,
    error: studentError,
    refetch: refetchStudent,
  } = useQuery<StudentData>({
    queryKey: ['student', deviceId],
    queryFn: () => fetchStudentMe(deviceId!),
    enabled: Boolean(deviceId),
    retry: false,
  });

  const studentErrorCode = (studentError as any)?.code;
  const needsRegistration = studentErrorCode === 'STUDENT_NOT_REGISTERED';
  const studentLoadFailed = Boolean(studentError) && !needsRegistration;

  // Query window info
  const {
    data: windowData,
    isLoading: isWindowLoading,
    error: windowError,
  } = useQuery({
    queryKey: ['window', windowId],
    queryFn: () => fetchWindow(windowId!),
    enabled: Boolean(windowId),
  });

  // Query active services
  const {
    data: services = [],
    isLoading: isServicesLoading,
    error: servicesError,
  } = useQuery({
    queryKey: ['services', windowId],
    queryFn: () => fetchServices(windowId!),
    enabled: Boolean(windowId),
  });

  // Mutation to issue ticket
  const ticketMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      setActionError(null);
      const deviceId = getOrCreateDeviceId();
      return createTicket(windowId!, serviceId, deviceId);
    },
    onSuccess: (newTicket) => {
      saveActiveTicket(windowId!, newTicket.id);
      navigate(`/w/${windowId}/ticket/${newTicket.id}`);
    },
    onError: (err: any) => {
      const msg = translateError(err);
      setActionError(msg);
      // If the server no longer recognizes this device, show the registration gate
      if (err?.code === 'STUDENT_NOT_REGISTERED' && deviceId) {
        queryClient.invalidateQueries({ queryKey: ['student', deviceId] });
      }
      // If active ticket already exists, check if we have it stored
      const existing = getActiveTicket(windowId!);
      if (existing) {
        setActiveTicketId(existing);
      }
    },
  });

  // Critical device / storage error
  if (deviceError) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-[640px] w-full bg-surface-container rounded-3xl p-6 sm:p-8 text-center border border-outline-variant">
          <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-2xl">warning</span>
          </div>
          <h2 className="text-headline-small font-bold text-on-surface mb-2">تنبيه بالمتصفح</h2>
          <p className="text-body-medium text-on-surface-variant leading-relaxed mb-6">{deviceError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full min-h-[48px] py-2.5 px-6 bg-primary text-on-primary rounded-full text-label-large font-bold hover:bg-primary-hover transition cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      </main>
    );
  }

  // Loading state
  if (!deviceId || isStudentLoading || isWindowLoading || isServicesLoading) {
    return (
      <main className="min-h-screen bg-surface p-4 pt-10 flex flex-col items-center">
        <div className="max-w-[640px] w-full space-y-4">
          <div className="h-28 bg-surface-container rounded-3xl animate-pulse p-6">
            <div className="h-6 bg-surface-container-high rounded-full w-1/2 mb-3"></div>
            <div className="h-4 bg-surface-container-high rounded-full w-1/3"></div>
          </div>
          <div className="h-16 bg-surface-container rounded-2xl animate-pulse"></div>
          <div className="h-16 bg-surface-container rounded-2xl animate-pulse"></div>
          <div className="h-16 bg-surface-container rounded-2xl animate-pulse"></div>
        </div>
      </main>
    );
  }

  // Error loading window
  if (windowError || !windowData) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-[640px] w-full bg-surface-container rounded-3xl p-6 sm:p-8 text-center border border-outline-variant">
          <span className="material-symbols-rounded text-5xl text-outline mb-3">apartment</span>
          <h1 className="text-headline-small font-bold text-on-surface mb-2">الشباك غير متاح</h1>
          <p className="text-body-medium text-on-surface-variant mb-6">{translateError(windowError)}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center min-h-[48px] py-2.5 px-6 bg-primary text-on-primary rounded-full text-label-large font-bold hover:bg-primary-hover transition"
          >
            الصفحة الرئيسية
          </Link>
        </div>
      </main>
    );
  }

  // Could not determine the student identity (network/server error)
  if (studentLoadFailed) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-[640px] w-full bg-surface-container rounded-3xl p-6 sm:p-8 text-center border border-outline-variant">
          <span className="material-symbols-rounded text-5xl text-outline mb-3">person_off</span>
          <h1 className="text-headline-small font-bold text-on-surface mb-2">تعذر التحقق من بياناتك</h1>
          <p className="text-body-medium text-on-surface-variant mb-6">{translateError(studentError)}</p>
          <button
            onClick={() => refetchStudent()}
            className="inline-flex items-center justify-center min-h-[48px] py-2.5 px-6 bg-primary text-on-primary rounded-full text-label-large font-bold hover:bg-primary-hover transition cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <DisconnectionBanner isConnected={isConnected} />

      <main className="flex-1 w-full max-w-[640px] mx-auto p-4 sm:p-6 flex flex-col justify-between">
        <div className="space-y-5">
          {/* Top App Bar: Window Name and Location */}
          <header className="bg-surface-container-low rounded-3xl p-5 sm:p-6 text-right border border-outline-variant/40">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-label-small font-bold mb-3">
              <span className="material-symbols-rounded text-sm">confirmation_number</span>
              <span>دَوْرَك</span>
            </div>
            <h1 className="text-headline-medium sm:text-headline-large font-bold text-on-surface tracking-tight">
              {windowData.name}
            </h1>
            <div className="flex items-center gap-1.5 text-body-medium text-on-surface-variant mt-2">
              <span className="material-symbols-rounded text-lg text-outline shrink-0">location_on</span>
              <span>{windowData.location}</span>
            </div>
          </header>

          {/* Active Ticket Alert (if student already has one) */}
          {activeTicketId && (
            <div
              role="status"
              className="bg-success-container text-on-success-container rounded-2xl p-4 flex items-center justify-between gap-3 border border-success/20"
            >
              <div className="text-right">
                <p className="text-label-large font-bold">لديك تذكرة نشطة حالياً</p>
                <p className="text-body-small opacity-90 mt-0.5">يمكنك متابعة دورك وموقعك مباشرة</p>
              </div>
              <Link
                to={`/w/${windowId}/ticket/${activeTicketId}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-success text-on-success rounded-full text-label-large font-bold hover:opacity-90 transition shrink-0 min-h-[48px]"
              >
                <span>عرض تذكرتي</span>
                <span className="material-symbols-rounded text-lg">open_in_new</span>
              </Link>
            </div>
          )}

          {/* Action Error Banner */}
          {actionError && (
            <div
              role="alert"
              className="bg-error-container text-on-error-container rounded-2xl p-4 text-right flex items-start gap-3 border border-error/20"
            >
              <span className="material-symbols-rounded text-xl text-error shrink-0 mt-0.5">error</span>
              <div className="text-body-medium leading-snug">
                <p className="font-bold">{actionError}</p>
                {activeTicketId && (
                  <Link
                    to={`/w/${windowId}/ticket/${activeTicketId}`}
                    className="inline-block text-label-small font-bold underline mt-1.5"
                  >
                    اضغط هنا للانتقال إلى تذكرتك الحالية
                  </Link>
                )}
              </div>
            </div>
          )}

          {needsRegistration && deviceId ? (
            <StudentRegistrationCard
              deviceId={deviceId}
              onRegistered={(registeredStudent) => {
                queryClient.setQueryData(['student', deviceId], registeredStudent);
              }}
            />
          ) : (
          <section aria-labelledby="services-heading">
            <h2 id="services-heading" className="text-title-small font-bold text-on-surface-variant px-1 mb-3 text-right">
              اختر الخدمة المطلوبة لحجز دورك:
            </h2>

            {servicesError ? (
              <div className="bg-error-container text-on-error-container rounded-2xl p-4 text-center text-body-medium">
                {translateError(servicesError)}
              </div>
            ) : services.length === 0 ? (
              <div className="bg-surface-container rounded-2xl p-8 text-center text-on-surface-variant">
                <p className="text-body-medium">لا توجد خدمات متاحة في هذا الشباك حالياً</p>
              </div>
            ) : (
              <div className="grid gap-3" role="list">
                {services.map((service: ServiceData) => {
                  const isCurrentLoading =
                    ticketMutation.isPending &&
                    ticketMutation.variables === service.id;

                  return (
                    <button
                      key={service.id}
                      role="listitem"
                      disabled={ticketMutation.isPending}
                      onClick={() => ticketMutation.mutate(service.id)}
                      className="group relative w-full bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest rounded-2xl p-4 sm:p-5 text-right transition-colors flex items-center justify-between gap-4 disabled:opacity-50 cursor-pointer min-h-[64px] border border-outline-variant/30"
                    >
                      <div className="flex-1 pr-1">
                        <span className="block text-title-medium font-bold text-on-surface">
                          {service.name}
                        </span>
                        <span className="text-body-small text-on-surface-variant mt-0.5 block">
                          اضغط للحصول على رقم دور
                        </span>
                      </div>

                      <div className="inline-flex items-center justify-center px-4 py-2 bg-primary group-hover:bg-primary-hover text-on-primary rounded-full text-label-large font-bold transition min-h-[48px] min-w-[48px] shrink-0">
                        {isCurrentLoading ? (
                          <span className="material-symbols-rounded animate-spin text-xl">progress_activity</span>
                        ) : (
                          <span className="material-symbols-rounded text-xl">arrow_back</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-body-small text-on-surface-variant/70 py-4">
          نظام دَوْرَك لإدارة طوابير شؤون الطلاب
        </footer>
      </main>
    </div>
  );
}

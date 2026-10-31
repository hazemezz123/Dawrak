import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchWindow,
  fetchQueue,
  callNext,
  skipTicket,
  translateError,
  type QueueItem,
} from '../lib/api.js';
import { useWindowSocket } from '../hooks/useWindowSocket.js';
import { DisconnectionBanner } from '../components/DisconnectionBanner.js';

export default function StaffPanelPage() {
  const { windowId } = useParams<{ windowId: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'error' | 'info' | 'success';
    text: string;
  } | null>(null);

  // Live socket updates
  const { isConnected } = useWindowSocket(windowId, () => {
    queryClient.invalidateQueries({ queryKey: ['queue', windowId] });
  });

  // Window info
  const { data: windowData, isLoading: isWindowLoading } = useQuery({
    queryKey: ['window', windowId],
    queryFn: () => fetchWindow(windowId!),
    enabled: Boolean(windowId),
  });

  // Live queue data
  const {
    data: queue,
    isLoading: isQueueLoading,
    isRefetching,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['queue', windowId],
    queryFn: () => fetchQueue(windowId!),
    enabled: Boolean(windowId),
    refetchInterval: isConnected ? false : 5000,
  });

  // Call Next mutation
  const nextMutation = useMutation({
    mutationFn: async () => {
      setFeedbackMessage(null);
      const currentId = queue?.called?.id;
      return callNext(windowId!, currentId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['queue', windowId] });
      if (data.ticket) {
        setFeedbackMessage({
          type: 'success',
          text: `تم استدعاء التذكرة رقم ${data.ticket.number}`,
        });
      } else {
        setFeedbackMessage({
          type: 'info',
          text: 'تم إنهاء خدمة التذكرة، وقائمة الانتظار فارغة حالياً.',
        });
      }
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['queue', windowId] });
      setFeedbackMessage({
        type: 'error',
        text: translateError(err),
      });
    },
  });

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: async () => {
      setFeedbackMessage(null);
      const currentId = queue?.called?.id;
      if (!currentId) {
        throw { code: 'NO_CALLED_TICKET', message: 'لا توجد تذكرة مستدعاة حالياً ليتم تخطيها' };
      }
      return skipTicket(windowId!, currentId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['queue', windowId] });
      if (data.ticket.status === 'cancelled') {
        setFeedbackMessage({
          type: 'info',
          text: `تم تخطي التذكرة رقم ${data.ticket.number} للمرة الثانية وإلغاؤها.`,
        });
      } else {
        setFeedbackMessage({
          type: 'info',
          text: `تم تخطي التذكرة رقم ${data.ticket.number} وتأخيرها في قائمة الانتظار.`,
        });
      }
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['queue', windowId] });
      setFeedbackMessage({
        type: 'error',
        text: translateError(err),
      });
    },
  });

  const isActionPending = nextMutation.isPending || skipMutation.isPending;
  const calledTicket = queue?.called ?? null;
  const waitingList = queue?.waiting ?? [];

  if (isWindowLoading || isQueueLoading) {
    return (
      <main className="min-h-screen bg-surface p-4 sm:p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-rounded animate-spin text-primary text-4xl">
            progress_activity
          </span>
          <p className="text-body-medium text-on-surface-variant font-medium">جارٍ تحميل لوحة الموظف...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <DisconnectionBanner isConnected={isConnected} />

      <main className="flex-1 w-full max-w-[640px] mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* Top App Bar: role, window name, location, and actions */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-surface-container-low p-4 sm:p-5 rounded-3xl border border-outline-variant/30">
          <div className="min-w-0 sm:flex-1">
            <div className="flex min-w-0 items-center gap-1.5 mb-0.5">
              <span className="body-small text-on-surface-variant shrink-0">
                لوحة موظف الشباك
              </span>
              {user && (
                <>
                  <span className="body-small text-outline-variant" aria-hidden="true">•</span>
                  <span className="body-small text-on-surface-variant min-w-0 truncate">
                    {user.name}
                  </span>
                </>
              )}
            </div>
            <h1 className="headline-small font-bold text-on-surface break-words">
              {windowData?.name || 'شباك شؤون الطلاب'}
            </h1>
            <div className="flex min-w-0 items-center gap-1 body-medium text-on-surface-variant mt-0.5">
              <span className="material-symbols-rounded text-sm text-outline shrink-0" aria-hidden="true">location_on</span>
              <span
                className="min-w-0 truncate"
                title={windowData?.location || 'المبنى الرئيسي'}
              >
                {windowData?.location || 'المبنى الرئيسي'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => refetchQueue()}
              disabled={isRefetching}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 min-h-12 px-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface label-medium transition disabled:opacity-50 cursor-pointer"
              title="تحديث القائمة"
            >
              <span className={`material-symbols-rounded text-lg ${isRefetching ? 'animate-spin' : ''}`} aria-hidden="true">
                refresh
              </span>
              <span className="whitespace-nowrap">تحديث</span>
            </button>
            <Link
              to={`/display/${windowId}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 min-h-12 px-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface label-medium transition"
              title="عرض الشاشة"
            >
              <span className="material-symbols-rounded text-lg" aria-hidden="true">visibility</span>
              <span className="whitespace-nowrap">عرض الشاشة</span>
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              className="inline-flex items-center justify-center h-12 w-12 min-h-12 shrink-0 rounded-full border border-outline text-on-surface-variant hover:bg-surface-container transition cursor-pointer"
            >
              <span className="material-symbols-rounded text-xl" aria-hidden="true">logout</span>
            </button>
          </div>
        </header>

        {/* Action feedback message */}
        {feedbackMessage && (
          <div
            role="status"
            className={`p-3.5 rounded-2xl border text-body-medium font-semibold flex items-center gap-2.5 transition-all ${
              feedbackMessage.type === 'error'
                ? 'bg-error-container text-on-error-container border-error/30'
                : feedbackMessage.type === 'success'
                ? 'bg-success-container text-on-success-container border-success/30'
                : 'bg-primary-container text-on-primary-container border-primary/30'
            }`}
          >
            <span className="material-symbols-rounded text-xl shrink-0">
              {feedbackMessage.type === 'error' ? 'warning' : 'info'}
            </span>
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* CURRENTLY CALLED TICKET CARD */}
        <section aria-labelledby="called-heading">
          <div
            className={`rounded-3xl border p-5 sm:p-7 text-center transition-all ${
              calledTicket
                ? 'bg-surface-container-lowest border-success ring-4 ring-success/20'
                : 'bg-surface-container-low border-outline-variant/30'
            }`}
          >
            <p id="called-heading" className="text-label-small font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              الدور الحالي المستدعى
            </p>

            {calledTicket ? (
              <div className="space-y-2">
                <div className="display-large font-mono font-black tracking-tight text-success">
                  {calledTicket.number}
                </div>
                <div className="text-title-medium font-bold text-on-surface">
                  {calledTicket.service?.name}
                </div>
                {calledTicket.student ? (
                  <div className="space-y-0.5">
                    <p className="text-title-small font-bold text-on-surface">
                      {calledTicket.student.fullName}
                    </p>
                    <p className="text-body-small text-on-surface-variant" dir="ltr">
                      {calledTicket.student.phone}
                    </p>
                  </div>
                ) : (
                  <p className="text-body-small font-medium text-on-surface-variant">
                    غير مسجل
                  </p>
                )}
                {calledTicket.skipCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-small font-bold bg-warning-container text-on-warning-container border border-warning/30">
                    <span className="material-symbols-rounded text-sm">schedule</span>
                    <span>تم تخطيه سابقاً (مرة واحدة)</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="py-4 sm:py-6 space-y-1">
                <p className="text-headline-medium sm:text-headline-large font-bold text-outline">
                  لا يوجد دور حالي
                </p>
                <p className="text-body-small text-on-surface-variant font-medium">
                  {waitingList.length > 0
                    ? 'اضغط على زر "التالي" لاستدعاء التذكرة الأولى في الطابور'
                    : 'قائمة الانتظار فارغة حالياً'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* STAFF CONTROL BUTTONS (Next: Filled Button, Skip: Tonal Button) */}
        <section className="grid grid-cols-2 gap-3">
          {/* Next Button: M3 Filled Button */}
          <button
            onClick={() => nextMutation.mutate()}
            disabled={isActionPending}
            className="w-full min-h-[52px] sm:min-h-[56px] bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary font-bold text-title-medium rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            {nextMutation.isPending ? (
              <span className="material-symbols-rounded animate-spin text-xl">progress_activity</span>
            ) : (
              <span className="material-symbols-rounded text-2xl">play_arrow</span>
            )}
            <span>التالي</span>
          </button>

          {/* Skip Button: M3 Tonal Button */}
          <button
            onClick={() => skipMutation.mutate()}
            disabled={!calledTicket || isActionPending}
            className="w-full min-h-[52px] sm:min-h-[56px] bg-primary-container hover:bg-primary-container-hover active:bg-primary-pressed/20 text-on-primary-container font-bold text-title-medium rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {skipMutation.isPending ? (
              <span className="material-symbols-rounded animate-spin text-xl">progress_activity</span>
            ) : (
              <span className="material-symbols-rounded text-2xl">skip_next</span>
            )}
            <span>تخطي</span>
          </button>
        </section>

        {/* WAITING LIST SECTION */}
        <section className="bg-surface-container-low rounded-3xl border border-outline-variant/30 p-4 sm:p-5" aria-labelledby="queue-heading">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-primary text-xl">group</span>
              <h2 id="queue-heading" className="text-title-medium font-bold text-on-surface">
                قائمة الانتظار
              </h2>
            </div>
            <span className="px-3 py-1 bg-surface-container-high text-on-surface rounded-full text-label-small font-bold">
              {waitingList.length} بانتظار الخدمة
            </span>
          </div>

          {waitingList.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant">
              <span className="material-symbols-rounded text-4xl text-outline mb-1">inbox</span>
              <p className="text-title-small font-bold text-on-surface">قائمة الانتظار فارغة حالياً</p>
              <p className="text-body-small text-on-surface-variant/80 mt-1">
                سيظهر الطلاب في هذه القائمة فور مسح رمز QR وطلب الخدمة
              </p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/15" role="list">
              {waitingList.map((ticket: QueueItem, index: number) => (
                <div
                  key={ticket.id}
                  role="listitem"
                  className="py-3 px-2 sm:px-3 flex items-center justify-between gap-3 hover:bg-surface-container rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface-variant font-bold text-label-small flex items-center justify-center shrink-0">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-title-medium font-black font-mono text-on-surface leading-none">
                        تذكرة #{ticket.number}
                      </p>
                      <p className="text-body-small text-on-surface-variant font-medium mt-1">
                        {ticket.service?.name}
                      </p>
                      <p className="text-body-small font-bold text-on-surface mt-1">
                        {ticket.student?.fullName || 'غير مسجل'}
                      </p>
                      {ticket.student && (
                        <p className="text-label-small text-outline font-mono" dir="ltr">
                          {ticket.student.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {ticket.skipCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-label-small font-bold bg-warning-container text-on-warning-container border border-warning/30">
                        مؤجل (تخطي سابق)
                      </span>
                    )}
                    <span className="text-label-small text-outline font-mono">
                      {ticket.createdAt
                        ? new Date(ticket.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTicket, translateError, type TicketStatus } from '../lib/api.js';
import { clearActiveTicket } from '../lib/device.js';
import { useWindowSocket } from '../hooks/useWindowSocket.js';
import { DisconnectionBanner } from '../components/DisconnectionBanner.js';

export default function TicketTrackingPage() {
  const { windowId, ticketId } = useParams<{ windowId: string; ticketId: string }>();
  const queryClient = useQueryClient();

  // Socket listener for queue updates: re-fetch ticket state instantly
  const { isConnected } = useWindowSocket(windowId, () => {
    queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
  });

  const {
    data: ticket,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => fetchTicket(ticketId!),
    enabled: Boolean(ticketId),
    refetchInterval: isConnected ? false : 10000,
  });

  // Clear saved active ticket from localStorage when served or cancelled
  useEffect(() => {
    if (ticket && (ticket.status === 'served' || ticket.status === 'cancelled') && windowId) {
      clearActiveTicket(windowId);
    }
  }, [ticket?.status, windowId]);

  // Loading Skeleton
  if (isLoading) {
    return (
      <main className="min-h-screen bg-surface p-4 pt-10 flex flex-col items-center">
        <div className="max-w-[640px] w-full space-y-4 animate-pulse">
          <div className="h-20 bg-surface-container rounded-3xl"></div>
          <div className="h-64 bg-surface-container rounded-3xl"></div>
          <div className="h-24 bg-surface-container rounded-3xl"></div>
        </div>
      </main>
    );
  }

  // Error State
  if (error || !ticket) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-[640px] w-full bg-surface-container rounded-3xl p-6 sm:p-8 text-center border border-outline-variant">
          <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-rounded text-2xl">cancel</span>
          </div>
          <h1 className="text-headline-small font-bold text-on-surface mb-2">تعذر عرض التذكرة</h1>
          <p className="text-body-medium text-on-surface-variant mb-6">{translateError(error)}</p>
          <Link
            to={windowId ? `/w/${windowId}` : '/'}
            className="inline-flex items-center justify-center min-h-[48px] py-2.5 px-6 bg-primary text-on-primary rounded-full text-label-large font-bold hover:bg-primary-hover transition"
          >
            العودة لصفحة الشباك
          </Link>
        </div>
      </main>
    );
  }

  const isCalled = ticket.status === 'called';
  const isWaiting = ticket.status === 'waiting';
  const isServed = ticket.status === 'served';
  const isCancelled = ticket.status === 'cancelled';

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <DisconnectionBanner isConnected={isConnected} />

      <main className="flex-1 w-full max-w-[640px] mx-auto p-4 sm:p-6 flex flex-col justify-between">
        <div className="space-y-4 sm:space-y-5">
          {/* Top Bar Navigation & App Bar */}
          <header className="flex items-center justify-between bg-surface-container-low rounded-3xl px-4 py-3 border border-outline-variant/30">
            <Link
              to={`/w/${windowId}`}
              className="inline-flex items-center gap-1.5 text-label-large font-bold text-primary hover:underline transition min-h-[48px] px-2 rounded-full"
            >
              <span className="material-symbols-rounded text-lg">arrow_forward</span>
              <span>شباك الخدمة</span>
            </Link>

            <span className="text-title-medium font-bold text-on-surface">دَوْرَك</span>

            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1 text-label-medium font-medium text-on-surface-variant hover:text-on-surface transition py-2 px-3 rounded-full bg-surface-container hover:bg-surface-container-high cursor-pointer min-h-[48px]"
              title="تحديث البيانات يدويًا"
            >
              <span className={`material-symbols-rounded text-base ${isRefetching ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>تحديث</span>
            </button>
          </header>

          {/* Window & Location Info Card */}
          <div className="bg-surface-container-low rounded-3xl p-5 text-right border border-outline-variant/30">
            <h2 className="text-headline-small font-bold text-on-surface">
              {ticket.windowName || 'شباك شؤون الطلاب'}
            </h2>
            <div className="flex items-center gap-1.5 text-body-medium text-on-surface-variant mt-1">
              <span className="material-symbols-rounded text-base text-outline">location_on</span>
              <span>{ticket.windowLocation || 'المبنى الرئيسي - شؤون الطلاب'}</span>
            </div>
          </div>

          {/* PROMINENT CALLED BANNER (M3 Success Container Role, NO bounce animation) */}
          {isCalled && (
            <div
              role="alert"
              className="relative overflow-hidden bg-success-container text-on-success-container rounded-3xl p-5 sm:p-6 text-center ring-4 ring-success/30 animate-pulse border border-success/30"
            >
              <div className="w-12 h-12 bg-success text-on-success rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="material-symbols-rounded text-2xl">notifications_active</span>
              </div>
              <h2 className="text-headline-medium sm:text-headline-large font-bold tracking-tight">
                حان دورك الآن!
              </h2>
              <p className="text-body-medium mt-1 font-medium opacity-90">
                يرجى التوجه إلى الشباك وتقديم أوراقك للموظف فوراً
              </p>
            </div>
          )}

          {/* MAIN TICKET CARD */}
          <div
            className={`bg-surface-container-lowest rounded-3xl border p-6 sm:p-8 text-center transition-all ${
              isCalled
                ? 'border-success ring-4 ring-success/20'
                : isCancelled
                ? 'border-error/30 bg-error-container/20'
                : 'border-outline-variant/40'
            }`}
          >
            {/* Service Title */}
            <div className="mb-3">
              <h3 className="text-title-large font-bold text-on-surface">
                {ticket.service?.name}
              </h3>
            </div>

            {/* Huge Ticket Number Display with M3 display-large */}
            <div className="py-6 sm:py-8 my-2 bg-surface-container-low rounded-2xl flex flex-col items-center justify-center border border-outline-variant/20">
              <span className="text-label-medium font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                رقم التذكرة
              </span>
              <span
                className={`display-large font-mono tracking-tight ${
                  isCalled
                    ? 'text-success scale-105 transition-transform'
                    : isCancelled
                    ? 'text-error line-through'
                    : isServed
                    ? 'text-outline'
                    : 'text-primary'
                }`}
              >
                {ticket.number}
              </span>
            </div>

            {/* Status Indicator Chip */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <StatusBadge status={ticket.status} />
            </div>
          </div>

          {/* POSITION & AHEAD COUNT (WAITING STATE) */}
          {isWaiting && (
            <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex items-center justify-between">
              <div className="text-right">
                <span className="text-body-small text-on-surface-variant block">الأشخاص أمامك في الطابور</span>
                <span className="text-title-small font-bold text-on-surface mt-0.5 block">
                  {ticket.aheadCount === 0
                    ? 'أنت التالي في الانتظار!'
                    : `يوجد ${ticket.aheadCount} في قائمة الانتظار قبلك`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-title-large">
                  {ticket.aheadCount}
                </div>
                <span className="material-symbols-rounded text-2xl text-on-surface-variant">group</span>
              </div>
            </div>
          )}

          {/* SERVED STATE NOTE */}
          {isServed && (
            <div className="bg-surface-container rounded-2xl p-5 text-center border border-outline-variant/30">
              <span className="material-symbols-rounded text-4xl text-success mb-1">check_circle</span>
              <p className="text-title-medium font-bold text-on-surface">تمت خدمتك بنجاح</p>
              <p className="text-body-small text-on-surface-variant mt-0.5">شكراً لالتزامك بالنظام</p>
              <Link
                to={`/w/${windowId}`}
                className="mt-3 inline-flex items-center justify-center min-h-[48px] px-6 py-2.5 bg-primary text-on-primary rounded-full text-label-large font-bold hover:bg-primary-hover transition"
              >
                العودة لحجز تذكرة أخرى
              </Link>
            </div>
          )}

          {/* CANCELLED STATE NOTE */}
          {isCancelled && (
            <div className="bg-error-container text-on-error-container rounded-2xl p-5 text-center border border-error/20">
              <span className="material-symbols-rounded text-4xl text-error mb-1">cancel</span>
              <p className="text-title-medium font-bold">تم إلغاء التذكرة</p>
              <p className="text-body-small opacity-90 mt-0.5">
                تم إلغاء التذكرة بسبب عدم الحضور بعد مرتي تخطٍ
              </p>
              <Link
                to={`/w/${windowId}`}
                className="mt-3 inline-flex items-center justify-center min-h-[48px] py-2.5 px-6 bg-error text-on-error rounded-full text-label-large font-bold hover:opacity-90 transition"
              >
                أخذ تذكرة جديدة
              </Link>
            </div>
          )}

          {/* Skip Count Note (if skipped once and back in waiting) */}
          {isWaiting && ticket.skipCount === 1 && (
            <div className="bg-warning-container text-on-warning-container rounded-2xl p-4 text-right text-body-small flex items-start gap-2.5 border border-warning/20">
              <span className="material-symbols-rounded text-xl text-warning shrink-0 mt-0.5">schedule</span>
              <span>
                تنبيه: تم تخطي دورك مرة واحدة لعدم الاستجابة، تم تأخيرك 3 أدوار. في حال التخطي القادم سيتم إلغاء التذكرة.
              </span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <footer className="mt-8 text-center text-body-small text-on-surface-variant/70 py-4 flex items-center justify-center gap-1.5">
          <span className="material-symbols-rounded text-base">apartment</span>
          <span>{ticket.windowLocation || 'المبنى الرئيسي - شؤون الطلاب'}</span>
        </footer>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  switch (status) {
    case 'called':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-label-medium font-bold bg-success-container text-on-success-container border border-success/30">
          <span className="material-symbols-rounded text-base text-success">notifications_active</span>
          مستدعاة الآن
        </span>
      );
    case 'waiting':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-label-medium font-bold bg-primary-container text-on-primary-container border border-primary/30">
          <span className="material-symbols-rounded text-base text-primary">hourglass_top</span>
          قيد الانتظار
        </span>
      );
    case 'served':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-label-medium font-bold bg-surface-container-high text-on-surface border border-outline-variant">
          <span className="material-symbols-rounded text-base text-outline">check_circle</span>
          تمت الخدمة
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-label-medium font-bold bg-error-container text-on-error-container border border-error/30">
          <span className="material-symbols-rounded text-base text-error">cancel</span>
          ملغاة
        </span>
      );
  }
}

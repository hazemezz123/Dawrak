import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchWindowDisplay, type WindowDisplayData } from '../lib/api.js';
import { useWindowSocket } from '../hooks/useWindowSocket.js';
import { DisconnectionBanner } from '../components/DisconnectionBanner.js';

export default function PublicDisplayPage() {
  const { windowId } = useParams<{ windowId: string }>();

  // Fetch initial display data (window info & called ticket)
  const {
    data: displayData,
    isLoading,
    refetch,
  } = useQuery<WindowDisplayData>({
    queryKey: ['window-display', windowId],
    queryFn: () => fetchWindowDisplay(windowId!),
    enabled: Boolean(windowId),
    refetchInterval: false,
  });

  // Local state for immediate live socket updates
  const [liveCalled, setLiveCalled] = useState<{
    number: number;
    service?: { name: string };
  } | null | undefined>(undefined);

  // Sync state if displayData changes
  useEffect(() => {
    if (displayData) {
      setLiveCalled(displayData.called);
    }
  }, [displayData]);

  // Live socket updates through the window room
  const { isConnected } = useWindowSocket(windowId, (updateData?: any) => {
    if (updateData && 'called' in updateData) {
      setLiveCalled(updateData.called);
    }
    refetch();
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </main>
    );
  }

  const windowInfo = displayData?.window;

  if (!windowInfo) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-surface-container-low rounded-3xl p-6 border border-outline-variant/30">
          <h1 className="text-title-large font-bold text-on-surface mb-2">الشباك غير موجود</h1>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-label-large"
          >
            العودة للرئيسية
          </Link>
        </div>
      </main>
    );
  }

  const calledTicket = liveCalled !== undefined ? liveCalled : displayData?.called;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <DisconnectionBanner isConnected={isConnected} />

      {/* Top App Bar */}
      <header className="bg-surface-container-low border-b border-outline-variant/30 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              <span className="material-symbols-rounded text-xl">tv</span>
            </div>
            <div>
              <span className="text-title-medium font-bold text-primary">دَوْرَك</span>
              <p className="text-label-small text-on-surface-variant font-medium">شاشة العرض العامة</p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <h1 className="text-title-medium sm:text-title-large font-bold text-on-surface leading-tight">
              {windowInfo.name}
            </h1>
            <div className="flex items-center gap-1 text-body-small text-on-surface-variant justify-end">
              <span className="material-symbols-rounded text-sm text-outline">location_on</span>
              <span>{windowInfo.location}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Display Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex flex-col items-center justify-center">
        {calledTicket ? (
          <div className="w-full bg-surface-container-lowest rounded-3xl border border-outline-variant/40 p-8 sm:p-14 shadow-sm text-center flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-success-container text-on-success-container text-label-large sm:text-title-small font-bold mb-6">
              <span className="material-symbols-rounded text-base">campaign</span>
              <span>الرقم المستدعى الآن</span>
            </span>

            <div
              data-testid="called-number"
              className="display-large text-7xl sm:text-8xl md:text-9xl font-mono font-black text-primary tracking-tight my-2"
            >
              {calledTicket.number}
            </div>

            <div className="mt-6 px-5 py-2 rounded-2xl bg-surface-container text-on-surface text-body-large sm:text-title-medium font-bold">
              {calledTicket.service?.name || 'خدمة الشباك'}
            </div>
          </div>
        ) : (
          <div className="w-full bg-surface-container-lowest rounded-3xl border border-outline-variant/40 p-12 sm:p-20 shadow-sm text-center flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-3xl bg-surface-container-low flex items-center justify-center text-outline mb-6">
              <span className="material-symbols-rounded text-5xl">hourglass_empty</span>
            </div>
            <h2 className="display-large text-3xl sm:text-4xl md:text-5xl font-bold text-on-surface-variant">
              لا يوجد دور حالي
            </h2>
            <p className="text-body-large text-on-surface-variant/70 mt-3 max-w-md">
              يرجى الانتظار، سيظهر الرقم التالي هنا فور استدعائه على شباك الخدمة
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

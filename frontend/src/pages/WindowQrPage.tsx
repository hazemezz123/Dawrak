import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { fetchWindow } from '../lib/api.js';

export default function WindowQrPage() {
  const { windowId } = useParams<{ windowId: string }>();

  const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || '';
  const qrUrl = `${baseUrl}/w/${windowId}`;

  const {
    data: windowData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['window', windowId],
    queryFn: () => fetchWindow(windowId!),
    enabled: Boolean(windowId),
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <span className="material-symbols-rounded animate-spin text-primary text-4xl">
          progress_activity
        </span>
      </main>
    );
  }

  if (error || !windowData) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container rounded-3xl border border-outline-variant p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-2xl">error</span>
          </div>
          <h1 className="text-headline-small font-bold text-on-surface mb-2">الشباك غير موجود</h1>
          <p className="text-body-medium text-on-surface-variant mb-6">
            تعذر العثور على هذا الشباك. يرجى التأكد من صحة الرابط أو اختيار شباك متاح.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center min-h-[48px] py-2.5 px-6 bg-primary text-on-primary rounded-full text-label-large font-bold hover:bg-primary-hover transition"
          >
            العودة للرئيسية
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface print:bg-white flex flex-col items-center justify-center p-4 sm:p-6 print:p-0 text-on-surface">
      {/* Top action bar (hidden during print) */}
      <div className="w-full max-w-[640px] flex items-center justify-between mb-4 print:hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-label-large font-bold text-on-surface-variant hover:text-on-surface transition min-h-[48px] px-3 rounded-full"
        >
          <span className="material-symbols-rounded text-lg">arrow_forward</span>
          <span>الرئيسية</span>
        </Link>
        <span className="text-title-medium font-bold text-on-surface">دَوْرَك</span>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary text-label-large font-bold rounded-full transition cursor-pointer print:hidden min-h-[48px]"
        >
          <span className="material-symbols-rounded text-lg">print</span>
          <span>طباعة</span>
        </button>
      </div>

      {/* Main Printable Card */}
      <main className="w-full max-w-sm sm:max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant p-6 sm:p-8 print:border-none print:shadow-none print:max-w-none print:w-full print:h-full print:p-0 print:break-inside-avoid flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-label-small font-bold mb-4">
          <span className="material-symbols-rounded text-sm">confirmation_number</span>
          <span>دَوْرَك</span>
        </div>

        {/* Window Name */}
        <h1 className="text-headline-medium sm:text-headline-large font-bold text-on-surface mb-1">
          {windowData.name}
        </h1>

        {/* Location */}
        <div className="inline-flex items-center gap-1 text-body-medium text-on-surface-variant mb-6">
          <span className="material-symbols-rounded text-base text-outline">location_on</span>
          <span>{windowData.location}</span>
        </div>

        {/* QR Code Container */}
        <div className="p-4 bg-white border-2 border-on-surface rounded-3xl mb-5 flex items-center justify-center">
          <QRCodeSVG
            value={qrUrl}
            size={240}
            level="H"
            includeMargin={false}
            className="w-[240px] h-[240px]"
          />
        </div>

        {/* Instructions */}
        <p className="text-headline-small font-bold text-on-surface mb-2">
          امسح الكود لأخذ دورك
        </p>

        {/* Visible URL for manual check */}
        <p
          className="text-body-small text-outline font-mono break-all max-w-[280px] dir-ltr select-all"
          dir="ltr"
        >
          {qrUrl}
        </p>
      </main>
    </div>
  );
}

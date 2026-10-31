interface DisconnectionBannerProps {
  isConnected: boolean;
}

export function DisconnectionBanner({ isConnected }: DisconnectionBannerProps) {
  if (isConnected) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 bg-warning text-on-warning text-label-small font-bold py-2 px-3 flex items-center justify-center gap-2 shadow-xs transition-all"
    >
      <span className="material-symbols-rounded text-base animate-pulse">wifi_off</span>
      <span>انقطع الاتصال بالخادم، جارٍ إعادة المحاولة تلقائياً...</span>
    </div>
  );
}

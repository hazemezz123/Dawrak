import { useState, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { translateError } from '../lib/api.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noWindowsNotice, setNoWindowsNotice] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  const from = (location.state as any)?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNoWindowsNotice(false);

    if (!email.trim() || !password) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (password.length < 8) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(email.trim(), password);

      if (user.role === 'SUPER_ADMIN') {
        navigate(from || '/admin', { replace: true });
      } else {
        // Staff role
        if (user.windowIds && user.windowIds.length > 0) {
          navigate(from || `/admin/${user.windowIds[0]}`, { replace: true });
        } else {
          setNoWindowsNotice(true);
        }
      }
    } catch (err: any) {
      setError(translateError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-3xl border border-outline-variant/40 p-6 sm:p-8 shadow-xs text-right">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-label-small font-bold mb-3">
            <span className="material-symbols-rounded text-sm">lock</span>
            <span>بوابة طاقم العمل</span>
          </div>
          <h1 className="text-headline-medium font-bold text-on-surface">دَوْرَك</h1>
          <p className="text-body-medium text-on-surface-variant mt-1">
            تسجيل الدخول — إدارة طوابير شؤون الطلاب
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-2xl bg-error-container text-on-error-container text-body-medium font-medium flex items-center gap-2 border border-error/20"
          >
            <span className="material-symbols-rounded text-xl shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* No Windows Assigned Notice for Staff */}
        {noWindowsNotice && (
          <div
            role="alert"
            className="mb-5 p-4 rounded-2xl bg-warning-container text-on-warning-container text-body-medium font-semibold flex items-center gap-2 border border-warning/20"
          >
            <span className="material-symbols-rounded text-xl shrink-0">warning</span>
            <span>لا توجد شبابيك مرتبطة بحسابك حالياً. يرجى مراجعة مسؤول النظام.</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={emailId} className="block text-label-medium font-bold text-on-surface mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@faculty.edu"
              required
              className="w-full min-h-[48px] px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:outline-none text-body-large text-on-surface transition-colors dir-ltr text-right"
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor={passwordId} className="block text-label-medium font-bold text-on-surface mb-1.5">
              كلمة المرور
            </label>
            <input
              id={passwordId}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:outline-none text-body-large text-on-surface transition-colors dir-ltr text-right"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[48px] mt-2 py-3 px-6 bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary rounded-full text-label-large font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <span className="material-symbols-rounded animate-spin text-xl">progress_activity</span>
            ) : (
              <span className="material-symbols-rounded text-xl">login</span>
            )}
            <span>تسجيل الدخول</span>
          </button>
        </form>
      </div>
    </main>
  );
}

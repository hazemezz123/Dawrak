import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  registerStudent,
  translateError,
  type StudentData,
} from '../lib/api.js';

interface StudentRegistrationCardProps {
  deviceId: string;
  onRegistered: (student: StudentData) => void;
}

function normalizePhoneInput(value: string): string {
  let digits = value.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+20')) {
    digits = `0${digits.slice(3)}`;
  } else if (digits.startsWith('0020')) {
    digits = `0${digits.slice(4)}`;
  }
  return digits;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function StudentRegistrationCard({
  deviceId,
  onRegistered,
}: StudentRegistrationCardProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      registerStudent({ deviceId, fullName, phone }),
    onSuccess: (student) => {
      setSubmitError(null);
      onRegistered(student);
    },
    onError: (err: any) => {
      setSubmitError(translateError(err));
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const normalizedName = normalizeName(fullName);
    const nextNameError =
      normalizedName.length < 2 || normalizedName.length > 80
        ? 'يرجى إدخال الاسم بالكامل (من حرفين إلى 80 حرفًا).'
        : null;
    const nextPhoneError = /^01[0125]\d{8}$/.test(normalizePhoneInput(phone))
      ? null
      : 'يرجى إدخال رقم موبايل مصري صحيح يبدأ بـ 01.';

    setNameError(nextNameError);
    setPhoneError(nextPhoneError);
    if (nextNameError || nextPhoneError) return;

    mutation.mutate();
  };

  return (
    <section
      aria-labelledby="registration-heading"
      className="bg-surface-container-low rounded-3xl p-5 sm:p-6 text-right border border-outline-variant/40"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-rounded text-primary text-xl" aria-hidden="true">
          badge
        </span>
        <h2 id="registration-heading" className="text-title-large font-bold text-on-surface">
          تسجيل بيانات الطالب
        </h2>
      </div>
      <p className="text-body-medium text-on-surface-variant mb-5 leading-relaxed">
        سجّل اسمك ورقم موبايلك مرة واحدة فقط، وستظهر الخدمات مباشرة بعد التسجيل.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="student-name"
            className="block text-label-large font-bold text-on-surface mb-1.5"
          >
            الاسم بالكامل
          </label>
          <input
            id="student-name"
            type="text"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setNameError(null);
            }}
            autoComplete="name"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'student-name-error' : undefined}
            className="w-full min-h-[48px] rounded-2xl bg-surface border border-outline-variant px-4 py-2.5 text-body-large text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {nameError && (
            <p id="student-name-error" role="alert" className="text-body-small text-error mt-1.5">
              {nameError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="student-phone"
            className="block text-label-large font-bold text-on-surface mb-1.5"
          >
            رقم الموبايل
          </label>
          <input
            id="student-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setPhoneError(null);
            }}
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            dir="ltr"
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? 'student-phone-error' : undefined}
            className="w-full min-h-[48px] rounded-2xl bg-surface border border-outline-variant px-4 py-2.5 text-body-large text-on-surface text-left focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {phoneError && (
            <p id="student-phone-error" role="alert" className="text-body-small text-error mt-1.5">
              {phoneError}
            </p>
          )}
        </div>

        {submitError && (
          <div
            role="alert"
            className="bg-error-container text-on-error-container rounded-2xl p-4 text-body-medium leading-snug flex items-start gap-2 border border-error/20"
          >
            <span className="material-symbols-rounded text-xl shrink-0" aria-hidden="true">
              error
            </span>
            <span>{submitError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full min-h-[52px] py-2.5 px-6 bg-primary text-on-primary rounded-full text-title-medium font-bold hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <span className="material-symbols-rounded animate-spin text-xl" aria-hidden="true">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-rounded text-xl" aria-hidden="true">
              how_to_reg
            </span>
          )}
          <span>{mutation.isPending ? 'جارٍ التسجيل...' : 'تسجيل ومتابعة'}</span>
        </button>
      </form>
    </section>
  );
}

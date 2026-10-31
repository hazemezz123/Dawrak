const EGYPTIAN_MOBILE_PATTERN = /^01[0125]\d{8}$/;

/**
 * Returns the canonical 01XXXXXXXXX form of an Egyptian mobile number,
 * or null when the input is not a valid Egyptian mobile number.
 */
export function normalizePhone(input: string): string | null {
  let phone = input.replace(/[\s\-()]/g, '');

  if (phone.startsWith('+20')) {
    phone = `0${phone.slice(3)}`;
  } else if (phone.startsWith('0020')) {
    phone = `0${phone.slice(4)}`;
  }

  return EGYPTIAN_MOBILE_PATTERN.test(phone) ? phone : null;
}

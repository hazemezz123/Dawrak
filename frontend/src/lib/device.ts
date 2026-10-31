const DEVICE_ID_KEY = 'dawrak_device_id';
const ACTIVE_TICKET_PREFIX = 'dawrak_active_ticket_';

/**
 * Verifies whether localStorage is available and writable.
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__dawrak_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates an RFC 4122 UUID v4, falling back to crypto.getRandomValues
 * in insecure contexts (such as LAN HTTP) where crypto.randomUUID is unavailable.
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error('CRYPTO_UNAVAILABLE: Neither crypto.randomUUID nor crypto.getRandomValues is available');
}

/**
 * Retrieves existing device ID or creates and stores a new UUID.
 * Throws an error if localStorage is not accessible.
 */
export function getOrCreateDeviceId(): string {
  if (!isLocalStorageAvailable()) {
    throw new Error('LOCALSTORAGE_UNAVAILABLE');
  }

  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateUuid();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Saves active ticket ID for a given window so student can easily navigate back to it.
 */
export function saveActiveTicket(windowId: string, ticketId: string): void {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(`${ACTIVE_TICKET_PREFIX}${windowId}`, ticketId);
  }
}

/**
 * Retrieves the stored active ticket ID for a given window.
 */
export function getActiveTicket(windowId: string): string | null {
  if (!isLocalStorageAvailable()) return null;
  return window.localStorage.getItem(`${ACTIVE_TICKET_PREFIX}${windowId}`);
}

/**
 * Clears stored active ticket when it is served or cancelled.
 */
export function clearActiveTicket(windowId: string): void {
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(`${ACTIVE_TICKET_PREFIX}${windowId}`);
  }
}

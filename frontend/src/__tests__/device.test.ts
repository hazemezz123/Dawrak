import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOrCreateDeviceId, isLocalStorageAvailable } from '../lib/device.js';

describe('Device Token Manager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates a new UUID on first visit and stores it in localStorage', () => {
    expect(window.localStorage.getItem('dawrak_device_id')).toBeNull();

    const deviceId = getOrCreateDeviceId();

    expect(deviceId).toBeDefined();
    expect(typeof deviceId).toBe('string');
    // UUID v4 format verification (RFC 4122 v4: version 4, variant 10xx -> [89ab])
    expect(deviceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(window.localStorage.getItem('dawrak_device_id')).toBe(deviceId);
  });

  it('falls back to crypto.getRandomValues when crypto.randomUUID is undefined', () => {
    const proto = Object.getPrototypeOf(crypto);
    const desc = Object.getOwnPropertyDescriptor(proto, 'randomUUID');
    delete (crypto as any).randomUUID;
    if (proto && 'randomUUID' in proto) {
      delete proto.randomUUID;
    }

    try {
      expect(crypto.randomUUID).toBeUndefined();
      const deviceId = getOrCreateDeviceId();
      expect(deviceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      expect(window.localStorage.getItem('dawrak_device_id')).toBe(deviceId);

      // Re-use on later visits still works with fallback
      const secondVisitId = getOrCreateDeviceId();
      expect(secondVisitId).toBe(deviceId);
    } finally {
      if (desc) {
        Object.defineProperty(proto, 'randomUUID', desc);
      }
    }
  });

  it('throws a clear error when both crypto.randomUUID and crypto.getRandomValues are missing', () => {
    const proto = Object.getPrototypeOf(crypto);
    const descUUID = Object.getOwnPropertyDescriptor(proto, 'randomUUID');
    const descRand = Object.getOwnPropertyDescriptor(proto, 'getRandomValues');

    delete (crypto as any).randomUUID;
    delete (crypto as any).getRandomValues;
    if (proto && 'randomUUID' in proto) {
      delete proto.randomUUID;
    }
    if (proto && 'getRandomValues' in proto) {
      delete proto.getRandomValues;
    }

    try {
      expect(crypto.randomUUID).toBeUndefined();
      expect((crypto as any).getRandomValues).toBeUndefined();
      expect(() => getOrCreateDeviceId()).toThrow(/crypto/i);
    } finally {
      if (descUUID) Object.defineProperty(proto, 'randomUUID', descUUID);
      if (descRand) Object.defineProperty(proto, 'getRandomValues', descRand);
    }
  });

  it('re-uses the exact same device ID on later visits', () => {
    const firstVisitId = getOrCreateDeviceId();
    const secondVisitId = getOrCreateDeviceId();
    const thirdVisitId = getOrCreateDeviceId();

    expect(secondVisitId).toBe(firstVisitId);
    expect(thirdVisitId).toBe(firstVisitId);
    expect(window.localStorage.getItem('dawrak_device_id')).toBe(firstVisitId);
  });

  it('detects when localStorage is unavailable and throws', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded or SecurityError in private mode');
    });

    expect(isLocalStorageAvailable()).toBe(false);
    expect(() => getOrCreateDeviceId()).toThrow('LOCALSTORAGE_UNAVAILABLE');

    setItemSpy.mockRestore();
  });
});

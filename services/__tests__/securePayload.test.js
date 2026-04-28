import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { computeChecksum, decryptJson, encryptJson, hasEncryptionKey } from '../securePayload.js';

describe('securePayload', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports missing key when OSINT_ENCRYPTION_KEY is not set', () => {
    delete process.env.OSINT_ENCRYPTION_KEY;
    expect(hasEncryptionKey()).toBe(false);
    expect(encryptJson({ a: 1 })).toBe(null);
  });

  it('encrypts and decrypts JSON payloads with AES-256-GCM', () => {
    process.env.OSINT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    expect(hasEncryptionKey()).toBe(true);

    const payload = { target: 'example.com', ok: true, nested: { n: 1 } };
    const env = encryptJson(payload);
    expect(env).toBeTruthy();
    expect(env.alg).toBe('aes-256-gcm');

    const roundTrip = decryptJson(env);
    expect(roundTrip).toEqual(payload);
  });

  it('computes deterministic SHA-256 checksum for JSON payloads', () => {
    const a = computeChecksum({ x: 1, y: 2 });
    const b = computeChecksum({ x: 1, y: 2 });
    expect(a).toEqual(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});


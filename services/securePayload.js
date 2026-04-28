import crypto from 'node:crypto';

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseKey() {
  const raw = process.env.OSINT_ENCRYPTION_KEY;
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  try {
    const buf = /^[0-9a-fA-F]+$/.test(trimmed) ? Buffer.from(trimmed, 'hex') : Buffer.from(trimmed, 'base64');
    if (buf.length !== 32) return null;
    return buf;
  } catch {
    return null;
  }
}

export function computeChecksum(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return sha256Hex(text);
}

export function encryptJson(payload) {
  const key = parseKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

export function decryptJson(envelope) {
  const key = parseKey();
  if (!key) return null;
  if (!envelope || envelope.alg !== 'aes-256-gcm') return null;
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

export function hasEncryptionKey() {
  return Boolean(parseKey());
}


import { describe, it, expect } from 'vitest';
import { runPhoneInvestigator } from '../phoneInvestigator.js';

describe('runPhoneInvestigator (libphonenumber)', () => {
  it('parses and validates an E.164 number', async () => {
    const res = await runPhoneInvestigator('+60123456789');
    expect(res.module).toBe('PhoneInvestigator');
    expect(res.data.e164).toBe('+60123456789');
    expect(typeof res.data.possible).toBe('boolean');
    expect(typeof res.data.valid).toBe('boolean');
    expect(res.data.calling_code).toBe('60');
    expect(res.data.carrier === null || typeof res.data.carrier === 'string').toBe(true);
    expect(Array.isArray(res.data.time_zones)).toBe(true);
  });

  it('handles malformed input safely', async () => {
    const res = await runPhoneInvestigator('abc');
    expect(res.data.e164 === null || typeof res.data.e164 === 'string').toBe(true);
    expect(res.data.valid).toBe(false);
    expect(res.data.carrier === null || typeof res.data.carrier === 'string').toBe(true);
  });
});

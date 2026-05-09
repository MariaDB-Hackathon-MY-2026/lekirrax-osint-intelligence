import { describe, it, expect, vi } from 'vitest';

describe('runEmailValidator', () => {
  it('returns Medium when domain has no MX records', async () => {
    const { runEmailValidator } = await import('../emailValidator.js');
    const res = await runEmailValidator('a@nomx.example', {
      emailDisposablePyLookupEnabled: false,
      resolveMx: vi.fn(async () => [])
    });

    expect(res.module).toBe('EmailValidator');
    expect(res.risk).toBe('Medium');
    expect(res.data.deliverable).toBe('Unlikely');
    expect(res.data.mx_provider).toBe(null);
    expect(res.data.mx_lookup_status).toBe('no_mx');
  });

  it('returns Low and detects Google Workspace from MX', async () => {
    const { runEmailValidator } = await import('../emailValidator.js');
    const res = await runEmailValidator('a@corp.example', {
      emailDisposablePyLookupEnabled: false,
      resolveMx: vi.fn(async () => [
        { priority: 10, exchange: 'aspmx.l.google.com' },
        { priority: 20, exchange: 'alt1.aspmx.l.google.com' }
      ])
    });

    expect(res.risk).toBe('Low');
    expect(res.data.deliverable).toBe('Likely');
    expect(res.data.mx_provider).toBe('Google Workspace');
    expect(res.data.mx_lookup_status).toBe('ok');
  });

  it('returns High when disposableLookup marks domain disposable', async () => {
    const { runEmailValidator } = await import('../emailValidator.js');
    const res = await runEmailValidator('a@something.example', {
      emailDisposablePyLookupEnabled: false,
      resolveMx: vi.fn(async () => [{ priority: 10, exchange: 'mx1.example.net' }]),
      disposableLookup: vi.fn(async () => ({ ok: true, is_disposable: true, source: 'list' }))
    });

    expect(res.risk).toBe('High');
    expect(res.data.is_disposable).toBe(true);
  });

  it('returns Unknown deliverable when DNS lookup fails', async () => {
    const { runEmailValidator } = await import('../emailValidator.js');
    const err = new Error('DNS');
    err.code = 'EAI_AGAIN';
    const res = await runEmailValidator('a@gmail.com', {
      emailDisposablePyLookupEnabled: false,
      resolveMx: vi.fn(async () => {
        throw err;
      })
    });

    expect(res.data.deliverable).toBe('Unknown');
    expect(res.data.mx_lookup_status).toBe('dns_error');
    expect(res.data.mx_lookup_error).toBe('EAI_AGAIN');
  });
});

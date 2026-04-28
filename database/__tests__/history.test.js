import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockBegin = vi.fn();
const mockCommit = vi.fn();
const mockRollback = vi.fn();
const mockConn = {
  beginTransaction: mockBegin,
  commit: mockCommit,
  rollback: mockRollback,
  query: mockQuery,
  release: mockRelease
};

const mockGetConnection = vi.fn(async () => mockConn);

vi.mock('../index.js', () => ({
  pool: {
    getConnection: mockGetConnection
  }
}));

describe('database history queries', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockRelease.mockReset();
    mockGetConnection.mockClear();
    mockBegin.mockReset();
    mockCommit.mockReset();
    mockRollback.mockReset();
  });

  it('returns paginated scan history with totals', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        {
          id: 10,
          target: 'example.com',
          scan_date: new Date('2026-01-01T00:00:00Z'),
          threat_level: 7,
          summary: 'ok',
          firewall_detected: 1,
          waf_name: 'cloudflare',
          systems_count: 3,
          osint_count: 1
        }
      ]);

    const { getScansHistoryPage } = await import('../storage.js');
    const res = await getScansHistoryPage({ q: 'example', page: 1, pageSize: 25 });

    expect(res.total).toBe(2);
    expect(res.items.length).toBe(1);
    expect(res.items[0].id).toBe(10);
    expect(res.items[0].target).toBe('example.com');
    expect(res.items[0].threat_level).toBe(7);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns scan details or null when missing', async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: 1, target: 'a.com', scan_date: new Date('2026-01-01T00:00:00Z') }])
      .mockResolvedValueOnce([{ threat_level: 4, summary: 's', vulnerabilities: null, remediation: null }])
      .mockResolvedValueOnce([{ firewall_detected: 0, waf_name: null, confidence: null, headers_checked: null }])
      .mockResolvedValueOnce([{ id: 2, subdomain: null, ip: '1.1.1.1', risk_score: 2, risk_level: 'Low', risk_reasons: '[]' }])
      .mockResolvedValueOnce([{ system_id: 2, port: 80, status: 'open' }])
      .mockResolvedValueOnce([{ module: 'email-validator', risk_level: 'Low', created_at: new Date('2026-01-01T00:00:00Z') }]);

    const { getScanDetails } = await import('../storage.js');
    const res = await getScanDetails(1);
    expect(res.scan.id).toBe(1);
    expect(res.aiAnalysis.threat_level).toBe(4);
    expect(res.systems[0].ports[0].port).toBe(80);
  });

  it('deletes scan history in a transaction', async () => {
    mockBegin.mockResolvedValueOnce(undefined);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
    mockCommit.mockResolvedValueOnce(undefined);

    const { deleteScanHistory } = await import('../storage.js');
    const res = await deleteScanHistory(55);

    expect(mockBegin).toHaveBeenCalledTimes(1);
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockRollback).toHaveBeenCalledTimes(0);
    expect(res).toEqual({ deleted: true, id: 55 });
  });

  it('returns NOT_FOUND when deleting missing scan', async () => {
    mockBegin.mockResolvedValueOnce(undefined);
    mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
    mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
    mockRollback.mockResolvedValueOnce(undefined);

    const { deleteScanHistory } = await import('../storage.js');
    await expect(deleteScanHistory(999)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(mockBegin).toHaveBeenCalledTimes(1);
    expect(mockCommit).toHaveBeenCalledTimes(0);
    expect(mockRollback).toHaveBeenCalledTimes(1);
  });

  it('deletes OSINT activity row', async () => {
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const { deleteOsintActivity } = await import('../storage.js');
    const res = await deleteOsintActivity(12);
    expect(res).toEqual({ deleted: true, id: 12 });
  });
});

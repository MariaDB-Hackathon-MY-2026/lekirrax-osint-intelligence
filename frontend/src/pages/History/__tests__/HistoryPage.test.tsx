import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import HistoryPage from '../HistoryPage';

vi.mock('../../../services/api', () => ({
  getHistoryScans: vi.fn(),
  getHistoryScanDetails: vi.fn(),
  getHistoryOsint: vi.fn(),
  getHistoryOsintDetails: vi.fn(),
  deleteHistoryScan: vi.fn(),
  deleteHistoryOsint: vi.fn()
}));

const { getHistoryScans, getHistoryScanDetails, getHistoryOsint, deleteHistoryScan, deleteHistoryOsint } = await import('../../../services/api');

describe('HistoryPage', () => {
  beforeEach(() => {
    (getHistoryScans as any).mockReset();
    (getHistoryScanDetails as any).mockReset();
    (getHistoryOsint as any).mockReset();
    (deleteHistoryScan as any).mockReset();
    (deleteHistoryOsint as any).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads and renders history rows', async () => {
    (getHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [
        {
          id: 1,
          target: 'example.com',
          scan_date: '2026-01-01T00:00:00.000Z',
          has_snapshot: true,
          threat_level: 5,
          summary: null,
          firewall_detected: true,
          waf_name: 'cloudflare',
          systems_count: 2,
          osint_count: 1
        }
      ],
      total: 1,
      page: 1,
      pageSize: 25
    });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} />);

    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('cloudflare')).toBeInTheDocument();
  });

  it('opens details drawer', async () => {
    (getHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [
        {
          id: 7,
          target: 'a.com',
          scan_date: '2026-01-01T00:00:00.000Z',
          has_snapshot: false,
          threat_level: 3,
          summary: null,
          firewall_detected: null,
          waf_name: null,
          systems_count: 0,
          osint_count: 0
        }
      ],
      total: 1,
      page: 1,
      pageSize: 25
    });

    (getHistoryScanDetails as any).mockResolvedValue({
      status: 'success',
      data: {
        scan: { id: 7, target: 'a.com', scan_date: '2026-01-01T00:00:00.000Z' },
        aiAnalysis: { threat_level: 3, summary: 's' },
        firewall: null,
        systems: [],
        osintResults: []
      }
    });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} />);
    await screen.findByText('a.com');

    fireEvent.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(screen.getByText('Scan #7')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(within(dialog).getByText('a.com')).toBeInTheDocument();
  });

  it('deletes scan row after confirmation', async () => {
    (getHistoryScans as any)
      .mockResolvedValueOnce({
        status: 'success',
        items: [
          {
            id: 1,
            target: 'delete-me.com',
            scan_date: '2026-01-01T00:00:00.000Z',
            has_snapshot: false,
            threat_level: 5,
            summary: null,
            firewall_detected: null,
            waf_name: null,
            systems_count: 0,
            osint_count: 0
          }
        ],
        total: 1,
        page: 1,
        pageSize: 25
      })
      .mockResolvedValueOnce({
        status: 'success',
        items: [],
        total: 0,
        page: 1,
        pageSize: 25
      });
    (deleteHistoryScan as any).mockResolvedValue({ status: 'success', data: { deleted: true, id: 1 } });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} />);
    await screen.findByText('delete-me.com');

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Confirm delete' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteHistoryScan).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.queryByText('delete-me.com')).not.toBeInTheDocument();
    });
  });

  it('deletes OSINT record in table view after confirmation', async () => {
    (getHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [],
      total: 0,
      page: 1,
      pageSize: 25
    });
    (getHistoryOsint as any)
      .mockResolvedValueOnce({
        status: 'success',
        items: [
          {
            id: 9,
            created_at: '2026-01-01T00:00:00.000Z',
            investigation_type: 'username',
            module: 'alias-finder',
            target: 'bob',
            risk_level: 'Low',
            username: 'admin',
            scan_id: null,
            result_version: 1,
            encrypted: false,
            payload_available: false
          }
        ],
        total: 1,
        page: 1,
        pageSize: 25
      })
      .mockResolvedValueOnce({
        status: 'success',
        items: [],
        total: 0,
        page: 1,
        pageSize: 25
      });
    (deleteHistoryOsint as any).mockResolvedValue({ status: 'success', data: { deleted: true, id: 9 } });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} />);

    fireEvent.click(screen.getByRole('tab', { name: 'OSINT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    await screen.findByText('alias-finder');

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Confirm delete' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteHistoryOsint).toHaveBeenCalledWith(9);
    });

    await waitFor(() => {
      expect(screen.queryByText('alias-finder')).not.toBeInTheDocument();
    });
  });
});

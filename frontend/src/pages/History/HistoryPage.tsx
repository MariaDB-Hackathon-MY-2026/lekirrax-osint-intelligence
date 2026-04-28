import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './HistoryPage.css';
import { deleteHistoryOsint, deleteHistoryScan, getHistoryOsint, getHistoryOsintDetails, getHistoryScans, getHistoryScanDetails } from '../../services/api';
import JsonViewer from '../../components/JsonViewer';

type HistoryListItem = {
  id: number;
  target: string;
  scan_date: string | null;
  has_snapshot: boolean;
  threat_level: number | null;
  summary: string | null;
  firewall_detected: boolean | null;
  waf_name: string | null;
  systems_count: number;
  osint_count: number;
};

type HistoryListResponse = {
  status: 'success' | 'error';
  items: HistoryListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type HistoryDetailResponse = {
  status: 'success' | 'error';
  data: any;
};

type OsintListItem = {
  id: number;
  created_at: string | null;
  investigation_type: string;
  module: string;
  target: string;
  risk_level: string | null;
  username: string | null;
  scan_id: number | null;
  result_version: number;
  encrypted: boolean;
  payload_available: boolean;
};

type OsintListResponse = {
  status: 'success' | 'error';
  items: OsintListItem[];
  total: number;
  page: number;
  pageSize: number;
};

interface HistoryPageProps {
  onBack: () => void;
  onRunQuery?: (target: string) => void;
}

export default function HistoryPage({ onBack, onRunQuery }: HistoryPageProps) {
  const [tab, setTab] = useState<'scans' | 'osint'>('scans');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'scan_date' | 'target' | 'threat_level'>('scan_date');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [moduleFilter, setModuleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [encryptedOnly, setEncryptedOnly] = useState(false);
  const [payloadOnly, setPayloadOnly] = useState(false);
  const [osintView, setOsintView] = useState<'timeline' | 'table'>('timeline');
  const [osintPayloadView, setOsintPayloadView] = useState<'tree' | 'code'>('tree');
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoryListResponse | null>(null);
  const [osintData, setOsintData] = useState<OsintListResponse | null>(null);

  const [selected, setSelected] = useState<{ kind: 'scan' | 'osint'; id: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [showAllSystems, setShowAllSystems] = useState(false);
  const [showAllOsint, setShowAllOsint] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'scan' | 'osint';
    id: number;
    label?: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmDelete]);

  const totalPages = useMemo(() => {
    const total = tab === 'scans' ? (data?.total ?? 0) : (osintData?.total ?? 0);
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, osintData?.total, pageSize, tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const p =
      tab === 'scans'
        ? getHistoryScans({ q, from, to, sort, order, page, pageSize }).then((res: HistoryListResponse) => {
            if (cancelled) return;
            setData(res);
          })
        : getHistoryOsint({
            q,
            from,
            to,
            module: moduleFilter,
            type: typeFilter,
            source: sourceFilter,
            risk: riskFilter,
            encrypted: encryptedOnly ? '1' : undefined,
            payloadAvailable: payloadOnly ? '1' : undefined,
            page,
            pageSize
          }).then((res: OsintListResponse) => {
            if (cancelled) return;
            setOsintData(res);
          });

    p.catch((e: any) => {
      if (cancelled) return;
      setError(e?.message || 'Failed to load history');
    }).finally(() => {
      if (cancelled) return;
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [q, from, to, sort, order, page, pageSize, tab, moduleFilter, typeFilter, sourceFilter, riskFilter, encryptedOnly, payloadOnly, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    setShowAllSystems(false);
    setShowAllOsint(false);
    setOsintPayloadView('tree');
    const p = selected.kind === 'scan' ? getHistoryScanDetails(selected.id) : getHistoryOsintDetails(selected.id);
    p.then((res: HistoryDetailResponse) => {
      if (cancelled) return;
      setDetail(res.data);
    })
      .catch((e: any) => {
        if (cancelled) return;
        setDetailError(e?.message || 'Failed to load details');
      })
      .finally(() => {
        if (cancelled) return;
        setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const openDeleteConfirm = (payload: { kind: 'scan' | 'osint'; id: number; label?: string }) => {
    setConfirmDelete(payload);
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirmDelete.kind === 'scan') {
        await deleteHistoryScan(confirmDelete.id);
      } else {
        await deleteHistoryOsint(confirmDelete.id);
      }
      setConfirmDelete(null);
      setConfirmBusy(false);
      if (selected?.kind === confirmDelete.kind && selected.id === confirmDelete.id) {
        setSelected(null);
      }
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      const msg = e?.message || 'Delete failed';
      if (msg === 'Not found') {
        setConfirmDelete(null);
        setConfirmBusy(false);
        if (selected?.kind === confirmDelete.kind && selected.id === confirmDelete.id) {
          setSelected(null);
        }
        setRefreshKey((k) => k + 1);
        setError('Already deleted. Refreshing history…');
        return;
      }
      setConfirmBusy(false);
      setError(msg);
    }
  };

  const items = data?.items ?? [];
  const osintItems = useMemo(() => {
    const raw = osintData?.items ?? [];
    let out = raw;
    if (riskFilter) {
      out = out.filter((r) => (r.risk_level || '').toLowerCase() === riskFilter);
    }
    if (encryptedOnly) {
      out = out.filter((r) => Boolean(r.encrypted));
    }
    if (payloadOnly) {
      out = out.filter((r) => Boolean(r.payload_available));
    }
    return out;
  }, [encryptedOnly, osintData?.items, payloadOnly, riskFilter]);
  const showingFrom = (tab === 'scans' ? items.length : osintItems.length) ? (page - 1) * pageSize + 1 : 0;
  const showingTo = (page - 1) * pageSize + (tab === 'scans' ? items.length : osintItems.length);

  const downloadOsintExport = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('token') || '';
      const qs = new URLSearchParams();
      qs.set('format', format);
      if (q) qs.set('q', q);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (moduleFilter) qs.set('module', moduleFilter);
      if (typeFilter) qs.set('type', typeFilter);
      if (sourceFilter) qs.set('source', sourceFilter);
      if (riskFilter) qs.set('risk', riskFilter);
      if (encryptedOnly) qs.set('encrypted', '1');
      if (payloadOnly) qs.set('payloadAvailable', '1');
      qs.set('limit', '1000');

      const res = await fetch(`/api/history/osint/export?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `osint-history.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    }
  };

  const osintGroups = useMemo(() => {
    const groups = new Map<string, OsintListItem[]>();
    for (const row of osintItems) {
      const dt = row.created_at ? new Date(row.created_at) : null;
      const key = dt ? dt.toISOString().slice(0, 10) : 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries()).map(([day, rows]) => ({ day, rows }));
  }, [osintItems]);

  const formatRiskLabel = (risk: any) => {
    const raw = typeof risk === 'string' ? risk.trim() : '';
    if (!raw) return '—';
    const lower = raw.toLowerCase();
    if (lower === 'critical') return 'CRITICAL';
    if (lower === 'high') return 'HIGH';
    if (lower === 'medium') return 'MEDIUM';
    if (lower === 'low') return 'LOW';
    return raw.toUpperCase();
  };

  const riskTone = (risk: any) => {
    const lower = typeof risk === 'string' ? risk.toLowerCase() : '';
    if (lower === 'critical') return 'critical';
    if (lower === 'high') return 'high';
    if (lower === 'medium') return 'medium';
    if (lower === 'low') return 'low';
    return 'unknown';
  };

  const renderScanSnapshot = (snapshot: any) => {
    const obj = (() => {
      if (!snapshot) return null;
      if (typeof snapshot === 'string') {
        try {
          return JSON.parse(snapshot);
        } catch {
          return null;
        }
      }
      return snapshot;
    })();

    if (!obj || typeof obj !== 'object') {
      return <div className="history-small">No scan snapshot stored for this record.</div>;
    }

    const pick = (v: any) => (v == null || v === '' ? '—' : String(v));
    const yesNo = (v: any) => (v ? 'Yes' : 'No');
    const truncate = (v: any, n = 72) => {
      const s = v == null ? '' : String(v);
      if (!s) return '—';
      return s.length > n ? `${s.slice(0, n)}…` : s;
    };

    const ssl = (obj as any).ssl;
    const dns = (obj as any).dns;
    const whois = (obj as any).whois;
    const securityTxt = (obj as any).securityTxt;
    const crawlRules = (obj as any).crawlRules;
    const socialTags = (obj as any).socialTags;
    const firewall = (obj as any).firewall;

    const scanDate = (obj as any).scanDate || (obj as any).scan_date || null;
    const scanDateText = scanDate ? new Date(String(scanDate)).toLocaleString() : '—';

    const dnsSecurity = dns?.security;
    const spf = dnsSecurity?.spf;
    const dmarc = dnsSecurity?.dmarc;
    const dkim = Array.isArray(dnsSecurity?.dkim) ? dnsSecurity.dkim : [];

    return (
      <div className="history-snapshot-grid">
        <div className="history-snapshot-section">
          <div className="history-section-title">Snapshot</div>
          <div className="history-kv history-kv--flat">
            <div className="k">Version</div>
            <div className="v">{pick((obj as any).version)}</div>
            <div className="k">Scan Date</div>
            <div className="v">{scanDateText}</div>
            <div className="k">SSL</div>
            <div className="v">{ssl ? 'Present' : '—'}</div>
            <div className="k">DNS</div>
            <div className="v">{dns ? 'Present' : '—'}</div>
            <div className="k">WHOIS</div>
            <div className="v">{whois ? 'Present' : '—'}</div>
            <div className="k">security.txt</div>
            <div className="v">{securityTxt?.present ? 'Present' : '—'}</div>
            <div className="k">Social Tags</div>
            <div className="v">{socialTags ? 'Present' : '—'}</div>
          </div>
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">SSL</div>
          {!ssl ? (
            <div className="history-small">No SSL data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Subject</div>
              <div className="v">{pick(ssl?.subject?.CN || ssl?.subject?.O)}</div>
              <div className="k">Issuer</div>
              <div className="v">{pick(ssl?.issuer?.O || ssl?.issuer?.CN)}</div>
              <div className="k">Valid From</div>
              <div className="v">{pick(ssl?.validFrom || ssl?.valid_from)}</div>
              <div className="k">Valid To</div>
              <div className="v">{pick(ssl?.validTo || ssl?.valid_to)}</div>
              <div className="k">SANs</div>
              <div className="v">{Array.isArray(ssl?.subjectaltname) ? String(ssl.subjectaltname.length) : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">DNS</div>
          {!dns ? (
            <div className="history-small">No DNS data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">IPv4 (A)</div>
              <div className="v">{pick(dns?.total_a_recs)}</div>
              <div className="k">IPv6 (AAAA)</div>
              <div className="v">{Array.isArray(dns?.aaaa) ? String(dns.aaaa.length) : '—'}</div>
              <div className="k">CNAME</div>
              <div className="v">{Array.isArray(dns?.cname) ? String(dns.cname.length) : '—'}</div>
              <div className="k">MX</div>
              <div className="v">{Array.isArray(dns?.mx) ? String(dns.mx.length) : '—'}</div>
              <div className="k">NS</div>
              <div className="v">{Array.isArray(dns?.ns) ? String(dns.ns.length) : '—'}</div>
              <div className="k">TXT</div>
              <div className="v">{Array.isArray(dns?.txt) ? String(dns.txt.length) : '—'}</div>
              <div className="k">SPF</div>
              <div className="v">{spf ? 'Present' : '—'}</div>
              <div className="k">DMARC</div>
              <div className="v">{dmarc ? 'Present' : '—'}</div>
              <div className="k">DKIM</div>
              <div className="v">{dkim.length ? String(dkim.length) : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">Firewall / WAF</div>
          {!firewall ? (
            <div className="history-small">No firewall data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Detected</div>
              <div className="v">{yesNo(firewall?.firewall || firewall?.firewall_detected)}</div>
              <div className="k">WAF</div>
              <div className="v">{pick(firewall?.waf || firewall?.waf_name)}</div>
              <div className="k">Confidence</div>
              <div className="v">{pick(firewall?.confidence)}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">Metadata</div>
          {!socialTags ? (
            <div className="history-small">No social tag data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">OG Title</div>
              <div className="v">{truncate(socialTags?.ogTitle)}</div>
              <div className="k">OG Description</div>
              <div className="v">{truncate(socialTags?.ogDescription)}</div>
              <div className="k">Twitter Card</div>
              <div className="v">{pick(socialTags?.twitterCard)}</div>
              <div className="k">Twitter Site</div>
              <div className="v">{pick(socialTags?.twitterSite)}</div>
              <div className="k">Image</div>
              <div className="v">{socialTags?.image ? 'Present' : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">security.txt</div>
          {!securityTxt ? (
            <div className="history-small">No security.txt data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Present</div>
              <div className="v">{securityTxt?.present ? 'Yes' : 'No'}</div>
              <div className="k">Contact</div>
              <div className="v">{pick(securityTxt?.contact)}</div>
              <div className="k">Encryption</div>
              <div className="v">{pick(securityTxt?.encryption)}</div>
              <div className="k">Policy</div>
              <div className="v">{pick(securityTxt?.policy)}</div>
              <div className="k">Expires</div>
              <div className="v">{pick(securityTxt?.expires)}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">WHOIS</div>
          {!whois ? (
            <div className="history-small">No WHOIS data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Registrar</div>
              <div className="v">{pick(whois?.registrar)}</div>
              <div className="k">Registered</div>
              <div className="v">{pick(whois?.registeredDate)}</div>
              <div className="k">Updated</div>
              <div className="v">{pick(whois?.updatedDate)}</div>
              <div className="k">Expiry</div>
              <div className="v">{pick(whois?.expiryDate)}</div>
              <div className="k">Status</div>
              <div className="v">{pick(whois?.status)}</div>
              <div className="k">Name Servers</div>
              <div className="v">{Array.isArray(whois?.nameServers) ? String(whois.nameServers.length) : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">Crawl Rules</div>
          {!crawlRules ? (
            <div className="history-small">No crawl rules stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">robots.txt</div>
              <div className="v">{crawlRules?.robotsTxt ? 'Present' : '—'}</div>
              <div className="k">Allowed</div>
              <div className="v">{Array.isArray(crawlRules?.allowed) ? String(crawlRules.allowed.length) : '—'}</div>
              <div className="k">Disallowed</div>
              <div className="v">{Array.isArray(crawlRules?.disallowed) ? String(crawlRules.disallowed.length) : '—'}</div>
              <div className="k">Sitemaps</div>
              <div className="v">{Array.isArray(crawlRules?.sitemaps) ? String(crawlRules.sitemaps.length) : '—'}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="history-page">
      <header className="history-header">
        <button className="history-back" onClick={onBack} type="button">
          ← Back
        </button>
        <div className="history-header-text">
          <h1>History</h1>
          <p>Browse Web Check scans and OSINT investigations stored in the database.</p>
        </div>
      </header>

      <div className="history-tabs" role="tablist" aria-label="History tabs">
        <button
          type="button"
          className={`history-tab ${tab === 'scans' ? 'active' : ''}`}
          onClick={() => {
            setSelected(null);
            setDetail(null);
            setDetailError(null);
            setPage(1);
            setTab('scans');
          }}
          role="tab"
          aria-selected={tab === 'scans'}
        >
          Web Check
        </button>
        <button
          type="button"
          className={`history-tab ${tab === 'osint' ? 'active' : ''}`}
          onClick={() => {
            setSelected(null);
            setDetail(null);
            setDetailError(null);
            setPage(1);
            setTab('osint');
          }}
          role="tab"
          aria-selected={tab === 'osint'}
        >
          OSINT
        </button>
      </div>

      <section className="history-controls" aria-label="History controls">
        <div className="history-row">
          <input
            className="history-input"
            placeholder={tab === 'scans' ? 'Search target (domain/IP)…' : 'Search target / module / user…'}
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          {tab === 'scans' ? (
            <>
              <select
                className="history-select"
                value={sort}
                onChange={(e) => {
                  setPage(1);
                  setSort(e.target.value as any);
                }}
                aria-label="Sort by"
              >
                <option value="scan_date">Sort: Date</option>
                <option value="target">Sort: Target</option>
                <option value="threat_level">Sort: Threat</option>
              </select>
              <button
                className="history-order"
                type="button"
                onClick={() => {
                  setPage(1);
                  setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                }}
                aria-label="Toggle sort order"
              >
                {order === 'desc' ? '↓' : '↑'}
              </button>
            </>
          ) : (
            <>
              <input
                className="history-input history-input--sm"
                placeholder="Module…"
                value={moduleFilter}
                onChange={(e) => {
                  setPage(1);
                  setModuleFilter(e.target.value);
                }}
                aria-label="Module filter"
              />
              <input
                className="history-input history-input--sm"
                placeholder="Source…"
                value={sourceFilter}
                onChange={(e) => {
                  setPage(1);
                  setSourceFilter(e.target.value);
                }}
                aria-label="Source filter"
              />
              <input
                className="history-input history-input--sm"
                placeholder="Type…"
                value={typeFilter}
                onChange={(e) => {
                  setPage(1);
                  setTypeFilter(e.target.value);
                }}
                aria-label="Investigation type filter"
              />
              <button className="history-export" type="button" onClick={() => downloadOsintExport('json')}>
                Export JSON
              </button>
              <button className="history-export" type="button" onClick={() => downloadOsintExport('csv')}>
                Export CSV
              </button>
            </>
          )}
          <select
            className="history-select"
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
            aria-label="Page size"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>

        {tab === 'osint' && (
          <div className="history-row history-row--osint-filters" aria-label="OSINT filters">
            <div className="history-chip-group" role="group" aria-label="Risk filter">
              {[
                { key: '', label: 'All' },
                { key: 'low', label: 'Low' },
                { key: 'medium', label: 'Medium' },
                { key: 'high', label: 'High' },
                { key: 'critical', label: 'Critical' }
              ].map((opt) => (
                <button
                  key={opt.key || 'all'}
                  type="button"
                  className={`history-chip ${riskFilter === opt.key ? 'active' : ''}`}
                  onClick={() => {
                    setPage(1);
                    setRiskFilter(opt.key);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="history-toggle">
              <input
                type="checkbox"
                checked={encryptedOnly}
                onChange={(e) => {
                  setPage(1);
                  setEncryptedOnly(e.target.checked);
                }}
              />
              <span>Encrypted</span>
            </label>

            <label className="history-toggle">
              <input
                type="checkbox"
                checked={payloadOnly}
                onChange={(e) => {
                  setPage(1);
                  setPayloadOnly(e.target.checked);
                }}
              />
              <span>Payload stored</span>
            </label>

            <div className="history-seg" role="group" aria-label="OSINT view">
              <button
                type="button"
                className={`history-seg-btn ${osintView === 'timeline' ? 'active' : ''}`}
                onClick={() => setOsintView('timeline')}
              >
                Timeline
              </button>
              <button
                type="button"
                className={`history-seg-btn ${osintView === 'table' ? 'active' : ''}`}
                onClick={() => setOsintView('table')}
              >
                Table
              </button>
            </div>
          </div>
        )}

        <div className="history-row">
          <label className="history-date">
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="history-date">
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
            />
          </label>

          <div className="history-pagination">
            <button
              type="button"
              className="history-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <div className="history-page-info">
              Page {page} / {totalPages}
              <span className="history-page-range">
                {showingFrom}-{showingTo} of {tab === 'scans' ? (data?.total ?? 0) : (osintData?.total ?? 0)}
              </span>
            </div>
            <button
              type="button"
              className="history-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="history-error" role="alert">
          {error}
        </div>
      )}

      <section className="history-table-wrap" aria-label="History results">
        {tab === 'osint' && osintView === 'timeline' ? (
          <div className="history-timeline">
            {loading && (
              <div className="history-loading-inline" role="status" aria-live="polite">
                Updating…
              </div>
            )}
            {osintItems.length === 0 ? (
              loading ? (
                <div className="history-loading">Loading…</div>
              ) : (
                <div className="history-empty">No history found</div>
              )
            ) : (
              osintGroups.map(({ day, rows }) => {
                const label =
                  day === 'unknown'
                    ? 'Unknown date'
                    : new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                return (
                  <div className="history-timeline-day" key={day}>
                    <div className="history-timeline-day-label">{label}</div>
                    <div className="history-timeline-list" role="list">
                      {rows.map((row) => {
                        const dt = row.created_at ? new Date(row.created_at) : null;
                        const time = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                        const risk = formatRiskLabel(row.risk_level);
                        const tone = riskTone(row.risk_level);
                        return (
                          <button
                            key={row.id}
                            type="button"
                            className="history-timeline-item"
                            onClick={() => setSelected({ kind: 'osint', id: row.id })}
                            role="listitem"
                            aria-label={`OSINT ${row.module} ${row.target}`}
                          >
                            <div className="history-timeline-dot" aria-hidden="true" />
                            <div className="history-timeline-card">
                              <div className="history-timeline-top">
                                <div className="history-timeline-title">
                                  <span className="history-timeline-module">{row.module}</span>
                                  <span className="history-timeline-type">{row.investigation_type}</span>
                                </div>
                                <div className="history-timeline-time">{time}</div>
                              </div>
                              <div className="history-timeline-target" title={row.target}>
                                {row.target}
                              </div>
                              <div className="history-timeline-meta">
                                <span className={`history-pill ${tone}`}>{risk}</span>
                                <span className="history-pill subtle">v{row.result_version}</span>
                                <span className="history-pill subtle">{row.username || '—'}</span>
                                {row.encrypted && <span className="history-pill subtle">Encrypted</span>}
                                {row.payload_available && <span className="history-pill subtle">Payload</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className={`history-table ${tab === 'osint' ? 'osint' : ''}`}>
            {tab === 'scans' ? (
              <div className="history-thead">
                <div>Date</div>
                <div>Target</div>
                <div>Threat</div>
                <div>Result</div>
                <div>WAF</div>
                <div>Systems</div>
                <div>OSINT</div>
                <div />
              </div>
            ) : (
              <div className="history-thead">
                <div>Date</div>
                <div>Type</div>
                <div>Module</div>
                <div>Target</div>
                <div>User</div>
                <div>Version</div>
                <div />
              </div>
            )}

            {loading && (tab === 'scans' ? items.length > 0 : osintItems.length > 0) && (
              <div className="history-loading-inline" role="status" aria-live="polite">
                Updating…
              </div>
            )}

            {tab === 'scans' ? (
              items.length === 0 ? (
                loading ? (
                  <div className="history-loading">Loading…</div>
                ) : (
                  <div className="history-empty">No history found</div>
                )
              ) : (
                items.map((row) => (
                  <div key={row.id} className="history-tr">
                    <div className="history-cell">{row.scan_date ? new Date(row.scan_date).toLocaleString() : '—'}</div>
                    <div className="history-cell history-target" title={row.target}>
                      {row.target}
                    </div>
                    <div className="history-cell">{row.threat_level == null ? '—' : `${row.threat_level}/10`}</div>
                    <div className="history-cell">{row.has_snapshot ? 'Saved' : '—'}</div>
                    <div className="history-cell">{row.waf_name || (row.firewall_detected ? 'Detected' : '—')}</div>
                    <div className="history-cell">{row.systems_count}</div>
                    <div className="history-cell">{row.osint_count}</div>
                    <div className="history-cell history-actions">
                      <button type="button" className="history-action" onClick={() => setSelected({ kind: 'scan', id: row.id })}>
                        Details
                      </button>
                      <button
                        type="button"
                        className="history-action secondary"
                        onClick={() => onRunQuery?.(row.target)}
                        disabled={!onRunQuery}
                      >
                        Re-run
                      </button>
                      <button
                        type="button"
                        className="history-action danger"
                        onClick={() => {
                          openDeleteConfirm({ kind: 'scan', id: row.id, label: row.target });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : osintItems.length === 0 ? (
              loading ? (
                <div className="history-loading">Loading…</div>
              ) : (
                <div className="history-empty">No history found</div>
              )
            ) : (
              osintItems.map((row) => (
                <div key={row.id} className="history-tr">
                  <div className="history-cell">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</div>
                  <div className="history-cell">{row.investigation_type}</div>
                  <div className="history-cell">{row.module}</div>
                  <div className="history-cell history-target" title={row.target}>
                    {row.target}
                  </div>
                  <div className="history-cell">{row.username || '—'}</div>
                  <div className="history-cell">v{row.result_version}</div>
                  <div className="history-cell history-actions">
                    <button type="button" className="history-action" onClick={() => setSelected({ kind: 'osint', id: row.id })}>
                      Details
                    </button>
                    <button
                      type="button"
                      className="history-action danger"
                      onClick={() => {
                        openDeleteConfirm({
                          kind: 'osint',
                          id: row.id,
                          label: `${row.module} • ${row.target}`
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {selected != null && (
        <div className="history-drawer-overlay" role="dialog" aria-label="Details">
          <div className="history-drawer">
            <div className="history-drawer-header">
              <div className="history-drawer-title">
                {selected.kind === 'scan' ? `Scan #${selected.id}` : `OSINT #${selected.id}`}
              </div>
              <div className="history-drawer-actions">
                <button
                  type="button"
                  className="history-action danger"
                  onClick={() => {
                    if (!selected) return;
                    const label =
                      selected.kind === 'scan'
                        ? (detail?.scan?.target ? String(detail.scan.target) : undefined)
                        : detail?.module && detail?.target
                          ? `${String(detail.module)} • ${String(detail.target)}`
                          : undefined;
                    openDeleteConfirm({ kind: selected.kind, id: selected.id, label });
                  }}
                >
                  Delete
                </button>
              <button
                type="button"
                className="history-drawer-close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ×
              </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="history-drawer-body">Loading details…</div>
            ) : detailError ? (
              <div className="history-drawer-body history-error" role="alert">
                {detailError}
              </div>
            ) : !detail ? (
              <div className="history-drawer-body">No details available.</div>
            ) : (
              <div className="history-drawer-body">
                {selected.kind === 'scan' ? (
                  <>
                    <div className="history-kv">
                      <div className="k">Target</div>
                      <div className="v">{detail.scan?.target}</div>
                      <div className="k">Timestamp</div>
                      <div className="v">
                        {detail.scan?.scan_date ? new Date(detail.scan.scan_date).toLocaleString() : '—'}
                      </div>
                      <div className="k">Threat</div>
                      <div className="v">
                        {detail.aiAnalysis?.threat_level != null ? `${detail.aiAnalysis.threat_level}/10` : '—'}
                      </div>
                      <div className="k">WAF</div>
                      <div className="v">{detail.firewall?.waf_name || '—'}</div>
                    </div>

                    {detail.aiAnalysis?.summary && (
                      <div className="history-section">
                        <div className="history-section-title">Summary</div>
                        <div className="history-summary">{detail.aiAnalysis.summary}</div>
                      </div>
                    )}

                    <div className="history-section">
                      <div className="history-section-title">Scan Result</div>
                      <div className="history-unified-grid">
                        <div className="history-unified-block">
                          <div className="history-subtitle">Systems</div>
                          {Array.isArray(detail.systems) && detail.systems.length ? (
                            <>
                              <div className="history-list">
                                {(showAllSystems ? detail.systems : detail.systems.slice(0, 3)).map((s: any) => {
                                  const title = s?.subdomain || s?.ip || (s?.id != null ? `System #${s.id}` : 'System');
                                  const country = s?.location?.country || s?.location?.countryCode;
                                  const city = s?.location?.city;
                                  const place = [city, country].filter(Boolean).join(', ');
                                  const riskLevel = s?.risk?.level || '—';
                                  const riskScore = s?.risk?.score != null ? String(s.risk.score) : '—';
                                  const ports = Array.isArray(s?.ports) ? s.ports.map((p: any) => p?.port).filter(Boolean) : [];
                                  const portsText = ports.length ? `Ports: ${ports.slice(0, 6).join(', ')}${ports.length > 6 ? '…' : ''}` : 'Ports: —';
                                  return (
                                    <div className="history-list-item" key={String(s?.id ?? title)}>
                                      <div className="history-list-main">{title}</div>
                                      <div className="history-list-meta">
                                        {riskLevel} · {riskScore}
                                      </div>
                                      {(place || portsText) && (
                                        <div className="history-list-sub">
                                          {place ? `${place} · ` : ''}
                                          {portsText}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {detail.systems.length > 3 && (
                                <button
                                  className="history-link"
                                  type="button"
                                  onClick={() => setShowAllSystems((v) => !v)}
                                >
                                  {showAllSystems ? 'Show less' : `Show all (${detail.systems.length})`}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="history-small">No systems stored for this scan.</div>
                          )}
                        </div>

                        <div className="history-unified-block">
                          <div className="history-subtitle">OSINT</div>
                          {Array.isArray(detail.osintResults) && detail.osintResults.length ? (
                            <>
                              <div className="history-list">
                                {(showAllOsint ? detail.osintResults : detail.osintResults.slice(0, 4)).map((r: any, i: number) => {
                                  const mod = r?.module || 'Module';
                                  const risk = r?.risk_level || '—';
                                  const when = r?.created_at ? new Date(String(r.created_at)).toLocaleString() : '—';
                                  return (
                                    <div className="history-list-item" key={`${mod}-${i}`}>
                                      <div className="history-list-main">{mod}</div>
                                      <div className="history-list-meta">{risk}</div>
                                      <div className="history-list-sub">{when}</div>
                                    </div>
                                  );
                                })}
                              </div>
                              {detail.osintResults.length > 4 && (
                                <button className="history-link" type="button" onClick={() => setShowAllOsint((v) => !v)}>
                                  {showAllOsint ? 'Show less' : `Show all (${detail.osintResults.length})`}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="history-small">No OSINT results linked to this scan.</div>
                          )}
                        </div>
                      </div>

                      <div className="history-divider" />
                      {renderScanSnapshot(detail.scan?.page_content)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="history-kv">
                      <div className="k">Target</div>
                      <div className="v">{detail.target}</div>
                      <div className="k">Timestamp</div>
                      <div className="v">{detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</div>
                      <div className="k">Module</div>
                      <div className="v">{detail.module}</div>
                      <div className="k">Type</div>
                      <div className="v">{detail.investigation_type}</div>
                      <div className="k">User</div>
                      <div className="v">{detail.username || '—'}</div>
                      <div className="k">Risk</div>
                      <div className="v">
                        <span className={`history-pill ${riskTone(detail.risk_level)}`}>{formatRiskLabel(detail.risk_level)}</span>
                      </div>
                      <div className="k">Version</div>
                      <div className="v">v{detail.result_version}</div>
                      <div className="k">Integrity</div>
                      <div className="v">
                        {detail.payload_available
                          ? detail.integrityOk === true
                            ? 'OK'
                            : detail.integrityOk === false
                              ? 'Mismatch'
                              : '—'
                          : 'Not stored'}
                      </div>
                    </div>

                    {Array.isArray(detail.sources) && detail.sources.length > 0 && (
                      <div className="history-section">
                        <div className="history-section-title">Sources</div>
                        <div className="history-tags" role="list" aria-label="Sources">
                          {detail.sources.map((s: any, i: number) => (
                            <span className="history-tag" key={`${String(s)}-${i}`} role="listitem">
                              {String(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.error_message && (
                      <div className="history-section">
                        <div className="history-section-title">Error</div>
                        <div className="history-summary">{detail.error_message}</div>
                      </div>
                    )}

                    <div className="history-section">
                      <div className="history-section-title history-section-title-row">
                        <span>Payload</span>
                        {detail.payload_available && (
                          <div className="history-seg" role="group" aria-label="Payload view">
                            <button
                              type="button"
                              className={`history-seg-btn ${osintPayloadView === 'tree' ? 'active' : ''}`}
                              onClick={() => setOsintPayloadView('tree')}
                            >
                              Pretty
                            </button>
                            <button
                              type="button"
                              className={`history-seg-btn ${osintPayloadView === 'code' ? 'active' : ''}`}
                              onClick={() => setOsintPayloadView('code')}
                            >
                              Raw JSON
                            </button>
                          </div>
                        )}
                      </div>
                      {!detail.payload_available ? (
                        <div className="history-small">Payload not stored (encryption key missing or operation failed).</div>
                      ) : (
                        <div className="history-json-viewer">
                          <JsonViewer value={detail.payload} mode={osintPayloadView === 'code' ? 'code' : 'tree'} />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDelete &&
        createPortal(
          <div
            className="history-confirm-overlay"
            role="dialog"
            aria-label="Confirm delete"
            aria-modal="true"
            onMouseDown={(e) => {
              if (confirmBusy) return;
              if (e.target === e.currentTarget) setConfirmDelete(null);
            }}
          >
            <div className="history-confirm">
              <div className="history-confirm-title">Confirm deletion</div>
              <div className="history-confirm-body">
                <div className="history-confirm-text">
                  Delete this {confirmDelete.kind === 'scan' ? 'scan' : 'OSINT record'} permanently?
                </div>
                {confirmDelete.label && <div className="history-confirm-meta">{confirmDelete.label}</div>}
                <div className="history-confirm-warn">This action cannot be undone.</div>
              </div>
              <div className="history-confirm-actions">
                <button
                  type="button"
                  className="history-action secondary"
                  onClick={() => {
                    if (confirmBusy) return;
                    setConfirmDelete(null);
                  }}
                  disabled={confirmBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="history-action danger"
                  onClick={onConfirmDelete}
                  disabled={confirmBusy}
                  autoFocus
                >
                  {confirmBusy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

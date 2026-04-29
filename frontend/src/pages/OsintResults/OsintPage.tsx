import React, { useState, useCallback, useMemo } from 'react';
import './OsintPage.css';
import { addSearchHistory } from '../../services/searchHistory';
import JsonViewer from '../../components/JsonViewer';

interface OsintPageProps {
    onBack: () => void;
}

const PlatformCard = React.memo(({ r, target }: { r: any, target: string }) => (
    <div className="platform-card" data-status={r.status} role="listitem" tabIndex={0}>
        <div className="platform-info">
            <span className="status-icon" aria-hidden="true">
                {r.status === 'taken' ? '✅' : 
                 r.status === 'available' ? '❌' : 
                 r.status === 'rate-limited' ? '⚠️' : '❓'}
            </span>
            <span className="platform-name">{r.platform}</span>
        </div>
        <div className="platform-details">
            <span className="response-time" aria-label={`Response time: ${r.responseTime} milliseconds`}>{r.responseTime}ms</span>
            {r.status === 'taken' && (
                <a 
                    href={r.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="profile-link"
                    aria-label={`View ${r.platform} profile for ${target}`}
                >
                    View Profile ↗
                </a>
            )}
            {r.status === 'available' && <span className="status-text status-text--missing" role="status">Not Found</span>}
        </div>
    </div>
));

PlatformCard.displayName = 'PlatformCard';

const DorkingCard = React.memo(({ query }: { query: any }) => (
    <div className="dork-card">
        <div className="dork-info">
            <h4>{query.name}</h4>
            <p>{query.description}</p>
            <code className="dork-query">{query.query}</code>
        </div>
        <div className="dork-actions">
            <button
                type="button"
                className="dork-btn"
                onClick={() => navigator.clipboard.writeText(query.query).catch(() => {})}
                aria-label={`Copy dork query: ${query.name}`}
            >
                Copy
            </button>
            <a 
                href={query.google_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="dork-link"
                aria-label={`Open Google search for: ${query.name}`}
            >
                Launch ↗
            </a>
        </div>
    </div>
));

DorkingCard.displayName = 'DorkingCard';

const formatBool = (value: any) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'Unknown';
};

const PhoneResult = React.memo(({ data }: { data: any }) => {
    const e164 = typeof data?.e164 === 'string' ? data.e164 : null;
    const possible = data?.possible;
    const valid = data?.valid;
    const type = typeof data?.line_type === 'string' ? data.line_type : null;
    const country = typeof data?.country === 'string' ? data.country : null;
    const callingCode = typeof data?.calling_code === 'string' ? data.calling_code : null;
    const intl = typeof data?.format_international === 'string' ? data.format_international : null;
    const national = typeof data?.format_national === 'string' ? data.format_national : null;
    const carrier = typeof data?.carrier === 'string' ? data.carrier : null;
    const timeZones = Array.isArray(data?.time_zones) ? data.time_zones.filter((v: any) => typeof v === 'string') : [];
    const description = typeof data?.description === 'string' ? data.description : null;
    const whatsapp = data?.whatsapp_registered;
    const telegram = data?.telegram_registered;

    const pillClass = (v: any) => (v === true ? 'pill pill--ok' : v === false ? 'pill pill--bad' : 'pill');

    return (
        <div className="phone-result" aria-label="Phone investigation results">
            <div className="phone-result-grid">
                <section className="phone-card" aria-label="Phone number details">
                    <div className="phone-card-title">Number</div>
                    <div className="phone-kv">
                        <div className="k">E.164</div>
                        <div className="v">{e164 ?? '—'}</div>
                        <div className="k">International</div>
                        <div className="v">{intl ?? '—'}</div>
                        <div className="k">National</div>
                        <div className="v">{national ?? '—'}</div>
                    </div>
                </section>

                <section className="phone-card" aria-label="Validation results">
                    <div className="phone-card-title">Validation</div>
                    <div className="phone-kv">
                        <div className="k">Possible</div>
                        <div className="v">
                            <span className={pillClass(possible)}>{formatBool(possible)}</span>
                        </div>
                        <div className="k">Valid</div>
                        <div className="v">
                            <span className={pillClass(valid)}>{formatBool(valid)}</span>
                        </div>
                        <div className="k">Type</div>
                        <div className="v">{type ?? 'Unknown'}</div>
                    </div>
                </section>

                <section className="phone-card" aria-label="Region and calling code">
                    <div className="phone-card-title">Region</div>
                    <div className="phone-kv">
                        <div className="k">Country (ISO)</div>
                        <div className="v">{country ?? '—'}</div>
                        <div className="k">Calling Code</div>
                        <div className="v">{callingCode ? `+${callingCode}` : '—'}</div>
                        <div className="k">Carrier</div>
                        <div className="v">{carrier ?? '—'}</div>
                        <div className="k">Time Zones</div>
                        <div className="v">{timeZones.length ? timeZones.join(', ') : '—'}</div>
                        <div className="k">Description</div>
                        <div className="v">{description ?? '—'}</div>
                        <div className="k">WhatsApp</div>
                        <div className="v">{whatsapp == null ? 'Unknown (not checked)' : whatsapp ? 'Yes' : 'No'}</div>
                        <div className="k">Telegram</div>
                        <div className="v">{telegram == null ? 'Unknown (not checked)' : telegram ? 'Yes' : 'No'}</div>
                    </div>
                </section>

                <section className="phone-card" aria-label="Privacy note">
                    <div className="phone-card-title">Note</div>
                    <div className="phone-note">
                        Location, owner identity, and real-time tracking are not available from a phone number alone. This module focuses on safe validation and formatting.
                    </div>
                </section>
            </div>
        </div>
    );
});

PhoneResult.displayName = 'PhoneResult';

const LeakResult = React.memo(({ data }: { data: any }) => {
    const total = typeof data?.total_breaches === 'number' ? data.total_breaches : null;
    const latest = typeof data?.latest_breach === 'string' ? data.latest_breach : null;
    const pastebin = typeof data?.pastebin_hits === 'number' ? data.pastebin_hits : null;
    const exposed = Array.isArray(data?.exposed_data) ? data.exposed_data.filter((v: any) => typeof v === 'string') : [];
    const sources = Array.isArray(data?.sources) ? data.sources.filter((v: any) => typeof v === 'string') : [];

    return (
        <div className="leak-result" aria-label="Credential leak results">
            <div className="leak-grid">
                <section className="leak-card" aria-label="Leak summary">
                    <div className="leak-card-title">Summary</div>
                    <div className="leak-kpi-row">
                        <div className="leak-kpi">
                            <div className="leak-kpi-label">Total Breaches</div>
                            <div className="leak-kpi-value">{total ?? '—'}</div>
                        </div>
                        <div className="leak-kpi">
                            <div className="leak-kpi-label">Latest Breach</div>
                            <div className="leak-kpi-value">{latest ?? '—'}</div>
                        </div>
                        <div className="leak-kpi">
                            <div className="leak-kpi-label">Paste Hits</div>
                            <div className="leak-kpi-value">{pastebin ?? '—'}</div>
                        </div>
                    </div>
                </section>

                <section className="leak-card" aria-label="Exposed data types">
                    <div className="leak-card-title">Exposed Data</div>
                    {exposed.length ? (
                        <div className="leak-tags" role="list" aria-label="Exposed data tags">
                            {exposed.map((t: string) => (
                                <span className="leak-tag" role="listitem" key={t}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="leak-empty">No exposed fields reported.</div>
                    )}
                </section>

                <section className="leak-card" aria-label="Sources">
                    <div className="leak-card-title">Sources</div>
                    {sources.length ? (
                        <ul className="leak-list">
                            {sources.map((s: string) => (
                                <li key={s}>{s}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="leak-empty">No sources listed.</div>
                    )}
                </section>

                <section className="leak-card" aria-label="Safety note">
                    <div className="leak-card-title">Note</div>
                    <div className="leak-note">
                        This module reports breach indicators. It does not retrieve passwords in plaintext and should be used for defensive remediation (password resets, MFA, monitoring).
                    </div>
                </section>
            </div>
        </div>
    );
});

LeakResult.displayName = 'LeakResult';

const PhishingResult = React.memo(({ data }: { data: any }) => {
    const url = typeof data?.url === 'string' ? data.url : null;
    const score = typeof data?.phishing_score === 'number' ? data.phishing_score : null;
    const safeStatus = typeof data?.safe_browsing_status === 'string' ? data.safe_browsing_status : null;
    const recommendation = typeof data?.recommendation === 'string' ? data.recommendation : null;
    const indicators = Array.isArray(data?.indicators) ? data.indicators.filter((v: any) => typeof v === 'string') : [];

    const scoreValue = score == null ? null : Math.max(0, Math.min(100, score));
    const scoreLabel =
        scoreValue == null ? 'Unknown' : scoreValue >= 70 ? 'Critical' : scoreValue >= 40 ? 'High' : scoreValue >= 20 ? 'Medium' : 'Low';

    return (
        <div className="phish-result" aria-label="Phishing detection results">
            <div className="phish-grid">
                <section className="phish-card" aria-label="Phishing summary">
                    <div className="phish-card-title">Summary</div>
                    <div className="phish-kpi-row">
                        <div className="phish-kpi">
                            <div className="phish-kpi-label">Target</div>
                            <div className="phish-kpi-value phish-kpi-value--mono">{url ?? '—'}</div>
                        </div>
                        <div className="phish-kpi">
                            <div className="phish-kpi-label">Score</div>
                            <div className="phish-kpi-value">
                                {scoreValue == null ? '—' : `${scoreValue}/100`}
                                <span className="phish-kpi-pill" data-level={scoreLabel}>
                                    {scoreLabel}
                                </span>
                            </div>
                            <div className="phish-meter" role="img" aria-label="Phishing score meter">
                                <div className="phish-meter-fill" style={{ width: `${scoreValue ?? 0}%` }} data-level={scoreLabel} />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="phish-card" aria-label="Safety status">
                    <div className="phish-card-title">Safety</div>
                    <div className="phish-kv">
                        <div className="k">Safe browsing</div>
                        <div className="v">{safeStatus ?? '—'}</div>
                        <div className="k">Recommendation</div>
                        <div className="v">
                            <span className="phish-reco" data-level={scoreLabel}>
                                {recommendation ?? '—'}
                            </span>
                        </div>
                    </div>
                </section>

                <section className="phish-card" aria-label="Indicators list">
                    <div className="phish-card-title">Indicators</div>
                    {indicators.length ? (
                        <ul className="phish-list">
                            {indicators.map((t: string, i: number) => (
                                <li key={`${t}-${i}`}>{t}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="phish-empty">No indicators returned.</div>
                    )}
                </section>
            </div>
        </div>
    );
});

PhishingResult.displayName = 'PhishingResult';

const EmailValidationResult = React.memo(({ data }: { data: any }) => {
    const email = typeof data?.email === 'string' ? data.email : null;
    const domain = typeof data?.domain === 'string' ? data.domain : null;
    const validSyntax = data?.valid_syntax;
    const disposable = data?.is_disposable;
    const deliverable = typeof data?.deliverable === 'string' ? data.deliverable : null;
    const breachCount = typeof data?.breach_count === 'number' ? data.breach_count : null;
    const mxRecords = Array.isArray(data?.mx_records) ? data.mx_records.filter((v: any) => typeof v === 'string') : [];

    const deliverablePill =
        deliverable?.toLowerCase() === 'likely' ? 'pill pill--ok' : deliverable?.toLowerCase() === 'unlikely' ? 'pill pill--bad' : 'pill';
    const boolPill = (v: any) => (v === true ? 'pill pill--ok' : v === false ? 'pill pill--bad' : 'pill');

    return (
        <div className="email-result" aria-label="Email validation results">
            <div className="email-grid">
                <section className="email-card" aria-label="Email summary">
                    <div className="email-card-title">Summary</div>
                    <div className="email-kv">
                        <div className="k">Email</div>
                        <div className="v">{email ?? '—'}</div>
                        <div className="k">Domain</div>
                        <div className="v">{domain ?? '—'}</div>
                        <div className="k">Syntax</div>
                        <div className="v">
                            <span className={boolPill(validSyntax)}>{formatBool(validSyntax)}</span>
                        </div>
                        <div className="k">Disposable</div>
                        <div className="v">
                            <span className={boolPill(disposable)}>{formatBool(disposable)}</span>
                        </div>
                        <div className="k">Deliverable</div>
                        <div className="v">
                            <span className={deliverablePill}>{deliverable ?? 'Unknown'}</span>
                        </div>
                        <div className="k">Breach count</div>
                        <div className="v">{breachCount ?? '—'}</div>
                    </div>
                </section>

                <section className="email-card" aria-label="MX records">
                    <div className="email-card-title">MX Records</div>
                    {mxRecords.length ? (
                        <ul className="email-list">
                            {mxRecords.map((m: string, i: number) => (
                                <li key={`${m}-${i}`}>
                                    <code className="email-mx">{m}</code>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="email-empty">No MX records found.</div>
                    )}
                </section>

                <section className="email-card" aria-label="Note">
                    <div className="email-card-title">Note</div>
                    <div className="email-note">
                        This module validates format and domain mail exchange records. It does not verify mailbox ownership or attempt SMTP inbox probing.
                    </div>
                </section>
            </div>
        </div>
    );
});

EmailValidationResult.displayName = 'EmailValidationResult';

const OsintPage: React.FC<OsintPageProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('phishing');
    const [target, setTarget] = useState('');
    const [phoneCountryCode, setPhoneCountryCode] = useState('+60');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [resultView, setResultView] = useState<'pretty' | 'raw'>('pretty');
    const [customDorkName, setCustomDorkName] = useState('');
    const [customDorkQuery, setCustomDorkQuery] = useState('');
    const [customDorkDescription, setCustomDorkDescription] = useState('');
    const [customDorks, setCustomDorks] = useState<any[]>([]);

    const modules = useMemo(() => [
        { id: 'phishing', name: 'Phishing Detection', icon: '🎣' },
        { id: 'email', name: 'Email Validation', icon: '📧' },
        { id: 'phone', name: 'Phone Investigation', icon: '📱' },
        { id: 'social', name: 'Username Checker', icon: '🔍' },
        { id: 'leak', name: 'Credential Leak', icon: '🔓' },
        { id: 'dorking', name: 'Google Dorking', icon: '🔎' }
    ], []);

    const phoneCodes = useMemo(
        () => [
            { label: 'Malaysia (+60)', value: '+60' },
            { label: 'Singapore (+65)', value: '+65' },
            { label: 'Indonesia (+62)', value: '+62' },
            { label: 'Thailand (+66)', value: '+66' },
            { label: 'Philippines (+63)', value: '+63' },
            { label: 'Vietnam (+84)', value: '+84' },
            { label: 'India (+91)', value: '+91' },
            { label: 'United Kingdom (+44)', value: '+44' },
            { label: 'United States/Canada (+1)', value: '+1' }
        ],
        []
    );

    const exportResults = useCallback((format: 'json' | 'csv') => {
        if (!result) return;
        const data = result.data;
        let blob: Blob;
        let filename: string;

        if (format === 'json') {
            blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            filename = `osint_${activeTab}_${target}.json`;
        } else {
            // Simple CSV for AliasFinder results
            if (activeTab === 'social' && data.results) {
                const headers = 'Platform,Status,URL,ResponseTime(ms)\n';
                const rows = data.results.map((r: any) => `${r.platform},${r.status},${r.url},${r.responseTime}`).join('\n');
                blob = new Blob([headers + rows], { type: 'text/csv' });
            } else {
                blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
            }
            filename = `osint_${activeTab}_${target}.csv`;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }, [result, activeTab, target]);

    const targetForRequest = useMemo(() => {
        const raw = target.trim();
        if (!raw) return '';
        if (activeTab !== 'phone') return raw;

        const digits = raw.replace(/[^\d]/g, '');
        if (!digits) return '';

        if (raw.startsWith('+')) return `+${digits}`;

        const cc = String(phoneCountryCode || '').replace(/[^\d]/g, '');
        let national = digits.replace(/^0+/, '');
        if (!national) national = digits;
        return cc ? `+${cc}${national}` : `+${national}`;
    }, [activeTab, phoneCountryCode, target]);

    const handleScan = useCallback(async () => {
        if (!targetForRequest) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setResultView('pretty');

        try {
            addSearchHistory(targetForRequest);
            const moduleMap: Record<string, string> = {
                'phishing': 'phishing-detect',
                'email': 'email-validator',
                'phone': 'phone-investigator',
                'social': 'alias-finder',
                'leak': 'leak-check',
                'dorking': 'google-dorking'
            };

            const backendModule = moduleMap[activeTab];
            const token = localStorage.getItem('token');
            
            const response = await fetch(`/api/osint/${backendModule}?target=${encodeURIComponent(targetForRequest)}`, {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication expired. Please log in again.');
            }

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Scan failed');
            }

            const data = await response.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [activeTab, targetForRequest]);

    const appendDorkToken = useCallback((token: string) => {
        setCustomDorkQuery(prev => {
            const prefix = prev.trim().length > 0 ? prev.trimEnd() + ' ' : '';
            return prefix + token;
        });
    }, []);

    const addCustomDork = useCallback(() => {
        const query = customDorkQuery.trim();
        if (!query) return;
        const name = (customDorkName || 'Custom Dork').trim();
        const description = (customDorkDescription || 'User-defined search operator query.').trim();

        const item = {
            name,
            description,
            query,
            google_url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
        };

        setCustomDorks(prev => [item, ...prev]);
        setCustomDorkName('');
        setCustomDorkDescription('');
        setCustomDorkQuery('');
    }, [customDorkName, customDorkDescription, customDorkQuery]);

    const clearCustomDorks = useCallback(() => {
        setCustomDorks([]);
        setCustomDorkName('');
        setCustomDorkDescription('');
        setCustomDorkQuery('');
    }, []);

    const activeModule = useMemo(() => modules.find(m => m.id === activeTab), [modules, activeTab]);

    return (
        <div className="osint-page">
            <header className="osint-header">
                <button className="back-btn" onClick={onBack} type="button">← Back to Dashboard</button>
                <div className="osint-header-text">
                    <h1>OSINT Intelligence Gathering</h1>
                    <p className="osint-subtitle">Select a module, enter a target, and run analysis.</p>
                </div>
            </header>

            <div className="osint-container">
                <nav className="osint-sidebar">
                    {modules.map(m => (
                        <button 
                            key={m.id} 
                            className={`module-btn ${activeTab === m.id ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab(m.id);
                                setResult(null);
                                setError(null);
                                setTarget('');
                                setCustomDorks([]);
                                setCustomDorkName('');
                                setCustomDorkDescription('');
                                setCustomDorkQuery('');
                            }}
                        >
                            <span className="icon">{m.icon}</span>
                            {m.name}
                        </button>
                    ))}
                </nav>

                <main className="osint-content" role="main" aria-label="OSINT Module Content">
                    <div className="input-section">
                        <h2>{activeModule?.name}</h2>
                        <div className={`search-box ${activeTab === 'phone' ? 'search-box--phone' : ''}`}>
                            {activeTab === 'phone' && (
                                <label className="phone-cc" aria-label="Country calling code">
                                    <span className="sr-only">Country code</span>
                                    <select
                                        className="phone-cc-select"
                                        value={phoneCountryCode}
                                        onChange={(e) => setPhoneCountryCode(e.target.value)}
                                        aria-label="Select country calling code"
                                    >
                                        {phoneCodes.map((c) => (
                                            <option key={c.value} value={c.value}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <input 
                                type="text" 
                                aria-label={`Target for ${activeModule?.name || activeTab}`}
                                placeholder={
                                    activeTab === 'phone'
                                        ? 'Enter phone number (e.g., 123456789 or +60123456789)'
                                        : `Enter target for ${activeModule?.name || activeTab}...`
                                }
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                            />
                            <button 
                                onClick={handleScan} 
                                disabled={loading}
                                aria-busy={loading}
                            >
                                {loading ? 'Scanning...' : 'Analyze'}
                            </button>
                        </div>
                        {activeTab === 'phone' && targetForRequest && (
                            <div className="phone-preview" role="note" aria-label="Phone number preview">
                                Sending as: <span className="phone-preview-num">{targetForRequest}</span>
                            </div>
                        )}
                    </div>

                    {activeTab === 'dorking' && (
                        <section className="dork-builder" aria-label="Custom Dork Builder">
                            <div className="dork-builder-header">
                                <h3>Custom Dork Builder</h3>
                                <div className="dork-builder-actions">
                                    <button
                                        type="button"
                                        className="dork-builder-btn"
                                        onClick={() => appendDorkToken(`site:${target.trim() || 'example.com'}`)}
                                        disabled={!target.trim()}
                                    >
                                        Insert site:target
                                    </button>
                                    <button
                                        type="button"
                                        className="dork-builder-btn danger"
                                        onClick={clearCustomDorks}
                                        disabled={customDorks.length === 0 && !customDorkQuery && !customDorkName && !customDorkDescription}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="dork-builder-grid">
                                <label className="dork-field">
                                    <span>Label</span>
                                    <input
                                        type="text"
                                        value={customDorkName}
                                        onChange={(e) => setCustomDorkName(e.target.value)}
                                        placeholder="e.g., Exposed Backups"
                                    />
                                </label>
                                <label className="dork-field">
                                    <span>Description</span>
                                    <input
                                        type="text"
                                        value={customDorkDescription}
                                        onChange={(e) => setCustomDorkDescription(e.target.value)}
                                        placeholder="What this dork is searching for"
                                    />
                                </label>
                                <label className="dork-field full">
                                    <span>Query</span>
                                    <input
                                        type="text"
                                        value={customDorkQuery}
                                        onChange={(e) => setCustomDorkQuery(e.target.value)}
                                        placeholder="e.g., site:example.com ext:sql | inurl:backup"
                                        onKeyDown={(e) => e.key === 'Enter' && addCustomDork()}
                                    />
                                </label>
                            </div>

                            <div className="dork-token-row" role="group" aria-label="Quick Insert Tokens">
                                <button type="button" className="token" onClick={() => appendDorkToken('intitle:')}>intitle:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('inurl:')}>inurl:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('filetype:')}>filetype:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('ext:')}>ext:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('""')}>""</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('OR')}>OR</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('-')}>-</button>
                            </div>

                            <div className="dork-builder-submit">
                                <button
                                    type="button"
                                    className="dork-builder-primary"
                                    onClick={addCustomDork}
                                    disabled={!customDorkQuery.trim()}
                                >
                                    Add Custom Dork
                                </button>
                            </div>

                            {customDorks.length > 0 && (
                                <div className="dorking-list" role="list" aria-label="Custom Dorks">
                                    {customDorks.map((q, i) => (
                                        <DorkingCard key={`custom-${i}`} query={q} />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {error && <div className="error-message" role="alert">{error}</div>}

                    {result && (
                        <div className="result-display" aria-live="polite">
                            <div className="result-header-row">
                                <div className="risk-badge" data-risk={result.risk} role="status">
                                    Risk Level: {result.risk}
                                </div>
                                <div className="result-view-toggle" role="group" aria-label="Result view mode">
                                    <button
                                        type="button"
                                        className={`result-view-btn ${resultView === 'pretty' ? 'active' : ''}`}
                                        aria-pressed={resultView === 'pretty'}
                                        onClick={() => setResultView('pretty')}
                                    >
                                        Pretty
                                    </button>
                                    <button
                                        type="button"
                                        className={`result-view-btn ${resultView === 'raw' ? 'active' : ''}`}
                                        aria-pressed={resultView === 'raw'}
                                        onClick={() => setResultView('raw')}
                                    >
                                        Raw JSON
                                    </button>
                                </div>
                                <div className="export-actions">
                                    <button onClick={() => exportResults('json')} className="export-btn" aria-label="Download results as JSON">Download JSON</button>
                                    <button onClick={() => exportResults('csv')} className="export-btn" aria-label="Download results as CSV">Download CSV</button>
                                </div>
                            </div>
                            
                            {resultView === 'raw' ? (
                                <JsonViewer value={result.data} mode="code" />
                            ) : (
                                <>
                                    {activeTab === 'social' && result.data.results ? (
                                        <div className="username-grid" role="list" aria-label="Username platform results">
                                            {result.data.results.map((r: any) => (
                                                <PlatformCard key={r.platform} r={r} target={target} />
                                            ))}
                                        </div>
                                    ) : activeTab === 'dorking' && result.data.queries ? (
                                        <div className="dorking-list" role="list" aria-label="Dorking queries">
                                            {result.data.queries.map((q: any, i: number) => (
                                                <DorkingCard key={i} query={q} />
                                            ))}
                                            <div className="dorking-footer">
                                                <p>Remediation: {result.data.remediation}</p>
                                            </div>
                                        </div>
                                    ) : activeTab === 'phone' ? (
                                        <div className="osint-phone-pretty">
                                            <PhoneResult data={result.data} />
                                        </div>
                                    ) : activeTab === 'phishing' ? (
                                        <div className="osint-phish-pretty">
                                            <PhishingResult data={result.data} />
                                        </div>
                                    ) : activeTab === 'email' ? (
                                        <div className="osint-email-pretty">
                                            <EmailValidationResult data={result.data} />
                                        </div>
                                    ) : activeTab === 'leak' ? (
                                        <div className="osint-leak-pretty">
                                            <LeakResult data={result.data} />
                                        </div>
                                    ) : (
                                        <JsonViewer value={result.data} mode="tree" />
                                    )}
                                    {(activeTab === 'social' ||
                                        activeTab === 'dorking' ||
                                        activeTab === 'phone' ||
                                        activeTab === 'leak' ||
                                        activeTab === 'phishing' ||
                                        activeTab === 'email') && (
                                        <div className="osint-json-secondary">
                                            <div className="osint-json-secondary-title">Full JSON</div>
                                            <JsonViewer value={result.data} mode="tree" />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default OsintPage;

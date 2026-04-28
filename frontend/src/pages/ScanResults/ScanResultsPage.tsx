import React, { useEffect, useState, useCallback } from 'react';
import InfoCard from '../../components/InfoCard';
import { OsintCard } from '../../components/OsintCard';
import ScanReveal from '../../components/ScanReveal';
import ScanningAnimation from '../../components/ScanningAnimation';
import SecurityReport from '../../components/SecurityReport';
import type { InfoCardData, KeyValueItem, ScanSection, AiAnalysis } from '../../types';
import './ScanResultsPage.css';

interface ScanResultsPageProps {
    target?: string;
    onBack?: () => void;
    onCancelBack?: () => void;
}

const ScanResultsPage: React.FC<ScanResultsPageProps> = ({ target, onBack, onCancelBack }) => {
    const [scanData, setScanData] = useState<ScanSection[]>([]);
    const [scanId, setScanId] = useState<number | undefined>(undefined);
    const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const hasTarget = typeof target === 'string' && target.trim().length > 0;
    const displayError = hasTarget ? error : 'No target provided.';
    const displayLoading = hasTarget ? loading : false;

    const transformData = useCallback((data: any): ScanSection[] => {
        try {
            const systems = Array.isArray(data.systems) ? data.systems : [];
            const mainSystem = systems[0] || {}; // Take the first system as primary for Host Info
            const location = mainSystem.location || {};
            const firewall = data.firewall || {};
            
            // Host & Infrastructure
            const hostSection: ScanSection = {
                id: 'host-infrastructure',
                title: 'Host & Infrastructure',
                cards: [
                    {
                        id: 'server-location',
                        title: 'Server Location',
                        type: 'kv-list',
                        delay: 0.1,
                        data: [
                            { label: 'IP Address', value: location.ip || mainSystem.ip || 'Not Resolved' },
                            { label: 'City', value: location.city || 'Unknown City' },
                            { label: 'Country', value: location.country ? `${location.country} ${location.countryCode || ''}` : 'Unknown Country' },
                            { label: 'ISP', value: location.isp || location.org || 'Unknown ISP' },
                        ],
                        customContentId: 'map-visualization'
                    },
                    {
                        id: 'firewall-waf',
                        title: 'Firewall / WAF',
                        type: 'kv-list',
                        delay: 0.2,
                        data: [
                            { 
                                label: 'Detected', 
                                value: firewall.firewall ? 'Yes' : 'No', 
                                color: firewall.firewall ? 'var(--accent-success)' : undefined 
                            },
                            { label: 'WAF', value: firewall.waf || 'None' },
                        ]
                    }
                ]
            };

            if (mainSystem.ports && Array.isArray(mainSystem.ports.results)) {
                const openPorts = mainSystem.ports.results
                    .filter((p: any) => p && p.status === 'open')
                    .map((p: any) => ({ label: `${p.port} (${p.service})` }));
                
                if (openPorts.length > 0) {
                    hostSection.cards.push({
                        id: 'open-ports',
                        title: 'Open Ports',
                        type: 'tags',
                        delay: 0.3,
                        data: openPorts
                    });
                }
            }

            // Domain & DNS
            const dnsInfo = data.dns || {}; 

            // 1. DNS Records
            const dnsRecordsData: KeyValueItem[] = [];
            if (Array.isArray(dnsInfo.a) && dnsInfo.a.length > 0) {
                dnsRecordsData.push({ label: 'A', value: `${dnsInfo.a.length} Records` });
            }
            if (Array.isArray(dnsInfo.aaaa) && dnsInfo.aaaa.length > 0) {
                dnsRecordsData.push({ label: 'AAAA', value: `${dnsInfo.aaaa.length} Records` });
            }
            if (Array.isArray(dnsInfo.mx) && dnsInfo.mx.length > 0) {
                dnsRecordsData.push({ label: 'MX', value: `${dnsInfo.mx.length} Records` });
            }
            if (Array.isArray(dnsInfo.ns) && dnsInfo.ns.length > 0) {
                dnsRecordsData.push({ label: 'NS', value: `${dnsInfo.ns.length} Records` });
            }
            if (Array.isArray(dnsInfo.txt) && dnsInfo.txt.length > 0) {
                dnsRecordsData.push({ label: 'TXT', value: `${dnsInfo.txt.length} Records` });
            }
            if (dnsRecordsData.length === 0) {
                dnsRecordsData.push({ label: 'Records', value: 'Not Detected' });
            }

            // 2. DNS Servers
            const dnsServersData: KeyValueItem[] = [];
            if (Array.isArray(dnsInfo.ns) && dnsInfo.ns.length > 0) {
                dnsInfo.ns.slice(0, 3).forEach((ns: any, i: number) => {
                    dnsServersData.push({ label: `NS ${i+1}`, value: ns.host || 'Unknown' });
                });
            } else {
                 dnsServersData.push({ label: 'Nameservers', value: 'Not Detected' });
            }
            dnsServersData.push({ label: 'DNSSEC', value: 'Not Detected' });

            const domainCards: InfoCardData[] = [
                 { id: 'dns-records', title: 'DNS Records', type: 'kv-list', delay: 0.2, data: dnsRecordsData },
                 { id: 'dns-servers', title: 'DNS Servers', type: 'kv-list', delay: 0.2, data: dnsServersData }
            ];

            if (systems.length > 0) {
                 const subLabels = systems
                    .filter((s: any) => s && s.subdomain)
                    .map((s: any) => ({ label: s.subdomain }))
                    .slice(0, 15);
                 
                 if (subLabels.length > 0) {
                     domainCards.push({
                        id: 'sub-domain',
                        title: `Subdomains (${systems.length})`,
                        type: 'tags',
                        delay: 0.3,
                        data: subLabels
                     });
                 }
            }

            const domainSection: ScanSection = { id: 'domain-dns', title: 'Domain & DNS', cards: domainCards };

            // Web & Security
            const sslInfo = data.ssl || {};
            const headers = mainSystem.headers?.headers || {};
            const security = mainSystem.headers?.security || {};
            
            const sslCardData: KeyValueItem[] = [
                { label: 'Issuer', value: sslInfo.issuer?.O || 'Not Detected' },
                { label: 'Common Name', value: sslInfo.subject?.CN || 'Not Detected' },
                { label: 'Valid From', value: sslInfo.validForm ? new Date(sslInfo.validForm).toLocaleDateString() : 'Not Detected' },
                { label: 'Expiry Date', value: sslInfo.validTo ? new Date(sslInfo.validTo).toLocaleDateString() : 'Not Detected' },
                { 
                    label: 'Status', 
                    value: sslInfo.validTo && new Date(sslInfo.validTo) > new Date() ? 'Valid' : 'Expired/Invalid',
                    color: sslInfo.validTo && new Date(sslInfo.validTo) > new Date() ? 'var(--accent-success)' : 'var(--accent-danger)'
                }
            ];

            const securityHeadersData: KeyValueItem[] = [
                { label: 'Content-Security-Policy', value: security.csp ? 'Present' : 'Missing', color: security.csp ? 'var(--accent-success)' : undefined },
                { label: 'Strict-Transport-Security', value: security.hsts ? 'Present' : 'Missing', color: security.hsts ? 'var(--accent-success)' : undefined },
                { label: 'X-Frame-Options', value: security.xFrameOptions || 'Missing' },
                { label: 'X-Content-Type-Options', value: security.xContentTypeOptions || 'Missing' },
                { label: 'Referrer-Policy', value: security.referrerPolicy || 'Missing' }
            ];

            const cookieHeader = headers['set-cookie'];
            const cookiesData: KeyValueItem[] = [];
            
            if (cookieHeader) {
                const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
                cookies.filter(c => typeof c === 'string').slice(0, 4).forEach((c: string) => {
                    const name = c.split('=')[0];
                    const secure = c.toLowerCase().includes('secure') ? 'Yes' : 'No';
                    const httpOnly = c.toLowerCase().includes('httponly') ? 'Yes' : 'No';
                    cookiesData.push({ label: name, value: `Secure: ${secure}, HttpOnly: ${httpOnly}` });
                });
            }
            if (cookiesData.length === 0) {
                cookiesData.push({ label: 'Cookies', value: 'None Detected' });
            }

            const webSection: ScanSection = {
                id: 'web-security',
                title: 'Web & Security',
                cards: [
                    { id: 'ssl-cert', title: 'SSL Certificate', type: 'kv-list', delay: 0.1, data: sslCardData },
                    { id: 'security-headers', title: 'HTTP Security Headers', type: 'kv-list', delay: 0.2, data: securityHeadersData },
                    { id: 'cookies', title: 'Cookies', type: 'kv-list', delay: 0.3, data: cookiesData }
                ]
            };

            const threatSection: ScanSection = {
                id: 'threat-reputation',
                title: 'Threat & Reputation',
                cards: [
                    { id: 'blocklists', title: 'Blocklists', type: 'kv-list', delay: 0.1, data: [{ label: 'Status', value: 'Clean (Mock)' }] }
                ]
            };

            // Governance
            const whoisData = data.whois || {};
            const crawlRules = data.crawlRules || {};
            const securityTxt = data.securityTxt || {};

            const governanceSection: ScanSection = {
                id: 'governance',
                title: 'Governance & Discovery',
                cards: [
                    {
                        id: 'whois',
                        title: 'Domain WHOIS',
                        type: 'kv-list',
                        delay: 0.1,
                        data: [
                            { label: 'Registrar', value: whoisData.registrar || 'Not Detected' },
                            { label: 'Registered', value: whoisData.registeredDate || 'Not Detected' },
                            { label: 'Expiry', value: whoisData.expiryDate || 'Not Detected' },
                            { label: 'Updated', value: whoisData.updatedDate || 'Not Detected' },
                            { label: 'Status', value: whoisData.status || 'Not Detected' }
                        ]
                    },
                    {
                        id: 'crawl-rules',
                        title: 'Crawl Rules',
                        type: 'kv-list',
                        delay: 0.2,
                        data: [
                            { label: 'robots.txt', value: crawlRules.robotsTxt ? 'Present' : 'Missing' },
                            { label: 'Allowed Paths', value: Array.isArray(crawlRules.allowed) && crawlRules.allowed.length > 0 ? `${crawlRules.allowed.length} Rules` : 'None' },
                            { label: 'Disallowed Paths', value: Array.isArray(crawlRules.disallowed) && crawlRules.disallowed.length > 0 ? `${crawlRules.disallowed.length} Rules` : 'None' },
                            { label: 'Sitemaps', value: Array.isArray(crawlRules.sitemaps) && crawlRules.sitemaps.length > 0 ? `${crawlRules.sitemaps.length} Found` : 'None' }
                        ]
                    },
                    {
                        id: 'security-txt',
                        title: 'Security.txt',
                        type: 'kv-list',
                        delay: 0.3,
                        data: [
                            { label: 'File Detected', value: securityTxt.present ? 'Yes' : 'No', color: securityTxt.present ? 'var(--accent-success)' : undefined },
                            { label: 'Contact', value: securityTxt.contact || 'Not Detected' },
                            { label: 'Encryption', value: securityTxt.encryption || 'Not Detected' },
                            { label: 'Policy', value: securityTxt.policy || 'Not Detected' }
                        ]
                    }
                ]
            };
            
            // Metadata
            const socialTags = data.socialTags || {};
            const twitterSiteRaw = typeof socialTags.twitterSite === 'string' ? socialTags.twitterSite.trim() : '';
            const twitterHandle = twitterSiteRaw.startsWith('@') ? twitterSiteRaw.slice(1) : twitterSiteRaw;
            const twitterHref = twitterHandle
                ? (twitterHandle.startsWith('http') ? twitterHandle : `https://twitter.com/${encodeURIComponent(twitterHandle)}`)
                : '';
             const metadataSection: ScanSection = {
                id: 'metadata',
                title: 'Metadata',
                cards: [
                    {
                        id: 'social-tags',
                        title: 'Social Tags',
                        type: 'kv-list',
                        delay: 0.1,
                        data: [
                            { label: 'OG Title', value: socialTags.ogTitle || 'Not Detected' },
                            { label: 'OG Description', value: socialTags.ogDescription ? (socialTags.ogDescription.length > 50 ? socialTags.ogDescription.substring(0, 50) + '...' : socialTags.ogDescription) : 'Not Detected' },
                            { label: 'Twitter Card', value: socialTags.twitterCard || 'Not Detected' },
                            { label: 'Twitter Site', value: twitterSiteRaw || 'Not Detected', href: twitterSiteRaw ? twitterHref : undefined },
                            { label: 'Preview Image', value: socialTags.image ? 'Present' : 'Not Detected' }
                        ]
                    }
                ]
             };

            return [hostSection, domainSection, webSection, governanceSection, metadataSection, threatSection];
        } catch (e) {
            console.error('Data transformation failed:', e);
            return [];
        }
    }, []);

    useEffect(() => {
        if (!target) return;

        let cancelled = false;
        let pollTimer: any = null;

        const getToken = () => localStorage.getItem('token') || '';

        const startJob = async () => {
            setLoading(true);
            setError(null);
            setAiAnalysis(null);
            setScanData([]);
            setScanId(undefined);
            setJobId(null);
            setCancelling(false);

            const response = await fetch('/api/recon/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ target })
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                throw new Error("Authentication session expired. Please login again.");
            }

            if (!response.ok) {
                let message = `Scan failed: ${response.statusText}`;
                try {
                    const body = await response.json();
                    if (body?.error && typeof body.error === 'string') message = `Scan failed: ${body.error}`;
                    if (body?.message && typeof body.message === 'string') message = `Scan failed: ${body.message}`;
                    if (Array.isArray(body?.details) && body.details.length) {
                        message = `${message} (${body.details.join(', ')})`;
                    }
                    } catch (e) {
                        void e;
                }
                throw new Error(message);
            }

            const data = await response.json();
            if (cancelled) return;

            const newJobId = data.jobId as string;
            setJobId(newJobId);

            const poll = async () => {
                const statusRes = await fetch(`/api/recon/status/${encodeURIComponent(newJobId)}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache',
                        'Authorization': `Bearer ${getToken()}`
                    }
                });

                if (statusRes.status === 401 || statusRes.status === 403) {
                    localStorage.removeItem('token');
                    throw new Error("Authentication session expired. Please login again.");
                }

                if (statusRes.status === 429) {
                    const retryAfterHeader = statusRes.headers.get('retry-after');
                    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
                    const delayMs = Number.isFinite(retryAfterSeconds) ? Math.max(1000, retryAfterSeconds * 1000) : 5000;
                    if (!cancelled) {
                        setError(`Scan throttled (HTTP 429). Retrying in ${Math.ceil(delayMs / 1000)}s…`);
                    }
                    if (pollTimer) clearTimeout(pollTimer);
                    pollTimer = setTimeout(() => {
                        poll().catch((e) => {
                            if (!cancelled) {
                                setError(e?.message || 'An unexpected error occurred.');
                                setLoading(false);
                            }
                        });
                    }, delayMs);
                    return;
                }

                if (!statusRes.ok) {
                    throw new Error(`Scan failed: ${statusRes.statusText}`);
                }

                const statusData = await statusRes.json();
                if (cancelled) return;

                const status = statusData.status as string;

                if (status === 'complete') {
                    if (pollTimer) clearInterval(pollTimer);
                    const rawData = statusData;

                    if (rawData.aiAnalysis) {
                        setAiAnalysis(rawData.aiAnalysis);
                    } else if (rawData.ai_analysis) {
                        setAiAnalysis(rawData.ai_analysis);
                    }

                    if (rawData.scan_id) {
                        setScanId(rawData.scan_id);
                    }

                    const mappedData = transformData(rawData);
                    setScanData(mappedData);
                    setLoading(false);

                    const hasSocialTags =
                        rawData?.socialTags &&
                        (rawData.socialTags.ogTitle || rawData.socialTags.ogDescription || rawData.socialTags.twitterCard || rawData.socialTags.image);

                    if (!hasSocialTags) {
                        try {
                            const tagRes = await fetch(`/api/social-tags?target=${encodeURIComponent(target || '')}`, {
                                headers: {
                                    'Authorization': `Bearer ${getToken()}`
                                }
                            });
                            if (tagRes.ok) {
                                const tagJson = await tagRes.json();
                                if (tagJson?.socialTags) {
                                    const remapped = transformData({ ...rawData, socialTags: tagJson.socialTags });
                                    setScanData(remapped);
                                }
                            }
                        } catch (e) {
                            void e;
                        }
                    }
                    return;
                }

                if (status === 'cancelled') {
                    if (pollTimer) clearInterval(pollTimer);
                    setLoading(false);
                    setCancelling(false);
                    (onCancelBack || onBack)?.();
                    return;
                }

                if (status === 'failed') {
                    if (pollTimer) clearTimeout(pollTimer);
                    const msg = statusData.error ? `Scan failed: ${statusData.error}` : 'Scan failed: Internal Server Error';
                    setError(msg);
                    setLoading(false);
                    setCancelling(false);
                    return;
                }

                if (pollTimer) clearTimeout(pollTimer);
                pollTimer = setTimeout(() => {
                    poll().catch((e) => {
                        if (!cancelled) {
                            setError(e?.message || 'An unexpected error occurred.');
                            setLoading(false);
                        }
                    });
                }, 1500);
            };

            await poll();
        };

        startJob().catch((err: any) => {
            console.error("Scan error:", err);
            if (!cancelled) {
                setError(err.message || "An unexpected error occurred.");
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
            if (pollTimer) clearTimeout(pollTimer);
        };
    }, [target, transformData]);

    const cancelScan = async () => {
        if (!jobId) return;
        const token = localStorage.getItem('token') || '';
        setCancelling(true);
        try {
            console.info('Scan cancellation requested', { jobId, target });
            await fetch(`/api/recon/cancel/${encodeURIComponent(jobId)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            (onCancelBack || onBack)?.();
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Cancellation failed';
            setError(message);
            setCancelling(false);
        }
    };


    return (
        <div className="scan-results-page">
            <header className="results-header">
                <button onClick={onBack} className="back-button">← Back</button>
                <h1 className={`target-title ${(target || '').length > 80 ? 'target-title--long' : ''}`}>
                    Target: <span className={`highlight ${(target || '').length > 80 ? 'highlight--long' : ''}`}>{target}</span>
                </h1>
                <div className="scan-status">
                    <span className={`status-dot ${displayLoading ? 'scanning' : 'complete'}`}></span>
                    {displayLoading ? 'SCANNING' : 'COMPLETE'}
                </div>
            </header>

            {displayError ? (
                <div className="error-message">
                    <h3>Scan Failed</h3>
                    <p>{displayError}</p>
                    <button onClick={onBack}>Try Again</button>
                </div>
            ) : (
                <>
                    {/* AI Security Report */}
                    <div className="mb-8">
                         <SecurityReport analysis={aiAnalysis} loading={displayLoading} meta={{ target: target || undefined, scanId }} />
                    </div>

                    {displayLoading ? (
                        <ScanningAnimation target={target || "Unknown Target"} onCancel={cancelScan} cancelling={cancelling} />
                    ) : (
                        <div className="scan-results-container">
                            {/* OSINT Section */}
                            <section className="scan-section">
                                <h2 className="section-title">OSINT Intelligence</h2>
                                <div className="cards-grid">
                                    <ScanReveal delay={0.1}>
                                        <OsintCard module="asset-radar" target={target || ''} title="AssetRadar" icon="📡" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.2}>
                                        <OsintCard module="alias-finder" target={target || ''} title="AliasFinder" icon="🕵️" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.3}>
                                        <OsintCard module="leak-check" target={target || ''} title="LeakCheck" icon="💧" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.4}>
                                        <OsintCard module="geo-spy" target={target || ''} title="GeoSpy" icon="🌍" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.5}>
                                        <OsintCard module="code-hunter" target={target || ''} title="CodeHunter" icon="💻" scanId={scanId} />
                                    </ScanReveal>
                                </div>
                            </section>

                            {scanData.map((section) => (
                                <section key={section.id} className="scan-section">
                                    <h2 className="section-title">{section.title}</h2>
                                    <div className="cards-grid">
                                        {section.cards.map((card, index) => (
                                            <ScanReveal key={card.id} delay={index * 0.1}>
                                                <InfoCard 
                                                    title={card.title} 
                                                    type={card.type} 
                                                    data={card.data}
                                                    customContentId={card.customContentId}
                                                />
                                            </ScanReveal>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ScanResultsPage;

import React, { useEffect, useState } from 'react';
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
}

const ScanResultsPage: React.FC<ScanResultsPageProps> = ({ target, onBack }) => {
    const [scanData, setScanData] = useState<ScanSection[]>([]);
    const [scanId, setScanId] = useState<number | undefined>(undefined);
    const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!target) {
            setError("No target provided.");
            setLoading(false);
            return;
        }

        // Normalize target for consistency with backend
        const normalizeTarget = (t: string) => {
            try {
                let hostname = t.trim();
                // Remove protocol
                if (hostname.match(/^[a-zA-Z]+:\/\//)) {
                    const parsed = new URL(hostname);
                    hostname = parsed.hostname;
                } else {
                    hostname = hostname.split('/')[0].split('?')[0];
                }
                return hostname.toLowerCase();
            } catch (e) {
                return t.trim().toLowerCase();
            }
        };

        const normalizedTarget = normalizeTarget(target);

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setAiAnalysis(null);
            try {
                // Ensure fresh data by appending timestamp or using cache: 'no-store'
                const response = await fetch(`/api/recon?target=${encodeURIComponent(normalizedTarget)}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Scan failed: ${response.statusText}`);
                }

                const rawData = await response.json();
                console.log('Raw Scan Data:', rawData); // Debug log

                // Validation: Ensure the returned data matches the requested target
                if (rawData.target && rawData.target !== normalizedTarget) {
                     // Warn but allow if it's a close match or sub-match? 
                     // For now, strict match on normalized target is safe.
                    console.warn(`Target mismatch warning: requested ${normalizedTarget}, got ${rawData.target}`);
                    // throw new Error("Data mismatch: Received results for a different target.");
                }

                // Set AI Analysis
                if (rawData.aiAnalysis) {
                    setAiAnalysis(rawData.aiAnalysis);
                } else if (rawData.ai_analysis) { // Handle potential case mismatch
                    setAiAnalysis(rawData.ai_analysis);
                }

                if (rawData.scan_id) {
                    setScanId(rawData.scan_id);
                }

                const mappedData = transformData(rawData);
                setScanData(mappedData);
            } catch (err: any) {
                console.error("Scan error:", err);
                setError(err.message || "An unexpected error occurred.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [target]);

    const transformData = (data: any): ScanSection[] => {
        // Safe access helper
        const systems = data.systems || [];
        const mainSystem = systems[0] || {}; // Take the first system as primary for Host Info
        const location = mainSystem.location || {};
        const firewall = data.firewall || {};
        
        const isResolved = systems.length > 0;
        const lookupStatus = isResolved ? (location.ip ? 'Resolved' : 'No IP') : 'Lookup Failed';

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

        // Add ports if available
        if (mainSystem.ports && mainSystem.ports.results) {
            const openPorts = mainSystem.ports.results
                .filter((p: any) => p.status === 'open')
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
        const domainData = data.domain || {}; // Usually not in reconPipeline output, check this
        // In reconPipeline, dns is at root level or in systems?
        // reconPipeline returns: { dns: dnsMain, ... }
        const dnsInfo = data.dns || {}; 
        const whois = data.whois || {};

        // 1. DNS Records
        const dnsRecordsData: KeyValueItem[] = [];
        if (dnsInfo.a && dnsInfo.a.length > 0) {
            dnsRecordsData.push({ label: 'A', value: `${dnsInfo.a.length} Records` });
        }
        if (dnsInfo.aaaa && dnsInfo.aaaa.length > 0) {
            dnsRecordsData.push({ label: 'AAAA', value: `${dnsInfo.aaaa.length} Records` });
        }
        if (dnsInfo.mx && dnsInfo.mx.length > 0) {
            dnsRecordsData.push({ label: 'MX', value: `${dnsInfo.mx.length} Records` });
        }
        if (dnsInfo.ns && dnsInfo.ns.length > 0) {
            dnsRecordsData.push({ label: 'NS', value: `${dnsInfo.ns.length} Records` });
        }
        if (dnsInfo.txt && dnsInfo.txt.length > 0) {
            dnsRecordsData.push({ label: 'TXT', value: `${dnsInfo.txt.length} Records` });
        }
        if (dnsRecordsData.length === 0) {
            dnsRecordsData.push({ label: 'Records', value: 'Not Detected' });
        }

        // 2. DNS Servers
        const dnsServersData: KeyValueItem[] = [];
        if (dnsInfo.ns && dnsInfo.ns.length > 0) {
            // Show first 2 NS
            dnsInfo.ns.slice(0, 3).forEach((ns: any, i: number) => {
                dnsServersData.push({ label: `NS ${i+1}`, value: ns.host || 'Unknown' });
            });
        } else {
             dnsServersData.push({ label: 'Nameservers', value: 'Not Detected' });
        }
        dnsServersData.push({ label: 'DNSSEC', value: 'Not Detected' }); // Placeholder for now

        const domainCards: InfoCardData[] = [
             {
                id: 'dns-records',
                title: 'DNS Records',
                type: 'kv-list',
                delay: 0.2,
                data: dnsRecordsData
            },
            {
                id: 'dns-servers',
                title: 'DNS Servers',
                type: 'kv-list',
                delay: 0.2,
                data: dnsServersData
            }
        ];

        // Add subdomains card if exists
        // reconPipeline returns systems array with subdomains
        if (systems.length > 0) {
             const subLabels = systems
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

        const domainSection: ScanSection = {
            id: 'domain-dns',
            title: 'Domain & DNS',
            cards: domainCards
        };

        // Web & Security
        const sslInfo = data.ssl || {};
        const headers = mainSystem.headers?.headers || {};
        const security = mainSystem.headers?.security || {};
        
        // 3. SSL Certificate
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

        // 4. HTTP Security Headers
        const securityHeadersData: KeyValueItem[] = [
            { label: 'Content-Security-Policy', value: security.csp ? 'Present' : 'Missing', color: security.csp ? 'var(--accent-success)' : undefined },
            { label: 'Strict-Transport-Security', value: security.hsts ? 'Present' : 'Missing', color: security.hsts ? 'var(--accent-success)' : undefined },
            { label: 'X-Frame-Options', value: security.xFrameOptions || 'Missing' },
            { label: 'X-Content-Type-Options', value: security.xContentTypeOptions || 'Missing' },
            { label: 'Referrer-Policy', value: security.referrerPolicy || 'Missing' }
        ];

        // 5. Cookies
        const cookieHeader = headers['set-cookie'];
        const cookiesData: KeyValueItem[] = [];
        
        if (cookieHeader) {
            const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
            cookies.slice(0, 4).forEach((c: string) => {
                const name = c.split('=')[0];
                const secure = c.toLowerCase().includes('secure') ? 'Yes' : 'No';
                const httpOnly = c.toLowerCase().includes('httponly') ? 'Yes' : 'No';
                cookiesData.push({ label: name, value: `Secure: ${secure}, HttpOnly: ${httpOnly}` });
            });
        } else {
            cookiesData.push({ label: 'Cookies', value: 'None Detected' });
        }

        const webSection: ScanSection = {
            id: 'web-security',
            title: 'Web & Security',
            cards: [
                {
                    id: 'ssl-cert',
                    title: 'SSL Certificate',
                    type: 'kv-list',
                    delay: 0.1,
                    data: sslCardData
                },
                {
                    id: 'security-headers',
                    title: 'HTTP Security Headers',
                    type: 'kv-list',
                    delay: 0.2,
                    data: securityHeadersData
                },
                {
                    id: 'cookies',
                    title: 'Cookies',
                    type: 'kv-list',
                    delay: 0.3,
                    data: cookiesData
                }
            ]
        };

        // Threat & Reputation (Placeholder if not in reconPipeline yet)
        // If reconPipeline doesn't return threat info yet, we skip or use mock
        // Assuming reconPipeline DOES NOT return threat info structure like this yet based on code reading
        // But we can keep it as empty or use placeholders
        
        const threatSection: ScanSection = {
            id: 'threat-reputation',
            title: 'Threat & Reputation',
            cards: [
                {
                    id: 'blocklists',
                    title: 'Blocklists',
                    type: 'kv-list',
                    delay: 0.1,
                    data: [
                         { label: 'Status', value: 'Clean (Mock)' }
                    ]
                }
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
                        { label: 'Allowed Paths', value: crawlRules.allowed?.length > 0 ? `${crawlRules.allowed.length} Rules` : 'None' },
                        { label: 'Disallowed Paths', value: crawlRules.disallowed?.length > 0 ? `${crawlRules.disallowed.length} Rules` : 'None' },
                        { label: 'Sitemaps', value: crawlRules.sitemaps?.length > 0 ? `${crawlRules.sitemaps.length} Found` : 'None' }
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
                        { label: 'Preview Image', value: socialTags.image ? 'Present' : 'Not Detected' }
                    ]
                }
            ]
         };

        return [hostSection, domainSection, webSection, governanceSection, metadataSection, threatSection];
    };

    return (
        <div className="scan-results-page">
            <header className="results-header">
                <button onClick={onBack} className="back-button">← Back</button>
                <h1 className="target-title">
                    Target: <span className="highlight">{target}</span>
                </h1>
                <div className="scan-status">
                    <span className={`status-dot ${loading ? 'scanning' : 'complete'}`}></span>
                    {loading ? 'SCANNING' : 'COMPLETE'}
                </div>
            </header>

            {error ? (
                <div className="error-message">
                    <h3>Scan Failed</h3>
                    <p>{error}</p>
                    <button onClick={onBack}>Try Again</button>
                </div>
            ) : (
                <>
                    {/* AI Security Report */}
                    <div className="mb-8">
                         <SecurityReport analysis={aiAnalysis} loading={loading} />
                    </div>

                    {loading ? (
                        <ScanningAnimation target={target || "Unknown Target"} />
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

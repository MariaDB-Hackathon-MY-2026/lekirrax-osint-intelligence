import React, { useEffect, useState } from 'react';
import InfoCard from '../../components/InfoCard';
import { OsintCard } from '../../components/OsintCard';
import ScanReveal from '../../components/ScanReveal';
import ScanningAnimation from '../../components/ScanningAnimation';
import SecurityReport from '../../components/SecurityReport';
import type { InfoCardData, KeyValueItem, ScanSection, AiAnalysis } from '../../types';
import './OsintResultsPage.css';

interface OsintResultsPageProps {
    target?: string;
    onBack?: () => void;
}

const OsintResultsPage: React.FC<OsintResultsPageProps> = ({ target, onBack }) => {
    const [osintData, setOsintData] = useState<ScanSection[]>([]);
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

        const normalizedTarget = target.trim().toLowerCase(); // Simple normalization

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setAiAnalysis(null);
            try {
                // Ensure fresh data by appending timestamp or using cache: 'no-store'
                // Using the same endpoint as ScanResultsPage for now to get the data structure
                const response = await fetch(`http://localhost:3000/api/recon?target=${encodeURIComponent(normalizedTarget)}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Investigation failed: ${response.statusText}`);
                }

                const rawData = await response.json();
                console.log('Raw OSINT Data:', rawData); // Debug log

                // Validation
                if (rawData.target && rawData.target !== normalizedTarget) {
                    console.warn(`Target mismatch warning: requested ${normalizedTarget}, got ${rawData.target}`);
                }

                // Set AI Analysis
                if (rawData.aiAnalysis) {
                    setAiAnalysis(rawData.aiAnalysis);
                } else if (rawData.ai_analysis) {
                    setAiAnalysis(rawData.ai_analysis);
                }

                if (rawData.scan_id) {
                    setScanId(rawData.scan_id);
                }

                const mappedData = transformData(rawData);
                setOsintData(mappedData);
            } catch (err: any) {
                console.error("OSINT error:", err);
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
        const mainSystem = systems[0] || {}; 
        const location = mainSystem.location || {};
        const firewall = data.firewall || {};
        
        // Digital Footprint (Host & Infrastructure)
        const footprintSection: ScanSection = {
            id: 'digital-footprint',
            title: 'Digital Footprint',
            cards: [
                {
                    id: 'geo-location',
                    title: 'Geo-Location Intelligence',
                    type: 'kv-list',
                    delay: 0.1,
                    data: [
                        { label: 'IP Address', value: location.ip || mainSystem.ip || 'Not Resolved' },
                        { label: 'City', value: location.city || 'Unknown City' },
                        { label: 'Country', value: location.country ? `${location.country} ${location.countryCode || ''}` : 'Unknown Country' },
                        { label: 'ISP / Org', value: location.isp || location.org || 'Unknown ISP' },
                    ],
                    customContentId: 'map-visualization'
                },
                {
                    id: 'defense-mech',
                    title: 'Defense Mechanisms',
                    type: 'kv-list',
                    delay: 0.2,
                    data: [
                        { 
                            label: 'Firewall Detected', 
                            value: firewall.firewall ? 'Yes' : 'No', 
                            color: firewall.firewall ? 'var(--accent-success)' : undefined 
                        },
                        { label: 'WAF Signature', value: firewall.waf || 'None' },
                    ]
                }
            ]
        };

        // Add services/ports
        if (mainSystem.ports && mainSystem.ports.results) {
            const openPorts = mainSystem.ports.results
                .filter((p: any) => p.status === 'open')
                .map((p: any) => ({ label: `${p.port} (${p.service})` }));
            
            if (openPorts.length > 0) {
                footprintSection.cards.push({
                    id: 'exposed-services',
                    title: 'Exposed Services',
                    type: 'tags',
                    delay: 0.3,
                    data: openPorts
                });
            }
        }

        // Domain Intelligence (Domain & DNS)
        const dnsInfo = data.dns || {}; 

        // 1. DNS Records
        const dnsRecordsData: KeyValueItem[] = [];
        if (dnsInfo.a && dnsInfo.a.length > 0) {
            dnsRecordsData.push({ label: 'A Records', value: `${dnsInfo.a.length} Found` });
        }
        if (dnsInfo.aaaa && dnsInfo.aaaa.length > 0) {
            dnsRecordsData.push({ label: 'AAAA Records', value: `${dnsInfo.aaaa.length} Found` });
        }
        if (dnsInfo.mx && dnsInfo.mx.length > 0) {
            dnsRecordsData.push({ label: 'MX Records', value: `${dnsInfo.mx.length} Found` });
        }
        if (dnsInfo.ns && dnsInfo.ns.length > 0) {
            dnsRecordsData.push({ label: 'NS Records', value: `${dnsInfo.ns.length} Found` });
        }
        if (dnsInfo.txt && dnsInfo.txt.length > 0) {
            dnsRecordsData.push({ label: 'TXT Records', value: `${dnsInfo.txt.length} Found` });
        }
        if (dnsRecordsData.length === 0) {
            dnsRecordsData.push({ label: 'DNS Records', value: 'None Detected' });
        }

        // 2. Nameservers
        const nameserversData: KeyValueItem[] = [];
        if (dnsInfo.ns && dnsInfo.ns.length > 0) {
            dnsInfo.ns.slice(0, 3).forEach((ns: any, i: number) => {
                nameserversData.push({ label: `NS ${i+1}`, value: ns.host || 'Unknown' });
            });
        } else {
             nameserversData.push({ label: 'Nameservers', value: 'Not Detected' });
        }

        const domainCards: InfoCardData[] = [
             {
                id: 'dns-records',
                title: 'DNS Enumeration',
                type: 'kv-list',
                delay: 0.2,
                data: dnsRecordsData
            },
            {
                id: 'nameservers',
                title: 'Nameservers',
                type: 'kv-list',
                delay: 0.2,
                data: nameserversData
            }
        ];

        // Add subdomains
        if (systems.length > 0) {
             const subLabels = systems
                .map((s: any) => ({ label: s.subdomain }))
                .slice(0, 15);
             
             if (subLabels.length > 0) {
                 domainCards.push({
                    id: 'sub-domains',
                    title: `Identified Subdomains (${systems.length})`,
                    type: 'tags',
                    delay: 0.3,
                    data: subLabels
                 });
             }
        }

        const domainSection: ScanSection = {
            id: 'domain-intelligence',
            title: 'Domain Intelligence',
            cards: domainCards
        };

        // Web Assets & Hygiene (Web & Security)
        const sslInfo = data.ssl || {};
        
        // SSL Certificate
        const sslCardData: KeyValueItem[] = [
            { label: 'Issuer Org', value: sslInfo.issuer?.O || 'Unknown' },
            { label: 'Common Name', value: sslInfo.subject?.CN || 'Unknown' },
            { label: 'Valid From', value: sslInfo.validForm ? new Date(sslInfo.validForm).toLocaleDateString() : 'N/A' },
            { label: 'Expires', value: sslInfo.validTo ? new Date(sslInfo.validTo).toLocaleDateString() : 'N/A' },
        ];

        // Security Headers
        const security = mainSystem.headers?.security || {};
        const securityHeadersData: KeyValueItem[] = [];
        if (security) {
            Object.entries(security).forEach(([key, val]) => {
                securityHeadersData.push({ 
                    label: key, 
                    value: val ? 'Present' : 'Missing',
                    color: val ? 'var(--accent-success)' : 'var(--accent-danger)'
                });
            });
        }

        // Cookies
        const cookies = mainSystem.headers?.cookies || {};
        const cookiesData: KeyValueItem[] = [];
        if (Object.keys(cookies).length > 0) {
            Object.entries(cookies).forEach(([name, c]: [string, any]) => {
                const secure = c.toLowerCase().includes('secure') ? 'Yes' : 'No';
                const httpOnly = c.toLowerCase().includes('httponly') ? 'Yes' : 'No';
                cookiesData.push({ label: name, value: `Secure: ${secure}, HttpOnly: ${httpOnly}` });
            });
        } else {
            cookiesData.push({ label: 'Cookies', value: 'None Detected' });
        }

        const webSection: ScanSection = {
            id: 'web-assets',
            title: 'Web Assets & Hygiene',
            cards: [
                {
                    id: 'ssl-cert',
                    title: 'SSL Certificate Details',
                    type: 'kv-list',
                    delay: 0.1,
                    data: sslCardData
                },
                {
                    id: 'sec-headers',
                    title: 'Header Analysis',
                    type: 'kv-list',
                    delay: 0.2,
                    data: securityHeadersData
                },
                {
                    id: 'cookies',
                    title: 'Cookie Analysis',
                    type: 'kv-list',
                    delay: 0.3,
                    data: cookiesData
                }
            ]
        };

        // Threat & Reputation
        // Checking for social tags as a proxy for reputation/identity
        const socialTags = data.social_tags || {};
        
        const threatSection: ScanSection = {
            id: 'reputation-identity',
            title: 'Reputation & Identity',
            cards: [
                {
                    id: 'social-metadata',
                    title: 'Social Metadata',
                    type: 'kv-list',
                    delay: 0.1,
                    data: [
                        { label: 'OG Title', value: socialTags.ogTitle || 'Not Detected' },
                        { label: 'OG Description', value: socialTags.ogDescription ? (socialTags.ogDescription.length > 50 ? socialTags.ogDescription.substring(0, 50) + '...' : socialTags.ogDescription) : 'Not Detected' },
                        { label: 'Twitter Card', value: socialTags.twitterCard || 'Not Detected' },
                    ]
                }
            ]
         };

        return [footprintSection, domainSection, webSection, threatSection];
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
                    {loading ? 'INVESTIGATING' : 'COMPLETE'}
                </div>
            </header>

            {error ? (
                <div className="error-message">
                    <h3>Investigation Failed</h3>
                    <p>{error}</p>
                    <button onClick={onBack}>Try Again</button>
                </div>
            ) : (
                <>
                    {/* Intelligence Brief */}
                    <div className="mb-8">
                         <SecurityReport analysis={aiAnalysis} loading={loading} />
                    </div>

                    {loading ? (
                        <ScanningAnimation target={target || "Unknown Target"} />
                    ) : (
                        <div className="scan-results-container">
                            {/* Specialized OSINT Modules */}
                            <section className="scan-section">
                                <h2 className="section-title">Deep Web Intelligence</h2>
                                <div className="cards-grid">
                                    <ScanReveal delay={0.1}>
                                        <OsintCard module="asset-radar" target={target || ''} title="Asset Radar" icon="📡" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.2}>
                                        <OsintCard module="alias-finder" target={target || ''} title="Alias Finder" icon="🕵️" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.3}>
                                        <OsintCard module="leak-check" target={target || ''} title="Leak Check" icon="💧" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.4}>
                                        <OsintCard module="geo-spy" target={target || ''} title="Geo Spy" icon="🌍" scanId={scanId} />
                                    </ScanReveal>
                                    <ScanReveal delay={0.5}>
                                        <OsintCard module="code-hunter" target={target || ''} title="Code Hunter" icon="💻" scanId={scanId} />
                                    </ScanReveal>
                                </div>
                            </section>

                            {/* Aggregated Intelligence Data */}
                            {osintData.map((section) => (
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

export default OsintResultsPage;

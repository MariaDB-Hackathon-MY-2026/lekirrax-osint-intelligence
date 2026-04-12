import { getSubdomainInfo } from './subdomainInfo.js';
import { getDNSInfo } from './dnsInfo.js';
import { getHeadersInfo } from './headersInfo.js';
import { getPortsInfo } from './portsInfo.js';
import { getServerLocation } from './serverLocation.js';
import { getFirewallInfo } from './firewallInfo.js';
import { calculateRiskScore } from './riskEngine.js';
import { getSecurityTxt } from './securityTxt.js';
import { getWhoisInfo } from './whoisInfo.js';
import { getThreatInfo } from './threatInfo.js';
import { getSSLInfo } from './sslInfo.js';
import { firecrawlService } from './ai/firecrawl.js';
import { exaService } from './ai/exa.js';
import { llmService } from './ai/llm.js';
import { prioritizeTargets } from './smartFilter.js';

export async function runRecon(domain) {
    // 🚀 STEP 1: Discovery Layer (Exa AI)
    // Find hidden assets before we start the standard enumeration
    let hiddenAssets = [];
    try {
        hiddenAssets = await exaService.findHiddenAssets(domain);
    } catch (e) {
        console.warn('Exa discovery failed, proceeding with standard scan.');
    }

    // 🔥 Firewall detection (ONCE per scan)
    let firewall = null;
    try {
        firewall = await getFirewallInfo(domain);
    } catch {
        firewall = { firewall: false, waf: null };
    }

    // 🧠 Domain Intelligence (Parallel)
    // Replaced manual crawlRules and socialTags with Firecrawl
    const [firecrawlResult, securityTxt, whois, ssl, dnsMain] = await Promise.all([
        firecrawlService.scrapeTarget(domain),
        getSecurityTxt(domain),
        getWhoisInfo(domain),
        getSSLInfo(domain).catch(() => null),
        getDNSInfo(domain).catch(() => null)
    ]);

    // Extract Firecrawl data
    const aiContent = firecrawlResult.success ? firecrawlResult.markdown : null;
    const socialTags = firecrawlResult.success ? firecrawlResult.social : {};
    // Fallback or simplified rules from metadata if needed
    const crawlRules = { robotsTxt: false, allowed: [], disallowed: [] }; // Firecrawl might not give robots.txt directly, using placeholder


    let subdomains = await getSubdomainInfo(domain);

    // Merge Exa results into subdomains
    if (hiddenAssets.length > 0) {
        console.log(`[Recon] Merging ${hiddenAssets.length} assets from Exa into scan target list.`);
        // Simple merge: if asset ends with domain, treat as subdomain. 
        // If it's a full URL, we might need more logic, but for now assume hostname list.
        hiddenAssets.forEach(asset => {
            if (!subdomains.includes(asset)) subdomains.push(asset);
        });
    }

    // 🔑 Always include root domain
    if (!subdomains.includes(domain)) {
        subdomains.push(domain);
    }

    // Limit subdomains to prevent timeout on huge targets (e.g. google.com)
    // In a real production app, we would use a job queue or streaming.
    const MAX_SUBDOMAINS = 50; 
    const totalFound = subdomains.length;
    if (subdomains.length > MAX_SUBDOMAINS) {
        console.warn(`[Recon] Limiting scan to first ${MAX_SUBDOMAINS} of ${subdomains.length} subdomains.`);
        subdomains = subdomains.slice(0, MAX_SUBDOMAINS);
    }

    const systems = [];
    const asnCount = {};
    const serviceCount = {};
    const countryCount = {};

    // Parallel processing helper
    const processSubdomain = async (sub) => {
        let dnsResults;
        try {
            dnsResults = await getDNSInfo(sub);
        } catch {
            return;
        }

        if (!dnsResults?.a?.length) return;

        for (const record of dnsResults.a) {
            if (!record.ips?.length) continue;

            // Process IPs in parallel if there are multiple (rare but possible)
            // But usually just one loop is fine. Let's keep loop for IPs but parallelize the checks.
            // Limit to max 2 IPs per subdomain to prevent explosion on large targets
            const targetIps = record.ips.slice(0, 2);
            for (const ipData of targetIps) {
                // Parallelize independent checks
                const [headers, ports, location] = await Promise.all([
                    getHeadersInfo(sub).catch(() => ({})),
                    getPortsInfo(ipData.ip).catch(() => ({})),
                    getServerLocation(ipData.ip).catch(() => ({}))
                ]);

                // 🔥 Risk calculation
                const risk = calculateRiskScore(
                    {
                        ip: ipData.ip,
                        asn: ipData.asn_name,
                        ports,
                        headers
                    },
                    firewall
                );

                // ---------- Aggregation ----------
                if (ipData.asn_name) {
                    asnCount[ipData.asn_name] = (asnCount[ipData.asn_name] || 0) + 1;
                }

                if (location.country) {
                    countryCount[location.country] = (countryCount[location.country] || 0) + 1;
                }

                if (headers.server) {
                    serviceCount[headers.server] = (serviceCount[headers.server] || 0) + 1;
                }

                systems.push({
                    subdomain: sub,
                    ip: ipData.ip,
                    asn: ipData.asn_name || null,
                    location,
                    headers,
                    ports,
                    risk
                });
            }
        }
    };

    // Process subdomains in batches to avoid overwhelming resources
    // Optimized: Smaller batch size and a tiny delay to allow event loop to breathe
    const BATCH_SIZE = 10;
    for (let i = 0; i < subdomains.length; i += BATCH_SIZE) {
        const batch = subdomains.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(sub => processSubdomain(sub)));
        
        // Brief pause between batches if not the last one
        if (i + BATCH_SIZE < subdomains.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // 🛡️ Threat Intelligence (Using main domain IP)
    // We try to find the main domain IP from systems or DNS
    let mainIp = null;
    if (systems.length > 0) {
        // Try to find exact match first
        const mainSystem = systems.find(s => s.subdomain === domain);
        if (mainSystem) mainIp = mainSystem.ip;
        else mainIp = systems[0].ip;
    }
    const threat = await getThreatInfo(domain, mainIp);

    // 🧠 STEP 3: Analysis Layer (LLM)
    // Now that we have all systems, ports, and scraped content, ask the Analyst.
    const reconDataForLLM = {
        target: domain,
        systems,
        firewall,
        ssl,
        dns: dnsMain
    };

    let aiAnalysis = null;
    try {
        aiAnalysis = await llmService.analyzeThreatData(aiContent, reconDataForLLM);
    } catch (e) {
        console.error('[Pipeline] LLM Analysis failed:', e);
    }

    return {
        target: domain,
        scanDate: new Date().toISOString(),
        firewall,
        crawlRules,
        securityTxt,
        socialTags,
        whois,
        ssl,
        dns: dnsMain,
        aiContent, 
        aiAnalysis, // 🔥 Added AI Analysis Report
        systems,
        asnBreakdown: asnCount,
        serviceBreakdown: serviceCount,
        geoBreakdown: countryCount
    };
}
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
import { getSocialTags } from './socialTags.js';

function createAbortError() {
    const err = new Error('Scan cancelled');
    err.name = 'AbortError';
    return err;
}

function throwIfAborted(signal) {
    if (signal?.aborted) throw createAbortError();
}

async function withAbort(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) throw createAbortError();
    let onAbort;
    const abortPromise = new Promise((_, reject) => {
        onAbort = () => reject(createAbortError());
        signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
        const wrapped = Promise.resolve(promise)
            .then((value) => ({ ok: true, value }))
            .catch((error) => ({ ok: false, error }));
        const winner = await Promise.race([wrapped, abortPromise]);
        if (winner?.ok) return winner.value;
        if (winner && winner.ok === false) throw winner.error;
        throw createAbortError();
    } finally {
        signal.removeEventListener('abort', onAbort);
    }
}

/**
 * Main Reconnaissance Pipeline
 * Orchestrates multiple scanning modules in a multi-layered approach:
 * 1. Discovery Layer (Exa AI): Finds hidden subdomains and assets.
 * 2. Intelligence Layer: Parallel DNS, SSL, WHOIS, and Firecrawl scraping.
 * 3. Processing Layer: Batch subdomain resolution and port scanning.
 * 4. Analysis Layer (LLM): AI-powered threat analysis of collected data.
 * @param {string} domain - Target domain to investigate.
 * @returns {Object} Comprehensive reconnaissance report.
 */
export async function runRecon(domain, options = {}) {
    const signal = options?.signal;
    throwIfAborted(signal);
    // 🚀 STEP 1: Discovery Layer (Exa AI)
    // Find hidden assets before we start the standard enumeration
    let hiddenAssets = [];
    try {
        hiddenAssets = await withAbort(exaService.findHiddenAssets(domain), signal);
    } catch (e) {
        console.warn('Exa discovery failed, proceeding with standard scan.');
    }

    // 🔥 Firewall detection (ONCE per scan)
    let firewall = null;
    try {
        firewall = await withAbort(getFirewallInfo(domain, { signal }), signal);
    } catch {
        firewall = { firewall: false, waf: null };
    }

    // 🧠 Domain Intelligence (Parallel)
    // Replaced manual crawlRules and socialTags with Firecrawl
    throwIfAborted(signal);
    const socialTarget = typeof options?.sourceUrl === 'string' ? options.sourceUrl : domain;
    const [firecrawlResult, securityTxt, whois, ssl, dnsMain] = await withAbort(
        Promise.all([
            firecrawlService.scrapeTarget(socialTarget),
            getSecurityTxt(domain, { signal }),
            getWhoisInfo(domain, { signal }),
            getSSLInfo(domain).catch(() => null),
            getDNSInfo(domain).catch(() => null)
        ]),
        signal
    );

    const aiContent = firecrawlResult.success ? firecrawlResult.markdown : null;
    let socialTags = {};
    try {
        socialTags = await withAbort(getSocialTags(socialTarget, { signal }), signal);
    } catch {
        socialTags = {};
    }

    if (!socialTags?.ogTitle && firecrawlResult.success) {
        const meta = firecrawlResult.metadata || {};
        socialTags = {
            ogTitle: meta.ogTitle || meta.title || firecrawlResult.social?.title || null,
            ogDescription: meta.ogDescription || meta.description || firecrawlResult.social?.description || null,
            twitterCard: meta.twitterCard || null,
            image: meta.ogImage || firecrawlResult.social?.ogImage || null
        };
    }
    // Fallback or simplified rules from metadata if needed
    const crawlRules = { robotsTxt: false, allowed: [], disallowed: [] }; // Firecrawl might not give robots.txt directly, using placeholder


    throwIfAborted(signal);
    let subdomains = await withAbort(getSubdomainInfo(domain, { signal }), signal);

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
        throwIfAborted(signal);
        const [dnsResults, headers] = await withAbort(
            Promise.all([
                getDNSInfo(sub).catch(() => null),
                getHeadersInfo(sub, { signal }).catch(() => ({}))
            ]),
            signal
        );

        if (!dnsResults?.a?.length) return;

        for (const record of dnsResults.a) {
            throwIfAborted(signal);
            if (!record.ips?.length) continue;

            const targetIps = record.ips.slice(0, 2);
            await withAbort(Promise.all(targetIps.map(async (ipData) => {
                throwIfAborted(signal);
                const [ports, location] = await withAbort(
                    Promise.all([
                        getPortsInfo(ipData.ip, { signal }).catch(() => ({})),
                        getServerLocation(ipData.ip, { signal }).catch(() => ({}))
                    ]),
                    signal
                );

                // Risk calculation
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
            })), signal);
        }
    };

    const BATCH_SIZE = 10;
    for (let i = 0; i < subdomains.length; i += BATCH_SIZE) {
        throwIfAborted(signal);
        const batch = subdomains.slice(i, i + BATCH_SIZE);
        await withAbort(Promise.all(batch.map(sub => processSubdomain(sub))), signal);
        
        if (i + BATCH_SIZE < subdomains.length) {
            await withAbort(new Promise(resolve => setTimeout(resolve, 100)), signal);
        }
    }

    // 🛡️ Threat Intelligence (Using main domain IP)
    let mainIp = null;
    if (systems.length > 0) {
        const mainSystem = systems.find(s => s.subdomain === domain);
        if (mainSystem) mainIp = mainSystem.ip;
        else mainIp = systems[0].ip;
    }
    throwIfAborted(signal);
    const threat = await withAbort(getThreatInfo(domain, mainIp, { signal }), signal);

    // 🧠 STEP 3: Analysis Layer (LLM)
    const reconDataForLLM = {
        target: domain,
        systems,
        firewall,
        ssl,
        dns: dnsMain
    };

    let aiAnalysis = null;
    try {
        throwIfAborted(signal);
        aiAnalysis = await withAbort(llmService.analyzeThreatData(aiContent, reconDataForLLM), signal);
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
        aiAnalysis,
        systems,
        asnBreakdown: asnCount,
        serviceBreakdown: serviceCount,
        geoBreakdown: countryCount
    };
}

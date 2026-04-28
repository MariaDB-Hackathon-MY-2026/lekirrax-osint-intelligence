import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { logger } from '../logger.js';
import { promises as dns } from 'node:dns';

dotenv.config();

const getEnv = (name) => (process.env[name] || '').trim();

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = (response.headers?.get?.('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);
    return { response, body };
}

function looksLikeCensysPlanAuthError(bodyText) {
    const t = (bodyText || '').toLowerCase();
    if (t.includes('organization id')) return true;
    if (t.includes('free users') && t.includes('platform')) return true;
    if (t.includes('valid api id and secret')) return true;
    return false;
}

async function getSecurityTrailsSubdomains(domain) {
    const key = getEnv('SECURITYTRAILS_API_KEY');
    if (!key) return [];
    const url = `https://api.securitytrails.com/v1/domain/${encodeURIComponent(domain)}/subdomains?children_only=false`;
    const { response, body } = await fetchJson(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            APIKEY: key
        },
        timeout: 10000
    });
    if (!response.ok) {
        const msg = typeof body === 'string' ? body : JSON.stringify(body || {});
        throw new Error(`SecurityTrails API error: ${response.status} ${response.statusText} ${msg}`);
    }
    const subs = Array.isArray(body?.subdomains) ? body.subdomains : [];
    return subs.map((s) => String(s)).filter(Boolean);
}

async function resolveHostnamesToIps(hostnames, { limit = 30 } = {}) {
    const ips = new Set();
    const picked = hostnames.slice(0, limit);
    for (const h of picked) {
        try {
            const records = await dns.resolve4(h);
            for (const ip of records) ips.add(ip);
        } catch {}
    }
    return Array.from(ips);
}

async function getShodanHost(ip) {
    const key = getEnv('SHODAN_API_KEY');
    if (!key) return null;
    const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(key)}`;
    const { response, body } = await fetchJson(url, { method: 'GET', headers: { Accept: 'application/json' }, timeout: 10000 });
    if (!response.ok) return null;
    return body;
}

async function getIpInfo(ip) {
    const key = getEnv('IPINFO_API_KEY');
    if (!key) return null;
    const url = `https://ipinfo.io/${encodeURIComponent(ip)}?token=${encodeURIComponent(key)}`;
    const { response, body } = await fetchJson(url, { method: 'GET', headers: { Accept: 'application/json' }, timeout: 8000 });
    if (!response.ok) return null;
    return body;
}

async function runAlternativeAssetRadar(target) {
    const sources = [];
    const subdomains = await getSecurityTrailsSubdomains(target);
    if (subdomains.length) sources.push('SecurityTrails');

    const hostnames = Array.from(
        new Set([target, ...subdomains.slice(0, 25).map((s) => `${s}.${target}`)])
    );

    const ips = await resolveHostnamesToIps(hostnames, { limit: 30 });
    if (ips.length) sources.push('DNS');

    const hostDetails = [];
    for (const ip of ips.slice(0, 5)) {
        const [shodan, ipinfo] = await Promise.all([getShodanHost(ip), getIpInfo(ip)]);
        if (shodan) sources.push('Shodan');
        if (ipinfo) sources.push('IPinfo');

        const ports = Array.isArray(shodan?.ports) ? shodan.ports : [];
        const location =
            ipinfo?.city && ipinfo?.country
                ? `${ipinfo.city}, ${ipinfo.country}`
                : shodan?.city && shodan?.country_name
                    ? `${shodan.city}, ${shodan.country_name}`
                    : 'Unknown';

        hostDetails.push({
            ip,
            services: ports,
            location,
            last_updated: shodan?.last_update || null
        });
    }

    const uniqueSources = Array.from(new Set(sources));
    return {
        module: 'AssetRadar',
        risk: hostDetails.length > 0 ? 'High' : 'Low',
        data: {
            target,
            total_hosts_found: hostDetails.length,
            hosts: hostDetails,
            search_query: target,
            sources: uniqueSources,
            source: uniqueSources.join(' + ') || 'Alternatives'
        }
    };
}

/**
 * AssetRadar: Infrastructure Discovery using Censys Search API
 * Finds hosts, certificates, and services associated with a target domain.
 */
export const runAssetRadar = async (target) => {
    try {
        const CENSYS_API_ID = getEnv('CENSYS_API_ID');
        const CENSYS_API_SECRET = getEnv('CENSYS_API_SECRET');
        const CENSYS_API_TOKEN = getEnv('CENSYS_API_TOKEN');

        const canUseCensys = Boolean(CENSYS_API_ID && CENSYS_API_SECRET) || Boolean(CENSYS_API_TOKEN);
        if (!canUseCensys) {
            logger.warn('[AssetRadar] Censys credentials missing. Falling back to alternatives.');
            return await runAlternativeAssetRadar(target);
        }

        const auth = CENSYS_API_ID && CENSYS_API_SECRET
            ? `Basic ${Buffer.from(`${CENSYS_API_ID}:${CENSYS_API_SECRET}`).toString('base64')}`
            : `Bearer ${CENSYS_API_TOKEN}`;

        // Search for hosts associated with the domain
        const response = await fetch(`https://search.censys.io/api/v2/hosts/search?q=${encodeURIComponent(target)}&per_page=5`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': auth
            },
            timeout: 10000
        });

        if (!response.ok) {
            const bodyText = await response.text().catch(() => '');
            if (response.status === 401 || response.status === 403) {
                if (looksLikeCensysPlanAuthError(bodyText)) {
                    logger.warn('[AssetRadar] Censys API not available for this account/plan. Falling back to alternatives.');
                    return await runAlternativeAssetRadar(target);
                }
            }
            throw new Error(`Censys API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Transform Censys data into AssetRadar format
        const hosts = data.result?.hits || [];
        const transformedHosts = hosts.map(h => ({
            ip: h.ip,
            services: h.services?.map(s => s.port) || [],
            location: h.location ? `${h.location.city}, ${h.location.country}` : 'Unknown',
            last_updated: h.last_updated_at
        }));

        return {
            module: 'AssetRadar',
            risk: transformedHosts.length > 0 ? 'High' : 'Low',
            data: {
                target,
                total_hosts_found: data.result?.total || 0,
                hosts: transformedHosts,
                search_query: target,
                source: 'Censys Search API'
            }
        };
    } catch (err) {
        logger.error(`[AssetRadar] Censys integration failed: ${err.message}`);
        try {
            return await runAlternativeAssetRadar(target);
        } catch (altErr) {
            logger.error(`[AssetRadar] Alternative providers failed: ${altErr.message}`);
        }
        return {
            module: 'AssetRadar',
            risk: 'Unknown',
            error: `Censys integration failed: ${err.message}`,
            data: getSimulatedData(target).data
        };
    }
};

//Fallback simulated data for development/missing API key
function getSimulatedData(target) {
    return {
        module: 'AssetRadar',
        risk: 'High', 
        data: {
            target,
            hostnames: [`www.${target}`, `api.${target}`, `dev.${target}`],
            open_ports: [80, 443, 8080, 22],
            vulns: ['CVE-2023-23397', 'CVE-2021-44228'],
            tech_stack: ['Nginx', 'Docker', 'Kubernetes'],
            isp: 'DigitalOcean, LLC',
            os: 'Linux 5.4.0',
            source: 'Simulated Data (Censys API Key Missing)'
        }
    };
}

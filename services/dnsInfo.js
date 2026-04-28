import dns from 'dns/promises';
import fetch from 'node-fetch';

const ipCache = {};

/**
 * Enrich IP with ASN, organization, geo & PTR info
 */
async function enrichIP(ip) {
    if (ipCache[ip]) return ipCache[ip];

    try {
        const res = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await res.json();

        let ptr = '';
        try {
        const reverse = await dns.reverse(ip);
        ptr = reverse[0] || '';
        } catch {}

        if (data.status !== 'success') {
        return { ip };
        }

        const result = {
        ip: data.query,
        asn: data.as ? data.as.split(' ')[0].replace('AS', '') : '',
        asn_name: data.as || '',
        org: data.org || '',
        country: data.country || '',
        country_code: data.countryCode || '',
        lat: data.lat,
        lon: data.lon,
        ptr
        };

        ipCache[ip] = result;
        return result;
    } catch {
        return { ip };
    }
    }

    /**
     * DNS Information + Infrastructure Intelligence
     */
    export async function getDNSInfo(domain) {
    const result = {
        a: [],
        aaaa: [],
        cname: [],
        mx: [],
        ns: [],
        txt: [],
        total_a_recs: 0
    };

    // ---------- A (IPv4) ----------
    try {
        let aRecords = [];
        try {
            aRecords = await dns.resolve4(domain);
        } catch (e) {
            // Fallback to lookup if resolve4 fails (common for some subdomains/CNAMEs)
            const lookup = await dns.lookup(domain, { family: 4, all: true });
            aRecords = [...new Set(lookup.map(r => r.address))];
        }

        if (aRecords.length > 0) {
            result.total_a_recs = aRecords.length;
            result.a.push({
                host: domain,
                ips: await Promise.all(
                    aRecords.map(enrichIP)
                )
            });
        }
    } catch {}

    // ---------- AAAA (IPv6) ----------
    try {
        let aaaaRecords = [];
        try {
            aaaaRecords = await dns.resolve6(domain);
        } catch (e) {
            // Fallback to lookup
            try {
                const lookup = await dns.lookup(domain, { family: 6, all: true });
                aaaaRecords = [...new Set(lookup.map(r => r.address))];
            } catch {
                // Ignore if no IPv6
            }
        }

        if (aaaaRecords.length > 0) {
            result.aaaa = await Promise.all(
                aaaaRecords.map(enrichIP)
            );
        }
    } catch {}

    // ---------- CNAME ----------
    try {
        result.cname = await dns.resolveCname(domain);
    } catch {}

    // ---------- MX ----------
    try {
        const mx = await dns.resolveMx(domain);
        result.mx = mx
        .sort((a, b) => a.priority - b.priority)
        .map(m => m.exchange);
    } catch {}

    // ---------- NS ----------
    try {
        const nsRecords = await dns.resolveNs(domain);

        result.ns = await Promise.all(
            nsRecords.map(async (ns) => {
                let ips = [];
                try {
                    const nsIps = await dns.resolve4(ns);
                    ips = await Promise.all(
                        [...new Set(nsIps)].map(enrichIP)
                    );
                } catch {}
                return { host: ns, ips };
            })
        );
    } catch {}

    // ---------- TXT (including SPF, DKIM, DMARC) ----------
    try {
        const txt = await dns.resolveTxt(domain);
        result.txt = txt.flat();
        
        // 🛡️ Security Audit: SPF, DKIM, DMARC
        result.security = {
            spf: result.txt.find(t => t.startsWith('v=spf1')) || null,
            dmarc: null,
            dkim: []
        };

        // Try to find DMARC record
        try {
            const dmarcTxt = await dns.resolveTxt(`_dmarc.${domain}`);
            result.security.dmarc = dmarcTxt.flat().find(t => t.startsWith('v=DMARC1')) || null;
        } catch {}

        // DKIM selectors are domain-specific (e.g., google._domainkey.example.com)
        // We check common selectors for basic audit
        const commonSelectors = ['default', 'google', 'mail', 'k1', 'sig1'];
        for (const selector of commonSelectors) {
            try {
                const dkimTxt = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
                const record = dkimTxt.flat().find(t => t.startsWith('v=DKIM1'));
                if (record) result.security.dkim.push({ selector, record });
            } catch {}
        }
    } catch {}

    return result;
    }
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
        const aRecords = await dns.resolve4(domain);
        result.total_a_recs = aRecords.length;

        result.a.push({
        host: domain,
        ips: await Promise.all(
            [...new Set(aRecords)].map(enrichIP)
        )
        });
    } catch {}

    // ---------- AAAA (IPv6) ----------
    try {
        const aaaaRecords = await dns.resolve6(domain);
        result.aaaa = await Promise.all(
        [...new Set(aaaaRecords)].map(enrichIP)
        );
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

        for (const ns of nsRecords) {
        let ips = [];
        try {
            const nsIps = await dns.resolve4(ns);
            ips = await Promise.all(
            [...new Set(nsIps)].map(enrichIP)
            );
        } catch {}

        result.ns.push({ host: ns, ips });
        }
    } catch {}

    // ---------- TXT ----------
    try {
        const txt = await dns.resolveTxt(domain);
        result.txt = txt.flat();
    } catch {}

    return result;
    }
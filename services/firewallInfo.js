import fetch from 'node-fetch';

const WAF_SIGNATURES = [
    {
        name: 'Cloudflare',
        match: headers =>
        headers['cf-ray'] ||
        headers['cf-cache-status'] ||
        headers['server']?.toLowerCase().includes('cloudflare')
    },
    {
        name: 'Akamai',
        match: headers =>
        Object.keys(headers).some(k => k.startsWith('akamai')) ||
        headers['server']?.toLowerCase().includes('akamai')
    },
    {
        name: 'AWS WAF / CloudFront',
        match: headers =>
        headers['x-amzn-requestid'] ||
        headers['x-amz-cf-id']
    },
    {
        name: 'Fastly',
        match: headers =>
        headers['x-served-by'] ||
        headers['via']?.toLowerCase().includes('fastly')
    },
    {
        name: 'Imperva Incapsula',
        match: headers =>
        headers['set-cookie']?.includes('incap_ses') ||
        headers['set-cookie']?.includes('visid_incap')
    },
    {
        name: 'F5 BIG-IP ASM',
        match: headers =>
        headers['set-cookie']?.toLowerCase().includes('bigip')
    }
    ];

    export async function getFirewallInfo(target) {
    const url = target.startsWith('http')
        ? target
        : `https://${target}`;

    let response;
    try {
        response = await fetch(url, {
        method: 'GET',
        redirect: 'manual'
        });
    } catch (err) {
        return {
        firewall: false,
        waf: null,
        error: 'Connection failed'
        };
    }

    const headers = {};
    response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
    });

    let detectedWAF = null;

    for (const waf of WAF_SIGNATURES) {
        if (waf.match(headers)) {
        detectedWAF = waf.name;
        break;
        }
    }

    return {
        firewall: Boolean(detectedWAF),
        waf: detectedWAF,
        headers_checked: Object.keys(headers),
        confidence: detectedWAF ? 'high' : 'low'
    };
    }
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
    },
    {
        name: 'Sucuri WAF',
        match: headers =>
        headers['x-sucuri-id'] ||
        headers['x-sucuri-cache'] ||
        headers['server']?.toLowerCase().includes('sucuri')
    },
    {
        name: 'Barracuda WAF',
        match: headers =>
        headers['set-cookie']?.toLowerCase().includes('barra_counter_scope') ||
        headers['set-cookie']?.toLowerCase().includes('bnisb_static')
    },
    {
        name: 'Reblaze',
        match: headers =>
        headers['server']?.toLowerCase().includes('reblaze') ||
        headers['x-reblaze-protection']
    }
    ];

    export async function getFirewallInfo(target, options = {}) {
    const signal = options?.signal;
    const url = target.startsWith('http')
        ? target
        : `https://${target}`;

    let response;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
        response = await fetch(url, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal
        });
        clearTimeout(timeout);
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

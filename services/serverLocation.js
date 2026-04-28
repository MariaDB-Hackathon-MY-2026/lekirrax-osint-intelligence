import dns from 'dns/promises';
import net from 'net';
import fetch from 'node-fetch';

function isIP(input) {
    return net.isIP(input) !== 0;
    }

    async function resolveToIP(target, signal) {
    if (signal?.aborted) {
        const err = new Error('Scan cancelled');
        err.name = 'AbortError';
        throw err;
    }
    if (isIP(target)) {
        return target;
    }

    const record = await dns.lookup(target);
    return record.address;
    }

    /**
     * Server Location (IP Geolocation)
     */
    export async function getServerLocation(target, options = {}) {
    const signal = options?.signal;
    const ip = await resolveToIP(target, signal);
    if (signal?.aborted) {
        const err = new Error('Scan cancelled');
        err.name = 'AbortError';
        throw err;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
    const res = await fetch(`http://ip-api.com/json/${ip}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();

    if (data.status !== 'success') {
        throw new Error('Geolocation lookup failed');
    }

    return {
        ip: data.query,
        city: data.city || null,
        region: data.regionName || null,
        country: data.country || null,
        countryCode: data.countryCode || null,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone || null,
        isp: data.isp || null,
        org: data.org || null,
        asn: data.as || null,
        zip: data.zip || null,
        currency: data.currency || null,
        language: countryLanguage(data.countryCode)
    };
    }

    /**
     * Basic country → language mapping
     */
    function countryLanguage(code) {
    const map = {
        US: 'en',
        GB: 'en',
        MY: 'ms',
        FR: 'fr',
        DE: 'de',
        ES: 'es',
        CN: 'zh',
        JP: 'ja'
    };

    return map[code] || 'unknown';
    }

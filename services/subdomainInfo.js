import fetch from 'node-fetch';

export async function getSubdomainInfo(domain, options = {}) {
    const url = `https://crt.sh/?q=%25.${domain}&output=json`;
    const subdomains = new Set();
    const signal = options?.signal;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'LekirraX-OSINT/1.0'
            }
        });
        clearTimeout(timeout);

        const text = await res.text();

        // crt.sh sometimes returns HTML instead of JSON
        if (!text.startsWith('[')) {
        console.warn('[subdomainInfo] crt.sh returned non-JSON');
        return [];
        }

        const data = JSON.parse(text);

        data.forEach(entry => {
        if (entry.name_value) {
            entry.name_value.split('\n').forEach(name => {
            const clean = name.trim().toLowerCase();
            if (
                clean.endsWith(domain) &&
                !clean.startsWith('*') &&
                clean !== domain
            ) {
                subdomains.add(clean);
            }
            });
        }
        });

        return Array.from(subdomains);
    } catch (err) {
        console.error('[subdomainInfo] error:', err.message);
        return [];
    }
    }

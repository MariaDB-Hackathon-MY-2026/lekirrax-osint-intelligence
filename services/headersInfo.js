import fetch from 'node-fetch';

export async function getHeadersInfo(target, options = {}) {
    let url = target;
    const signal = options?.signal;

    // Ensure protocol (prefer HTTPS)
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
        url = `https://${target}`;
    }

    try {
        let res;

        // Try HTTPS first
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
            res = await fetch(url, {
                method: 'HEAD',
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timeout);
        } catch {
        // Fallback to HTTP
        url = `http://${target}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
            res = await fetch(url, {
                method: 'HEAD',
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timeout);
        }

        const headers = Object.fromEntries(res.headers.entries());
        
        // 🛡️ Cookie Security Analysis
        const setCookie = res.headers.raw()?.['set-cookie'] || [];
        const cookies = setCookie.map(cookie => {
            const parts = cookie.split(';').map(p => p.trim());
            return {
                name: parts[0].split('=')[0],
                secure: parts.some(p => p.toLowerCase() === 'secure'),
                httpOnly: parts.some(p => p.toLowerCase() === 'httponly'),
                sameSite: parts.find(p => p.toLowerCase().startsWith('samesite'))?.split('=')[1] || null
            };
        });

        return {
        url,
        status: res.status,
        server: headers['server'] || null,
        poweredBy: headers['x-powered-by'] || null,
        headers,
        security: {
            hsts: headers['strict-transport-security'] || null,
            csp: headers['content-security-policy'] || null,
            xFrameOptions: headers['x-frame-options'] || null,
            xContentTypeOptions: headers['x-content-type-options'] || null,
            referrerPolicy: headers['referrer-policy'] || null,
            cookies
        }
        };
    } catch {
        return {
        url,
        error: 'Failed to fetch headers'
        };
    }
    }

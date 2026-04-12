import fetch from 'node-fetch';

export async function getHeadersInfo(target) {
    let url = target;

    // Ensure protocol (prefer HTTPS)
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
        url = `https://${target}`;
    }

    try {
        let res;

        // Try HTTPS first
        try {
        res = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            timeout: 5000
        });
        } catch {
        // Fallback to HTTP
        url = `http://${target}`;
        res = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            timeout: 5000
        });
        }

        const headers = Object.fromEntries(res.headers.entries());

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
            referrerPolicy: headers['referrer-policy'] || null
        }
        };
    } catch {
        return {
        url,
        error: 'Failed to fetch headers'
        };
    }
    }
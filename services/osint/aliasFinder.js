import fetch from 'node-fetch';

const PLATFORMS = {
    Twitter: { url: 'https://x.com/{}', method: 'GET' },
    Facebook: { url: 'https://www.facebook.com/{}', method: 'GET' },
    Instagram: { url: 'https://www.instagram.com/{}/', method: 'GET' },
    LinkedIn: { url: 'https://www.linkedin.com/in/{}', method: 'GET' },
    TikTok: { url: 'https://www.tiktok.com/@{}', method: 'GET' },
    YouTube: { url: 'https://www.youtube.com/@{}', method: 'GET' },
    Reddit: { url: 'https://www.reddit.com/user/{}', method: 'GET' },
    GitHub: { url: 'https://github.com/{}', method: 'GET' },
    Snapchat: { url: 'https://www.snapchat.com/add/{}', method: 'GET' },
    Twitch: { url: 'https://www.twitch.tv/{}', method: 'GET' },
    Discord: { url: 'https://discord.com/users/{}', method: 'GET' }, // Harder to check without API, but link structure exists
    Telegram: { url: 'https://t.me/{}', method: 'GET' }
};

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

export function clearAliasFinderCache() {
    cache.clear();
}

function classifyChallengeUrl(url) {
    try {
        const u = new URL(url);
        const p = (u.pathname || '').toLowerCase();
        const q = (u.search || '').toLowerCase();
        const h = (u.hostname || '').toLowerCase();
        const full = `${h}${p}${q}`;
        if (full.includes('captcha') || full.includes('challenge') || full.includes('verify') || full.includes('checkpoint')) return true;
        if (p.includes('/login') || p.includes('/signin') || p.includes('/accounts/login')) return true;
        return false;
    } catch {
        return false;
    }
}

async function readHtmlSnippet(response, { maxChars = 65000 } = {}) {
    if (typeof response?.text !== 'function') return '';
    const full = await response.text().catch(() => '');
    return typeof full === 'string' ? full.slice(0, maxChars) : '';
}

async function sniffNotFound(name, response) {
    if (response.status !== 200) return null;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) return null;
    if (name !== 'TikTok' && name !== 'Instagram' && name !== 'Twitter') return null;

    const source = typeof response?.clone === 'function' ? response.clone() : response;
    const body = await readHtmlSnippet(source, { maxChars: 65000 });
    const lower = body.toLowerCase();
    const normalized = lower
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/\u2019/g, "'")
        .replace(/\s+/g, ' ');

    if (name === 'TikTok') {
        if (normalized.includes("couldn't find this account")) return true;
        if (normalized.includes('"statuscode":404') || normalized.includes('"notfound":true')) return true;
    }
    if (name === 'Instagram') {
        if (normalized.includes("sorry, this page isn't available")) return true;
    }
    if (name === 'Twitter') {
        if (lower.includes("this account doesn&#x27;t exist")) return true;
        if (lower.includes("this account doesn&#39;t exist")) return true;
        if (normalized.includes("this account doesn't exist")) return true;
        if (normalized.includes('this account doesn’t exist')) return true;
        if (normalized.includes('this account does not exist')) return true;
        if (normalized.includes('try searching for another')) return true;
    }

    return null;
}

async function checkPlatform(name, config, username) {
    const url = config.url.replace('{}', username);
    const start = performance.now();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    try {
        const controller = new AbortController();
        const timeoutMs = 4500;
        const timeoutId = setTimeout(() => {
            try {
                controller.abort();
            } catch {
                // ignore
            }
        }, timeoutMs);

        let response;
        try {
            response = await fetch(url, {
            method: config.method,
            headers: {
                'User-Agent': userAgent,
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            signal: controller.signal,
            redirect: 'follow',
            size: 65000
            });
        } catch (e) {
            if (e?.name === 'AbortError') {
                throw new Error('FETCH_TIMEOUT');
            }
            throw e;
        } finally {
            clearTimeout(timeoutId);
        }

        const duration = Math.round(performance.now() - start);

        let status = 'error';
        if (response.status === 200) {
            const finalUrl = response.url || url;
            if (finalUrl !== url && classifyChallengeUrl(finalUrl)) {
                status = 'rate-limited';
            } else {
                const notFound = await sniffNotFound(name, response);
                status = notFound === true ? 'available' : 'taken';
            }
        } else if (response.status === 404) {
            status = 'available';
        } else if (response.status === 429) {
            status = 'rate-limited';
        }

        return {
            platform: name,
            status,
            url,
            responseTime: duration,
            statusCode: response.status
        };
    } catch (error) {
        return {
            platform: name,
            status: 'error',
            url,
            responseTime: Math.round(performance.now() - start),
            error: error?.message || String(error)
        };
    }
}

export const runAliasFinder = async (username) => {
    if (!username) throw new Error('Username is required');

    // Check Cache
    const cacheKey = `alias:${username.toLowerCase()}`;
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[AliasFinder] Cache hit for ${username}`);
            return cached.data;
        }
    }

    console.log(`[AliasFinder] Checking username: ${username} across ${Object.keys(PLATFORMS).length} platforms...`);

    // Parallel execution with concurrency control
    const platformNames = Object.keys(PLATFORMS);
    const results = await Promise.all(
        platformNames.map(name => checkPlatform(name, PLATFORMS[name], username))
    );

    const takenCount = results.filter(r => r.status === 'taken').length;
    const availableCount = results.filter(r => r.status === 'available').length;

    const output = {
        module: 'AliasFinder',
        risk: takenCount > 5 ? 'High' : (takenCount > 2 ? 'Medium' : 'Low'),
        data: {
            username,
            totalPlatforms: results.length,
            takenCount,
            availableCount,
            results
        }
    };

    // Save to Cache
    cache.set(cacheKey, {
        timestamp: Date.now(),
        data: output
    });

    return output;
};

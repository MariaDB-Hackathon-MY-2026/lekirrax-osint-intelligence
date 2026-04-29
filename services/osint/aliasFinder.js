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
    const body = response?.body;
    if (body && typeof body.once === 'function') {
        body.once('error', () => {});
    } else if (body && typeof body.on === 'function') {
        body.on('error', () => {});
    }

    const full = await response.text().catch((e) => {
        if (e?.name === 'AbortError' || e?.type === 'aborted') return '';
        return '';
    });
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

async function checkPlatform(name, config, username, { signal, timeoutMs } = {}) {
    const url = config.url.replace('{}', username);
    const start = performance.now();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const controller = new AbortController();
    const onAbort = () => {
        try {
            controller.abort();
        } catch {
            // ignore
        }
    };

    try {
        const fetchTimeoutMs = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)
            ? Math.max(250, Math.min(4500, Math.floor(timeoutMs)))
            : 4500;
        const sniffTimeoutMs = Math.max(250, Math.min(1500, fetchTimeoutMs - 250));

        if (signal) {
            if (signal.aborted) onAbort();
            else signal.addEventListener('abort', onAbort, { once: true });
        }

        const fetchPromise = fetch(url, {
            method: config.method,
            headers: {
                'User-Agent': userAgent,
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            signal: controller.signal,
            redirect: 'follow'
        });
        void fetchPromise.catch(() => {});

        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                onAbort();
                reject(new Error('FETCH_TIMEOUT'));
            }, fetchTimeoutMs);
        });

        let response;
        try {
            response = await Promise.race([fetchPromise, timeoutPromise]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }

        if (response?.body && typeof response.body.once === 'function') {
            response.body.once('error', () => {});
        } else if (response?.body && typeof response.body.on === 'function') {
            response.body.on('error', () => {});
        }

        const duration = Math.round(performance.now() - start);

        let status = 'error';
        if (response.status === 200) {
            const finalUrl = response.url || url;
            if (finalUrl !== url && classifyChallengeUrl(finalUrl)) {
                status = 'rate-limited';
            } else {
                const sniffPromise = sniffNotFound(name, response);
                void sniffPromise.catch(() => {});

                let sniffTimeoutId;
                const sniffTimeoutPromise = new Promise((_, reject) => {
                    sniffTimeoutId = setTimeout(() => {
                        onAbort();
                        reject(new Error('SNIFF_TIMEOUT'));
                    }, sniffTimeoutMs);
                });

                try {
                    const notFound = await Promise.race([sniffPromise, sniffTimeoutPromise]);
                    status = notFound === true ? 'available' : 'taken';
                } catch (e) {
                    status = e?.message === 'SNIFF_TIMEOUT' ? 'rate-limited' : 'error';
                } finally {
                    if (sniffTimeoutId) clearTimeout(sniffTimeoutId);
                }
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
    } finally {
        if (signal) {
            try {
                signal.removeEventListener('abort', onAbort);
            } catch {
                // ignore
            }
        }
    }
}

export const runAliasFinder = async (username, options = {}) => {
    if (!username) throw new Error('Username is required');
    const signal = options?.signal;

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

    const entries = Object.entries(PLATFORMS);
    const results = [];

    const overallTimeoutMs = 14000;
    const deadline = Date.now() + overallTimeoutMs;
    const concurrency = 4;
    let cursor = 0;

    const worker = async () => {
        while (cursor < entries.length) {
            if (signal?.aborted) break;
            const i = cursor++;
            const [name, config] = entries[i];
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                results[i] = {
                    platform: name,
                    status: 'rate-limited',
                    url: config.url.replace('{}', username),
                    responseTime: 0,
                    error: 'OVERALL_TIMEOUT'
                };
                continue;
            }

            const perPlatformBudget = Math.max(250, Math.min(4500, remaining - 50));
            results[i] = await checkPlatform(name, config, username, { signal, timeoutMs: perPlatformBudget });
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));

    for (let i = 0; i < entries.length; i++) {
        if (!results[i]) {
            const [name, config] = entries[i];
            results[i] = {
                platform: name,
                status: 'rate-limited',
                url: config.url.replace('{}', username),
                responseTime: 0,
                error: signal?.aborted ? 'ABORTED' : 'OVERALL_TIMEOUT'
            };
        }
    }

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

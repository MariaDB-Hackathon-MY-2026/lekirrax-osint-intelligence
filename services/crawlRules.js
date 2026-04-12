
import fetch from 'node-fetch';

/**
 * Retrieves crawl rules from robots.txt and sitemap presence
 */
export async function getCrawlRules(domain) {
    const rules = {
        robotsTxt: false,
        allowed: [],
        disallowed: [],
        sitemaps: []
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`http://${domain}/robots.txt`, { 
            signal: controller.signal,
            redirect: 'follow'
        });
        clearTimeout(timeout);

        if (res.status === 200) {
            rules.robotsTxt = true;
            const text = await res.text();
            
            // Simple parsing
            const lines = text.split('\n');
            let currentUserAgent = '*';

            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine || cleanLine.startsWith('#')) continue;

                const [key, ...values] = cleanLine.split(':');
                const value = values.join(':').trim();
                const lowerKey = key.toLowerCase();

                if (lowerKey === 'user-agent') {
                    currentUserAgent = value;
                } else if (lowerKey === 'allow' && (currentUserAgent === '*' || currentUserAgent.toLowerCase().includes('googlebot'))) {
                    if (rules.allowed.length < 5) rules.allowed.push(value);
                } else if (lowerKey === 'disallow' && (currentUserAgent === '*' || currentUserAgent.toLowerCase().includes('googlebot'))) {
                    if (rules.disallowed.length < 5) rules.disallowed.push(value);
                } else if (lowerKey === 'sitemap') {
                    if (rules.sitemaps.length < 3) rules.sitemaps.push(value);
                }
            }
        }
    } catch (e) {
        // robots.txt might not exist
    }

    return rules;
}

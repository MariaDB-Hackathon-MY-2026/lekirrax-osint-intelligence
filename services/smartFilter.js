
// Interesting keywords that suggest high value (admin panels, dev environments, sensitive services)
const HIGH_VALUE_KEYWORDS = [
    'admin', 'api', 'dev', 'stage', 'staging', 'test', 'vpn', 'internal', 
    'secure', 'db', 'sql', 'jenkins', 'gitlab', 'auth', 'login', 'dashboard',
    'portal', 'corp', 'intranet', 'monitor', 'metrics', 'config'
];

// Keywords suggesting low value / parked / third-party / generic
const LOW_VALUE_KEYWORDS = [
    'status', 'support', 'help', 'mail', 'email', 'shop', 'store', 
    'blog', 'news', 'marketing', 'static', 'assets', 'cdn', 'images', 
    'img', 'media', 'ww1', 'ww2', 'autodiscover', 'cpanel', 'webmail'
];

/**
 * Smartly prioritizes subdomains based on heuristic scoring.
 * 
 * Strategy:
 * 1. Root domain is always #1.
 * 2. "High Value" keywords get +Score.
 * 3. "Low Value" keywords get -Score.
 * 4. Shortest subdomains often interesting (e.g. 'm.target.com').
 * 
 * @param {string[]} subdomains - List of subdomains found
 * @param {string} rootDomain - The main target domain
 * @returns {string[]} - Sorted list of subdomains
 */
export function prioritizeTargets(subdomains, rootDomain) {
    // Safety check
    if (!Array.isArray(subdomains)) return [];
    
    const scored = subdomains.map(domain => {
        let score = 0;
        
        // Handle root domain check safely
        if (domain === rootDomain) {
            score += 1000;
        }

        const subOnly = domain.replace(`.${rootDomain}`, ''); // extract subdomain part

        // 2. High Value Keywords
        if (HIGH_VALUE_KEYWORDS.some(k => subOnly.includes(k))) score += 20;

        // 3. Low Value Keywords
        if (LOW_VALUE_KEYWORDS.some(k => subOnly.includes(k))) score -= 10;

        // 4. Short names are often main apps (e.g. app.target.com vs load-balancer-prod-us-east.target.com)
        if (subOnly.length < 5) score += 5;

        // 5. 'www' is usually important but boring, keep it neutral-positive
        if (subOnly === 'www') score += 5;

        return { domain, score };
    });

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.domain);
}

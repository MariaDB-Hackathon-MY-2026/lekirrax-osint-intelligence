
import fetch from 'node-fetch';

/**
 * Retrieves basic social metadata (Open Graph, Twitter Cards)
 */
export async function getSocialTags(domain) {
    const tags = {
        ogTitle: null,
        ogDescription: null,
        twitterCard: null,
        image: null
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`https://${domain}`, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'LekirraX-Bot/1.0' }
        });
        clearTimeout(timeout);

        if (res.status === 200) {
            const html = await res.text();
            
            // Regex parsing (simple but effective for this)
            const getMeta = (prop) => {
                const match = html.match(new RegExp(`<meta\\s+(?:name|property)=["']${prop}["']\\s+content=["'](.*?)["']`, 'i'));
                return match ? match[1] : null;
            };

            tags.ogTitle = getMeta('og:title');
            tags.ogDescription = getMeta('og:description');
            tags.twitterCard = getMeta('twitter:card');
            tags.image = getMeta('og:image');
        }
    } catch (e) {
        // Fail silently
    }

    return tags;
}

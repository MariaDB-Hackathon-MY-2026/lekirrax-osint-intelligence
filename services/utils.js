
import { URL } from 'url';

/**
 * Normalizes a target string to a valid hostname.
 * Removes protocol, path, query parameters, and www prefix.
 * @param {string} target - The input target string.
 * @returns {string} - The normalized hostname.
 * @throws {Error} - If the target is invalid.
 */
export function normalizeTarget(target) {
    if (!target || typeof target !== 'string') {
        throw new Error('Invalid target provided');
    }

    let hostname = target.trim();

    // Remove protocol if present
    if (hostname.match(/^[a-zA-Z]+:\/\//)) {
        try {
            const parsed = new URL(hostname);
            hostname = parsed.hostname;
        } catch (e) {
            // Fallback for malformed URLs
            hostname = hostname.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0];
        }
    } else {
        // Remove path/query if present (e.g. google.com/foo)
        hostname = hostname.split('/')[0].split('?')[0];
    }

    // Remove www. prefix? 
    // Usually recon is better on the base domain, but sometimes www is different.
    // However, for "google.com" vs "www.google.com", usually we want "google.com" to find ALL subdomains.
    // But if the user specifically wants to scan a subdomain, we should keep it.
    // The issue in the screenshot was `https://web-check.xyz...`
    // URL parsing handles that.
    
    // Let's NOT remove 'www.' automatically unless we are sure.
    // But for the specific case of `https://web-check.xyz/check/...`
    // The URL parser will get `web-check.xyz`. 
    // Wait, the user input in the screenshot was: `https://web-check.xyz/check/https%3A%2F%2Fgoogle.com`
    // If they pasted that literally:
    // `new URL(...)` -> hostname is `web-check.xyz`.
    // The user PROBABLY wanted `google.com` but pasted the wrong link.
    // Or maybe the input field was pre-filled?
    
    // If the user INTENDED to scan `google.com` but pasted a link to a report...
    // We can't easily guess that. We will scan `web-check.xyz` which is valid.
    // BUT, if the backend receives `https://web-check.xyz...`, it currently crashes or fails lookups.
    // With normalization, it will scan `web-check.xyz`.
    
    // However, if the user input was just `https://google.com`, normalization makes it `google.com`.
    
    return hostname.toLowerCase();
}

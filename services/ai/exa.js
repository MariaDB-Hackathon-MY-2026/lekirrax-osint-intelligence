import Exa from 'exa-js';
import dotenv from 'dotenv';

dotenv.config();

export class ExaService {
    constructor() {
        if (!process.env.EXA_API_KEY) {
            console.warn('⚠️ EXA_API_KEY is missing. Neural discovery will be disabled.');
        } else {
            this.exa = new Exa(process.env.EXA_API_KEY);
        }
    }

    /**
     * Performs a neural search to find hidden assets related to the target domain.
     * Searches for: subdomains, dev environments, API endpoints.
     * @param {string} domain - The target domain (e.g., "example.com")
     * @returns {Promise<string[]>} - List of discovered URLs/Domains
     */
    async findHiddenAssets(domain) {
        if (!this.exa) return [];

        console.log(`[Exa] Searching for hidden assets related to ${domain}...`);
        const discovered = new Set();

        try {
            // Strategy 1: Search for subdomains and dev environments
            const query = `site:${domain} "development" OR "staging" OR "api" OR "admin" OR "test"`;
            
            const result = await this.exa.searchAndContents(
                query,
                {
                    type: "neural",
                    useAutoprompt: true,
                    numResults: 10,
                    text: true
                }
            );

            if (result.results) {
                for (const res of result.results) {
                    try {
                        const url = new URL(res.url);
                        // Only add if it belongs to the target domain or is clearly related
                        if (url.hostname.includes(domain)) {
                            discovered.add(url.hostname);
                        }
                    } catch (e) {
                    }
                }
            }

            // Strategy 2: Find similar companies/domains (competitor/related check - optional but useful context)

        } catch (error) {
            console.error(`[Exa] Error during discovery: ${error.message}`);
        }

        const assets = Array.from(discovered);
        console.log(`[Exa] Discovered ${assets.length} potential assets.`);
        return assets;
    }
}

export const exaService = new ExaService();

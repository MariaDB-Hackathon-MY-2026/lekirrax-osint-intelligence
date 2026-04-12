import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';

dotenv.config();

export class FirecrawlService {
    constructor() {
        if (!process.env.FIRECRAWL_API_KEY) {
            console.warn('⚠️ FIRECRAWL_API_KEY is missing. AI scraping will be disabled.');
        }
        this.app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    }

    /**
     * Scrapes a target URL and returns clean Markdown + Metadata.
     * @param {string} url - The target URL (e.g., "example.com")
     * @returns {Promise<Object>} - { markdown, metadata, success }
     */
    async scrapeTarget(url) {
        if (!process.env.FIRECRAWL_API_KEY) {
            return { success: false, error: 'No API Key' };
        }

        // Ensure URL has protocol
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }

        try {
            console.log(`[Firecrawl] Scraping ${url}...`);
            
            let scrapeResult;
            if (typeof this.app.scrapeUrl === 'function') {
                scrapeResult = await this.app.scrapeUrl(url, {
                    formats: ['markdown']
                });
            } else if (this.app.v1 && typeof this.app.v1.scrapeUrl === 'function') {
                 scrapeResult = await this.app.v1.scrapeUrl(url, {
                    formats: ['markdown']
                });
            } else {
                throw new Error('Firecrawl scrapeUrl method not found');
            }

            if (!scrapeResult.success) {
                console.error(`[Firecrawl] Failed to scrape ${url}:`, scrapeResult.error);
                return { success: false, error: scrapeResult.error };
            }

            return {
                success: true,
                markdown: scrapeResult.markdown,
                metadata: scrapeResult.metadata || {},
                // Extract useful social tags if available in metadata
                social: {
                    title: scrapeResult.metadata.title,
                    description: scrapeResult.metadata.description,
                    ogImage: scrapeResult.metadata.ogImage,
                }
            };
        } catch (error) {
            console.error(`[Firecrawl] Error scraping ${url}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}

export const firecrawlService = new FirecrawlService();

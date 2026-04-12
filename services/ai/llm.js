import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export class LLMService {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            console.warn('⚠️ OPENAI_API_KEY is missing. AI Analysis will be disabled.');
        } else {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }
    }

    /**
     * Analyzes reconnaissance data acting as a Senior SOC Analyst.
     * @param {string} markdownContent - Content scraped from the target (Firecrawl)
     * @param {object} reconData - Structured technical data (Ports, DNS, Headers, etc.)
     * @returns {Promise<object>} - JSON object with Threat Level, Vulnerabilities, Remediation
     */
    async analyzeThreatData(markdownContent, reconData) {
        if (!this.openai) return null;

        console.log('[LLM] Starting SOC Analysis...');

        const systemPrompt = `
You are a Senior SOC Analyst & Penetration Tester. 
Your job is to analyze the provided reconnaissance data for a target domain and generate a high-level threat report.

Output MUST be valid JSON in the following format:
{
    "threat_level": <number 1-10>,
    "summary": "<Short executive summary of security posture>",
    "vulnerabilities": [
        { "title": "<Vulnerability Name>", "severity": "<High/Medium/Low>", "description": "<Brief description>" }
    ],
    "remediation": [
        "<Actionable Step 1>",
        "<Actionable Step 2>",
        "<Actionable Step 3>"
    ]
}

CRITERIA:
- Threat Level 10 = Critical imminent compromise (e.g. exposed database, debug mode on).
- Threat Level 1 = Secure, best practices followed.
- Focus on: Exposed ports (SSH, RDP, DB), Missing Security Headers, Information Leakage in Markdown (emails, keys), and Weak SSL.
`;

        // Prepare context
        // Truncate markdown to avoid token limits if necessary (naive truncation)
        const safeMarkdown = markdownContent ? markdownContent.slice(0, 15000) : "No page content available.";
        
        const technicalSummary = JSON.stringify({
            openPorts: reconData.systems.map(s => s.ports?.results).flat(),
            headers: reconData.systems.map(s => s.headers),
            dns: reconData.dns,
            ssl: reconData.ssl,
            firewall: reconData.firewall
        }, null, 2);

        const userPrompt = `
Target: ${reconData.target}
Technical Scan Data:
${technicalSummary}

Scraped Page Content (Excerpt):
${safeMarkdown}
`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o", // Updated to standard model
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content;
            return JSON.parse(content);

        } catch (error) {
            console.error(`[LLM] Analysis failed: ${error.message}`);
            // Return a fallback analysis so the UI doesn't break
            return {
                threat_level: 5,
                summary: "AI Analysis unavailable (Service Quota Exceeded). Displaying fallback data based on standard reconnaissance.",
                vulnerabilities: [
                    { title: "Quota Limit Reached", severity: "Medium", description: "The AI analysis service is temporarily unavailable. Please upgrade your plan or try again later." }
                ],
                remediation: [
                    "Check API quota limits",
                    "Verify billing details",
                    "Retry scan later"
                ]
            };
        }
    }
}

export const llmService = new LLMService();

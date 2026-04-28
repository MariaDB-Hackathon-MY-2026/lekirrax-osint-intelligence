import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

function isAbortError(error) {
    return (
        error?.name === 'AbortError' ||
        error?.code === 'ABORT_ERR' ||
        error?.message === 'The operation was aborted.' ||
        error?.message === 'Aborted'
    );
}

function toNumberOrNull(value) {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function getRetryAfterMs(error) {
    const header =
        error?.headers?.['retry-after'] ??
        error?.headers?.get?.('retry-after') ??
        error?.response?.headers?.['retry-after'] ??
        error?.response?.headers?.get?.('retry-after');

    const seconds = toNumberOrNull(header);
    if (seconds === null) return null;
    return Math.max(0, Math.floor(seconds * 1000));
}

function classifyOpenAiError(error) {
    const status = toNumberOrNull(error?.status ?? error?.response?.status);
    const code = error?.code ?? error?.error?.code ?? error?.error?.type ?? error?.type;
    const message = typeof error?.message === 'string' ? error.message : '';

    const normalizedCode = typeof code === 'string' ? code.toLowerCase() : '';
    const normalizedMessage = message.toLowerCase();

    const retryAfterMs = getRetryAfterMs(error);

    const is429 = status === 429;
    const is5xx = status !== null && status >= 500 && status <= 599;

    const isInsufficientQuota =
        normalizedCode.includes('insufficient_quota') ||
        normalizedMessage.includes('insufficient_quota') ||
        normalizedMessage.includes('exceeded your current quota') ||
        normalizedMessage.includes('billing') ||
        normalizedMessage.includes('quota');

    const isRateLimit =
        normalizedCode.includes('rate_limit') ||
        normalizedMessage.includes('rate limit') ||
        (is429 && !isInsufficientQuota);

    if (isInsufficientQuota) return { kind: 'insufficient_quota', status, code, retryAfterMs };
    if (isRateLimit) return { kind: 'rate_limit', status, code, retryAfterMs };
    if (is5xx) return { kind: 'transient', status, code, retryAfterMs };
    return { kind: 'other', status, code, retryAfterMs };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attemptIndex, retryAfterMs) {
    if (typeof retryAfterMs === 'number') return retryAfterMs;
    const base = 500 * Math.pow(2, attemptIndex);
    const jitter = Math.floor(Math.random() * 200);
    return Math.min(3000, base + jitter);
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function computeHeuristicAnalysis(reconData, reason) {
    const systems = safeArray(reconData?.systems);
    const firewall = reconData?.firewall;
    const ssl = reconData?.ssl;
    const dns = reconData?.dns;

    const scores = systems.map((s) => toNumberOrNull(s?.risk?.score)).filter((n) => n !== null);
    const maxRiskScore = scores.length ? Math.max(...scores) : null;

    let score = maxRiskScore ?? 0;
    const reasons = new Set();

    if (maxRiskScore === null) {
        for (const s of systems) {
            const ports = safeArray(s?.ports?.results);
            for (const p of ports) {
                if (p?.status !== 'open') continue;
                if (p?.port === 22) {
                    score += 20;
                    reasons.add('SSH port (22) exposed');
                }
                if (p?.port === 3389) {
                    score += 25;
                    reasons.add('RDP port (3389) exposed');
                }
                if (p?.port === 3306 || p?.port === 5432) {
                    score += 30;
                    reasons.add('Database service exposed');
                }
                if (p?.port === 21 || p?.port === 25 || p?.port === 110 || p?.port === 143) {
                    score += 10;
                    reasons.add('Legacy or mail services exposed');
                }
            }
        }

        if (!firewall?.firewall) {
            score += 25;
            reasons.add('No firewall detected');
        }

        const serverHeader = systems?.[0]?.headers?.headers?.server;
        if (typeof serverHeader === 'string' && /\d+(\.\d+)?/.test(serverHeader)) {
            score += 10;
            reasons.add('Server version disclosed in headers');
        }
    }

    if (!ssl) {
        score += 15;
        reasons.add('No TLS certificate details found (HTTPS may be misconfigured)');
    } else if (ssl?.validTo) {
        const validTo = new Date(String(ssl.validTo));
        const msLeft = validTo.getTime() - Date.now();
        const daysLeft = Number.isFinite(msLeft) ? Math.floor(msLeft / (1000 * 60 * 60 * 24)) : null;
        if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 30) {
            score += 10;
            reasons.add('TLS certificate expiring soon');
        }
    }

    const mx = safeArray(dns?.mx);
    const dnsSec = dns?.security;
    if (mx.length) {
        if (!dnsSec?.spf) {
            score += 6;
            reasons.add('Missing SPF record');
        }
        if (!dnsSec?.dmarc) {
            score += 6;
            reasons.add('Missing DMARC policy');
        }
        const dkim = safeArray(dnsSec?.dkim);
        if (!dkim.length) {
            score += 4;
            reasons.add('No DKIM record detected');
        }
    }

    score = clamp(Math.round(score), 0, 100);
    const threat_level = clamp(Math.round((score / 100) * 9) + 1, 1, 10);

    const vulnList = [];
    const addVuln = (title, severity, description) => {
        if (vulnList.length >= 6) return;
        if (vulnList.some((v) => v.title === title)) return;
        vulnList.push({ title, severity, description });
    };

    for (const r of Array.from(reasons)) {
        if (r.includes('Database')) addVuln('Database service exposed', 'High', 'A database port appears open to the internet.');
        else if (r.includes('RDP')) addVuln('RDP exposed', 'High', 'Remote Desktop is reachable from the internet and is a common brute-force target.');
        else if (r.includes('SSH')) addVuln('SSH exposed', 'Medium', 'SSH is reachable from the internet; restrict by IP and enforce key-based auth.');
        else if (r.includes('firewall')) addVuln('No firewall detected', 'Medium', 'No edge firewall/WAF was detected for the target.');
        else if (r.includes('Server version')) addVuln('Server version disclosure', 'Low', 'Server headers appear to disclose product/version details.');
        else if (r.includes('SPF')) addVuln('Missing SPF', 'Low', 'Email spoofing protections may be incomplete without SPF.');
        else if (r.includes('DMARC')) addVuln('Missing DMARC', 'Low', 'DMARC policy is missing, reducing protection against spoofing/phishing.');
        else if (r.includes('DKIM')) addVuln('Missing DKIM', 'Low', 'DKIM was not detected; signed outbound mail may be unsupported.');
        else if (r.includes('TLS certificate expiring')) addVuln('TLS certificate expiring soon', 'Low', 'Certificate expiration can cause service interruption and trust warnings.');
        else if (r.includes('No TLS certificate')) addVuln('TLS/HTTPS not verified', 'Medium', 'TLS details could not be retrieved; verify HTTPS configuration and certificate.');
        else addVuln('Security exposure detected', 'Low', r);
    }

    const remediation = [];
    const addRem = (step) => {
        if (remediation.includes(step)) return;
        remediation.push(step);
    };
    for (const v of vulnList) {
        if (v.title === 'Database service exposed') addRem('Restrict database ports to private networks/VPN and enforce authentication.');
        if (v.title === 'RDP exposed') addRem('Disable public RDP or restrict to VPN/allowlist; enforce MFA where possible.');
        if (v.title === 'SSH exposed') addRem('Restrict SSH by IP, disable password auth, and enforce strong keys.');
        if (v.title === 'No firewall detected') addRem('Enable a firewall/WAF and restrict inbound access to required ports only.');
        if (v.title === 'Server version disclosure') addRem('Remove or minimize server version banners in HTTP responses.');
        if (v.title === 'Missing SPF') addRem('Publish an SPF record for domains that send email.');
        if (v.title === 'Missing DMARC') addRem('Publish a DMARC policy (start with monitoring, then enforce).');
        if (v.title === 'Missing DKIM') addRem('Configure DKIM signing for outbound email and publish the DKIM record.');
        if (v.title === 'TLS certificate expiring soon') addRem('Renew TLS certificates proactively and enable auto-renewal.');
        if (v.title === 'TLS/HTTPS not verified') addRem('Verify HTTPS is enabled and TLS certificates are valid for the hostname.');
    }

    addRem('Retry AI analysis when service quota/rate limits are resolved.');

    return {
        threat_level,
        summary: `AI Analysis unavailable (${reason}). Threat score computed using deterministic scan heuristics.`,
        vulnerabilities: vulnList.length
            ? vulnList
            : [
                  {
                      title: 'No significant exposures detected',
                      severity: 'Low',
                      description: 'No high-impact findings were derived from the available scan heuristics.'
                  }
              ],
        remediation: remediation.length ? remediation : ['Retry AI analysis when service quota/rate limits are resolved.']
    };
}

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

        try {
            const primaryModel = process.env.OPENAI_MODEL_PRIMARY || 'gpt-4o';
            const fallbackModel = process.env.OPENAI_MODEL_FALLBACK || 'gpt-4o-mini';

            const buildUserPrompt = (maxChars) => {
                const safeMarkdown = markdownContent ? markdownContent.slice(0, maxChars) : 'No page content available.';
                const technicalSummary = JSON.stringify(
                    {
                        openPorts: reconData.systems.map((s) => s.ports?.results).flat(),
                        headers: reconData.systems.map((s) => s.headers),
                        dns: reconData.dns,
                        ssl: reconData.ssl,
                        firewall: reconData.firewall
                    },
                    null,
                    2
                );

                return `
Target: ${reconData.target}
Technical Scan Data:
${technicalSummary}

Scraped Page Content (Excerpt):
${safeMarkdown}
`;
            };

            const runModel = async ({ model, maxMarkdownChars, maxTokens }) => {
                const completion = await this.openai.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: buildUserPrompt(maxMarkdownChars) }
                    ],
                    response_format: { type: 'json_object' },
                    max_tokens: maxTokens
                });
                const content = completion?.choices?.[0]?.message?.content;
                if (!content || typeof content !== 'string') {
                    throw new Error('LLM response was empty or malformed');
                }
                return JSON.parse(content);
            };

            const maxRetries = 2;
            let lastError = null;
            let primaryFailureKind = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await runModel({ model: primaryModel, maxMarkdownChars: 15000, maxTokens: 900 });
                } catch (error) {
                    if (isAbortError(error)) throw error;
                    const info = classifyOpenAiError(error);
                    lastError = error;
                    primaryFailureKind = info.kind;

                    if (info.kind === 'insufficient_quota') break;
                    if (info.kind !== 'rate_limit' && info.kind !== 'transient') break;
                    if (attempt >= maxRetries) break;

                    const delayMs = backoffDelayMs(attempt, info.retryAfterMs);
                    await sleep(delayMs);
                }
            }

            if (primaryFailureKind === 'rate_limit' || primaryFailureKind === 'insufficient_quota') {
                try {
                    return await runModel({ model: fallbackModel, maxMarkdownChars: 8000, maxTokens: 750 });
                } catch (error) {
                    if (isAbortError(error)) throw error;
                    lastError = error;
                }
            }

            const classified = classifyOpenAiError(lastError);
            const reason =
                classified.kind === 'rate_limit'
                    ? 'Service temporarily rate-limited'
                    : classified.kind === 'insufficient_quota'
                        ? 'Service quota exceeded'
                        : 'Service unavailable';

            return computeHeuristicAnalysis(reconData, reason);
        } catch (error) {
            if (isAbortError(error)) throw error;
            console.error(`[LLM] Analysis failed: ${error?.message || String(error)}`);
            return computeHeuristicAnalysis(reconData, 'Service unavailable');
        }
    }
}

export const llmService = new LLMService();

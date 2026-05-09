
import { getSSLInfo } from '../sslInfo.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonDomainAgeSupported = null;

function parseDateToMs(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function getDomainAgePyTimeoutMs(overrideMs) {
    if (Number.isFinite(Number(overrideMs))) return Math.max(250, Number(overrideMs));
    const raw = process.env.DOMAIN_AGE_PY_TIMEOUT_MS;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(250, n) : 5000;
}

async function runPythonDomainAgeLookup(hostname, { timeoutMs } = {}) {
    if (!hostname || typeof hostname !== 'string') return null;
    if (pythonDomainAgeSupported === false) return null;

    const scriptPath = path.join(__dirname, 'domain_age_lookup.py');
    const pyTimeoutMs = getDomainAgePyTimeoutMs(timeoutMs);
    const candidates = [
        { cmd: 'python', baseArgs: [scriptPath] },
        { cmd: 'python3', baseArgs: [scriptPath] },
        { cmd: 'py', baseArgs: ['-3', scriptPath] }
    ];

    const run = (cmd, baseArgs) =>
        new Promise((resolve) => {
            const child = spawn(cmd, [...baseArgs, hostname], { stdio: ['ignore', 'pipe', 'pipe'] });
            let out = '';
            const timer = setTimeout(() => {
                try {
                    child.kill();
                } catch {
                    // ignore
                }
                resolve(null);
            }, pyTimeoutMs);

            child.stdout.on('data', (d) => {
                out += d.toString('utf8');
            });
            child.on('error', (err) => {
                clearTimeout(timer);
                resolve({ __error: err });
            });
            child.on('close', () => {
                clearTimeout(timer);
                const text = (out || '').trim();
                if (!text) return resolve(null);
                try {
                    const parsed = JSON.parse(text);
                    if (!parsed || parsed.ok !== true) return resolve(null);
                    pythonDomainAgeSupported = true;
                    resolve(parsed);
                } catch {
                    resolve(null);
                }
            });
        });

    let missingCount = 0;
    for (const c of candidates) {
        const res = await run(c.cmd, c.baseArgs);
        if (res && typeof res === 'object' && '__error' in res) {
            if (res.__error && res.__error.code === 'ENOENT') missingCount += 1;
            continue;
        }
        if (res) return res;
    }
    if (missingCount === candidates.length) pythonDomainAgeSupported = false;
    return null;
}

export const runPhishingDetect = async (target, options = {}) => {
    const raw = typeof target === 'string' ? target : String(target ?? '');
    const hostname = raw.replace(/^https?:\/\//, '').split('/')[0];

    const suspiciousKeywords = ['login', 'verify', 'secure', 'account', 'update', 'banking', 'signin'];
    const urlLower = raw.toLowerCase();
    const foundKeywords = suspiciousKeywords.filter((k) => urlLower.includes(k));

    let sslValid = null;
    let sslIssuer = 'Unknown';
    try {
        const ssl = await getSSLInfo(hostname);
        const validToMs = parseDateToMs(ssl?.validTo);
        sslIssuer = ssl?.issuer?.O || ssl?.issuer?.CN || 'Unknown';
        sslValid = validToMs == null ? null : validToMs > Date.now();
    } catch {
        sslValid = null;
    }

    const domainAgeLookup = typeof options?.domainAgeLookup === 'function' ? options.domainAgeLookup : null;
    const pyEnabled = options?.domainAgePyLookupEnabled ?? process.env.DOMAIN_AGE_PY_LOOKUP === '1';

    let domainAgeDays = null;
    let domainAgeCreated = null;
    let domainAgeDomain = null;

    try {
        const res = domainAgeLookup
            ? await domainAgeLookup(hostname)
            : pyEnabled
              ? await runPythonDomainAgeLookup(hostname, { timeoutMs: options?.domainAgePyTimeoutMs })
              : null;

        const ageDaysNum = typeof res?.age_days === 'number' ? res.age_days : typeof res?.ageDays === 'number' ? res.ageDays : null;
        domainAgeDays = Number.isFinite(ageDaysNum) ? ageDaysNum : null;
        domainAgeCreated = typeof res?.created === 'string' ? res.created : null;
        domainAgeDomain = typeof res?.domain === 'string' ? res.domain : null;
    } catch {
        domainAgeDays = null;
    }

    const youngDomain = domainAgeDays != null ? domainAgeDays < 365 : null;
    const sslBad = sslValid === false;
    const ageBad = youngDomain === true;

    const isSuspicious = foundKeywords.length > 0 || sslBad || ageBad;
    let score = isSuspicious ? (foundKeywords.length * 20) + 30 : 10;
    if (ageBad) score += 20;
    if (score > 100) score = 100;

    const indicators = [];
    indicators.push(foundKeywords.length > 0 ? `Suspicious keywords found: ${foundKeywords.join(', ')}` : 'No suspicious keywords in URL');
    indicators.push(sslValid === true ? `Valid SSL Certificate issued by ${sslIssuer}` : sslValid === false ? 'SSL Certificate missing or invalid' : 'SSL Certificate check unavailable');

    if (domainAgeDays != null) {
        const createdPart = domainAgeCreated ? ` (Created: ${domainAgeCreated})` : '';
        const domainPart = domainAgeDomain ? `Domain age for ${domainAgeDomain}: ` : 'Domain age: ';
        indicators.push(`${domainPart}${domainAgeDays} days${createdPart}`);
    } else {
        indicators.push('Domain age: Unknown');
    }

    return {
        module: 'PhishingDetect',
        risk: score > 70 ? 'Critical' : score > 40 ? 'High' : score > 20 ? 'Medium' : 'Low',
        data: {
            url: raw,
            phishing_score: score,
            indicators,
            safe_browsing_status: 'Clean (Simulated)',
            recommendation: isSuspicious ? 'Do not visit this URL.' : 'URL appears safe.'
        }
    };
};

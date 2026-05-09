import * as dns from 'dns/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonEmailDisposableSupported = null;

function getEmailPyTimeoutMs(overrideMs) {
    if (Number.isFinite(Number(overrideMs))) return Math.max(250, Number(overrideMs));
    const raw = process.env.EMAIL_PY_TIMEOUT_MS;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(250, n) : 2000;
}

async function runPythonEmailDisposableLookup(domain, { timeoutMs } = {}) {
    if (!domain || typeof domain !== 'string') return null;
    if (pythonEmailDisposableSupported === false) return null;

    const scriptPath = path.join(__dirname, 'email_disposable_lookup.py');
    const listPath = process.env.EMAIL_DISPOSABLE_LIST_PATH || path.join(__dirname, 'disposable_domains.txt');
    const pyTimeoutMs = getEmailPyTimeoutMs(timeoutMs);
    const candidates = [
        { cmd: 'python', baseArgs: [scriptPath, listPath] },
        { cmd: 'python3', baseArgs: [scriptPath, listPath] },
        { cmd: 'py', baseArgs: ['-3', scriptPath, listPath] }
    ];

    const run = (cmd, baseArgs) =>
        new Promise((resolve) => {
            const child = spawn(cmd, [...baseArgs, domain], { stdio: ['ignore', 'pipe', 'pipe'] });
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
                    pythonEmailDisposableSupported = true;
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
    if (missingCount === candidates.length) pythonEmailDisposableSupported = false;
    return null;
}

function detectMxProvider(mxRecords) {
    const exchanges = Array.isArray(mxRecords) ? mxRecords.map((m) => String(m?.exchange || '')).filter(Boolean) : [];
    const joined = exchanges.join(' ').toLowerCase();

    if (!joined) return null;
    if (joined.includes('google.com') || joined.includes('googlemail.com') || joined.includes('aspmx.l.google.com')) return 'Google Workspace';
    if (joined.includes('outlook.com') || joined.includes('protection.outlook.com') || joined.includes('mail.protection') || joined.includes('office365'))
        return 'Microsoft 365 / Exchange Online';
    if (joined.includes('yahoodns.net') || joined.includes('yahoo.com')) return 'Yahoo Mail';
    if (joined.includes('pphosted.com')) return 'Proofpoint';
    if (joined.includes('mimecast.com')) return 'Mimecast';
    if (joined.includes('icloud.com') || joined.includes('mail.icloud.com')) return 'iCloud Mail';
    if (joined.includes('zoho.com')) return 'Zoho Mail';
    return 'Custom / Other';
}

export const runEmailValidator = async (target, options = {}) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(target)) {
        throw new Error('Invalid email format');
    }

    const [user, domain] = target.split('@');
    
    // 1. Disposable Check (Mock list)
    const disposableDomains = ['tempmail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com'];
    let isDisposable = disposableDomains.includes(domain);
    let disposableSource = isDisposable ? 'builtin' : null;

    const disposableLookup = typeof options?.disposableLookup === 'function' ? options.disposableLookup : null;
    const pyEnabled = options?.emailDisposablePyLookupEnabled ?? process.env.EMAIL_PY_DISPOSABLE_LOOKUP === '1';
    if (!isDisposable) {
        try {
            const res = disposableLookup
                ? await disposableLookup(domain)
                : pyEnabled
                  ? await runPythonEmailDisposableLookup(domain, { timeoutMs: options?.emailPyTimeoutMs })
                  : null;
            if (res && typeof res.is_disposable === 'boolean') {
                isDisposable = res.is_disposable;
                disposableSource = isDisposable ? res.source || 'python' : null;
            }
        } catch {
            // ignore
        }
    }

    // 2. MX Record Check
    let mxRecords = [];
    let mxValid = false;
    let mxLookupStatus = 'unknown';
    let mxLookupError = null;
    try {
        const resolveMx = typeof options?.resolveMx === 'function' ? options.resolveMx : dns.resolveMx;
        const mx = await resolveMx(domain);
        mxRecords = mx.sort((a, b) => a.priority - b.priority);
        mxValid = mxRecords.length > 0;
        mxLookupStatus = mxValid ? 'ok' : 'no_mx';
    } catch (e) {
        mxLookupStatus = 'dns_error';
        mxLookupError = e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' ? e.code : 'DNS_LOOKUP_FAILED';
    }
    const mxProvider = mxValid ? detectMxProvider(mxRecords) : null;

    // 3. Risk Calculation
    let risk = 'Low';
    if (isDisposable) risk = 'High';
    else if (mxLookupStatus === 'dns_error') risk = 'Medium';
    else if (!mxValid) risk = 'Medium';

    return {
        module: 'EmailValidator',
        risk: risk,
        data: {
            email: target,
            valid_syntax: true,
            domain: domain,
            is_disposable: isDisposable,
            mx_records: mxRecords.map(m => `${m.priority} ${m.exchange}`),
            mx_provider: mxProvider,
            mx_lookup_status: mxLookupStatus,
            mx_lookup_error: mxLookupError,
            disposable_source: disposableSource,
            deliverable: mxLookupStatus === 'dns_error' ? 'Unknown' : mxValid ? 'Likely' : 'Unlikely',
            breach_count: 0 
        }
    };
};

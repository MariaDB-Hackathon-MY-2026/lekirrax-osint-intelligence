import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonLookupSupported = null;

function getPythonTimeoutMs(overrideMs) {
    if (Number.isFinite(Number(overrideMs))) return Math.max(250, Number(overrideMs));
    const raw = process.env.PHONE_PY_TIMEOUT_MS;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(250, n) : 5000;
}

async function runPythonPhoneLookup(e164, { timeoutMs } = {}) {
    if (!e164 || typeof e164 !== 'string') return null;
    if (pythonLookupSupported === false) return null;
    const scriptPath = path.join(__dirname, 'phone_lookup.py');
    const pyTimeoutMs = getPythonTimeoutMs(timeoutMs);
    const candidates = [
        { cmd: 'python', baseArgs: [scriptPath] },
        { cmd: 'python3', baseArgs: [scriptPath] },
        { cmd: 'py', baseArgs: ['-3', scriptPath] }
    ];

    const run = (cmd, baseArgs) =>
        new Promise((resolve) => {
            const child = spawn(cmd, [...baseArgs, e164], { stdio: ['ignore', 'pipe', 'pipe'] });
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
                    pythonLookupSupported = true;
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
    if (missingCount === candidates.length) pythonLookupSupported = false;
    return null;
}

export const runPhoneInvestigator = async (target, options = {}) => {
    const raw = typeof target === 'string' ? target : String(target ?? '');
    const normalizedDigits = raw.replace(/\D/g, '');
    const canonicalInput = raw.trim().startsWith('+') ? `+${normalizedDigits}` : raw.trim();

    const parsed = parsePhoneNumberFromString(canonicalInput);
    const isPossible = parsed ? parsed.isPossible() : false;
    const isValid = parsed ? parsed.isValid() : false;

    const e164 = parsed ? parsed.number : normalizedDigits ? `+${normalizedDigits}` : null;
    const callingCode = parsed ? String(parsed.countryCallingCode) : null;
    const countryIso2 = parsed ? parsed.country || null : null;
    const national = parsed ? parsed.formatNational() : null;
    const international = parsed ? parsed.formatInternational() : null;

    let numberType = null;
    try {
        numberType = parsed ? parsed.getType() : null;
    } catch {
        numberType = null;
    }

    const pyLookupEnabled = options?.pyLookupEnabled ?? process.env.PHONE_PY_LOOKUP === '1';
    const py = pyLookupEnabled && e164 ? await runPythonPhoneLookup(e164, { timeoutMs: options?.pyTimeoutMs }) : null;
    const carrierName = typeof py?.carrier === 'string' && py.carrier.trim() ? py.carrier.trim() : null;
    const timeZones = Array.isArray(py?.time_zones) ? py.time_zones.filter((z) => typeof z === 'string') : [];
    const description = typeof py?.description === 'string' && py.description.trim() ? py.description.trim() : null;

    const risk = !isPossible ? 'Medium' : isValid ? 'Low' : 'Medium';

    return {
        module: 'PhoneInvestigator',
        risk: risk,
        data: {
            target: raw,
            original_input: raw,
            e164,
            clean_number: e164,
            calling_code: callingCode,
            country: countryIso2,
            region: countryIso2,
            carrier: carrierName,
            time_zones: timeZones,
            description,
            format_international: international,
            format_national: national,
            line_type: numberType,
            possible: isPossible,
            valid: isValid,
            location_approx: countryIso2,
            owner_info: 'Not available from phone number alone. Consent-based carrier lookup required.',
            whatsapp_registered: null,
            telegram_registered: null
        }
    };
};

import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonLookupSupported = null;

async function runPythonPhoneLookup(e164) {
    if (!e164 || typeof e164 !== 'string') return null;
    if (pythonLookupSupported === false) return null;
    const scriptPath = path.join(__dirname, 'phone_lookup.py');
    const candidates = [
        { cmd: 'python', args: [scriptPath, e164] },
        { cmd: 'py', args: ['-3', scriptPath, e164] }
    ];

    const run = (cmd, args) =>
        new Promise((resolve) => {
            const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let out = '';
            let err = '';
            const timer = setTimeout(() => {
                try {
                    child.kill();
                } catch {
                    // ignore
                }
                pythonLookupSupported = false;
                resolve(null);
            }, 1200);

            child.stdout.on('data', (d) => {
                out += d.toString('utf8');
            });
            child.stderr.on('data', (d) => {
                err += d.toString('utf8');
            });
            child.on('error', () => {
                clearTimeout(timer);
                pythonLookupSupported = false;
                resolve(null);
            });
            child.on('close', () => {
                clearTimeout(timer);
                const text = (out || err || '').trim();
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

    for (const c of candidates) {
        const res = await run(c.cmd, c.args);
        if (res) return res;
    }
    return null;
}

export const runPhoneInvestigator = async (target) => {
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

    const pyLookupEnabled = process.env.PHONE_PY_LOOKUP === '1';
    const py = pyLookupEnabled && e164 ? await runPythonPhoneLookup(e164) : null;
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

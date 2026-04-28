import { runAssetRadar } from './assetRadar.js';
import { runAliasFinder } from './aliasFinder.js';
import { runLeakCheck } from './leakCheck.js';
import { runGeoSpy } from './geoSpy.js';
import { runCodeHunter } from './codeHunter.js';
import { runPhishingDetect } from './phishingDetect.js';
import { runEmailValidator } from './emailValidator.js';
import { runPhoneInvestigator } from './phoneInvestigator.js';
import { runGoogleDorking } from './googleDorking.js';

const modules = {
    'asset-radar': runAssetRadar,
    'alias-finder': runAliasFinder,
    'leak-check': runLeakCheck,
    'geo-spy': runGeoSpy,
    'code-hunter': runCodeHunter,
    'phishing-detect': runPhishingDetect,
    'email-validator': runEmailValidator,
    'phone-investigator': runPhoneInvestigator,
    'google-dorking': runGoogleDorking
};

// Internal Cache (In-Memory)
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

async function getCachedResult(moduleName, target) {
    const cacheKey = `${moduleName}:${target}`;
    
    // 1. Check In-Memory Cache
    if (cache.has(cacheKey)) {
        const { timestamp, data } = cache.get(cacheKey);
        if (Date.now() - timestamp < CACHE_TTL) {
            console.log(`[OSINT] Memory Cache Hit: ${cacheKey}`);
            return data;
        }
    }

    return null;
}

export const runOsintModule = async (moduleName, target) => {
    const runner = modules[moduleName];
    if (!runner) {
        throw new Error(`OSINT module '${moduleName}' not found`);
    }

    // Check Cache first
    const cached = await getCachedResult(moduleName, target);
    if (cached) return cached;

    // Execute with performance monitoring
    const start = performance.now();
    const result = await runner(target);
    const end = performance.now();
    
    console.log(`[OSINT] Module ${moduleName} took ${(end - start).toFixed(2)}ms`);

    // Store in memory cache
    cache.set(`${moduleName}:${target}`, { timestamp: Date.now(), data: result });

    return result;
};

export const getAvailableModules = () => Object.keys(modules);

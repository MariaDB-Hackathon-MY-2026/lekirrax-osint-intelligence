import dns from 'dns/promises';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Retrieves WHOIS data using WhoisXMLAPI if a key is provided,
 * otherwise falls back to RDAP and DNS SOA checks.
 */
export async function getWhoisInfo(domain) {
    const info = {
        registrar: null,
        registeredDate: null,
        expiryDate: null,
        updatedDate: null,
        status: null,
        nameServers: []
    };

    const apiKey = process.env.WHOIS_API_KEY;

    try {
        // 1. Try WhoisXMLAPI if key is available
        if (apiKey) {
            console.log(`[WHOIS] Using API Key for ${domain}...`);
            const apiUrl = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${domain}&outputFormat=JSON`;
            
            const res = await fetch(apiUrl);
            if (res.ok) {
                const data = await res.json();
                const record = data.WhoisRecord;

                if (record) {
                    info.registrar = record.registrarName;
                    info.registeredDate = record.createdDate;
                    info.expiryDate = record.expiresDate;
                    info.updatedDate = record.updatedDate;
                    info.status = Array.isArray(record.status) ? record.status[0] : record.status;
                    info.nameServers = record.nameServers?.hostNames || [];
                    
                    // If we got valid data, return early
                    if (info.registrar || info.registeredDate) return info;
                }
            } else {
                console.warn(`[WHOIS] API call failed with status: ${res.status}`);
            }
        }

        // 2. Fallback to DNS NS lookup
        try {
            const ns = await dns.resolveNs(domain);
            info.nameServers = ns;
        } catch {}

        // 3. Fallback to RDAP (Free, no key required)
        try {
            const res = await fetch(`https://rdap.org/domain/${domain}`);
            if (res.ok) {
                const data = await res.json();
                
                const registrarEntity = data.entities?.find(e => e.roles?.includes('registrar'));
                if (registrarEntity) {
                    info.registrar = registrarEntity.vcardArray?.[1]?.find(x => x[0] === 'fn')?.[3];
                }

                const events = data.events || [];
                events.forEach(ev => {
                    if (ev.eventAction === 'registration') info.registeredDate = ev.eventDate;
                    if (ev.eventAction === 'expiration') info.expiryDate = ev.eventDate;
                    if (ev.eventAction === 'last changed') info.updatedDate = ev.eventDate;
                });

                info.status = data.status?.[0];
            }
        } catch (e) {}

    } catch (e) {
        console.error(`[WHOIS] Error for ${domain}:`, e.message);
    }

    return info;
}

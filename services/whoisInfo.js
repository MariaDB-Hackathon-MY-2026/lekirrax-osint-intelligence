
import dns from 'dns/promises';

/**
 * Placeholder for WHOIS data.
 * Real WHOIS requires a library like 'whois-json' or an external API.
 * For now, we simulate or do a basic DNS SOA check which gives some info.
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

    try {
        // We can get NS from DNS
        const ns = await dns.resolveNs(domain);
        info.nameServers = ns;

        // Try to get SOA record for email/serial
        const soa = await dns.resolveSoa(domain);
        if (soa) {
            // SOA doesn't give registrar directly but gives primary NS and contact
        }
        
        // Without an API or 'whois' shell command, we can't reliably get Registrar/Dates in Node.js pure env easily.
        // If 'whois' command exists in system, we could use child_process.
        // But for this environment, let's mark as "Not detected" or "Check Manually" if we can't get it.
        // Or we can try a public API if one exists without key.
        // `rdap.org` is a good candidate for RDAP (modern WHOIS).

        try {
            const res = await fetch(`https://rdap.org/domain/${domain}`);
            if (res.ok) {
                const data = await res.json();
                
                // RDAP parsing
                // Registrar
                const registrarEntity = data.entities?.find(e => e.roles?.includes('registrar'));
                if (registrarEntity) {
                    info.registrar = registrarEntity.vcardArray?.[1]?.find(x => x[0] === 'fn')?.[3];
                }

                // Dates
                const events = data.events || [];
                events.forEach(ev => {
                    if (ev.eventAction === 'registration') info.registeredDate = ev.eventDate;
                    if (ev.eventAction === 'expiration') info.expiryDate = ev.eventDate;
                    if (ev.eventAction === 'last changed') info.updatedDate = ev.eventDate;
                });

                // Status
                info.status = data.status?.[0];
            }
        } catch (e) {
            // RDAP failed
        }

    } catch (e) {
        // DNS failed
    }

    return info;
}

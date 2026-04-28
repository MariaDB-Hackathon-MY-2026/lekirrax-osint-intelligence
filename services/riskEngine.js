export function calculateRiskScore(system, firewallInfo) {
    let score = 0;
    const reasons = [];

    // Ports (from your portsInfo.js)
    const ports = system.ports?.results || [];

    for (const p of ports) {
        if (p.status !== 'open') continue;

        if (p.port === 22) {
        score += 20;
        reasons.push('SSH port (22) exposed');
        }

        if (p.port === 3389) {
        score += 25;
        reasons.push('RDP port (3389) exposed');
        }

        if ([3306, 5432].includes(p.port)) {
        score += 30;
        reasons.push('Database service exposed');
        }

        if ([25, 110, 143].includes(p.port)) {
        score += 10;
        reasons.push('Mail service exposed');
        }
    }

    // Firewall
    if (!firewallInfo?.firewall) {
        score += 25;
        reasons.push('No firewall detected');
    } else {
        score -= 10;
    }

    // ASN / Hosting
    const asn = (system.asn || '').toLowerCase();
    if (
        asn.includes('amazon') ||
        asn.includes('google') ||
        asn.includes('microsoft') ||
        asn.includes('digitalocean') ||
        asn.includes('linode') ||
        asn.includes('cloudflare')
    ) {
        score += 10;
        reasons.push('Cloud hosting environment detected');
    }

    // Header exposure
    const serverHeader = system.headers?.headers?.server;
    if (serverHeader && /\d+(\.\d+)?/.test(serverHeader)) {
        score += 10;
        reasons.push('Server version disclosed in headers');
    }

    // Clamp score
    score = Math.min(100, Math.max(0, score));

    // Risk level
    let level = 'Low';
    if (score > 20) level = 'Medium';
    if (score > 50) level = 'High';
    if (score > 75) level = 'Critical';

    return {
        score,
        level,
        reasons
    };
    }
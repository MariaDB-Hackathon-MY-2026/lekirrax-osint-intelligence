import net from 'net';

/**
 * Common TCP ports (safe OSINT scan)
 */
const COMMON_PORTS = [
    21, 22, 25, 53, 80, 110, 143,
    443, 465, 587, 993, 995,
    3306, 3389, 5432,
    5900, 8080, 8443
    ];

    /**
     * Port → service mapping
     */
    const SERVICE_MAP = {
    21: 'FTP',
    22: 'SSH',
    25: 'SMTP',
    53: 'DNS',
    80: 'HTTP',
    110: 'POP3',
    143: 'IMAP',
    443: 'HTTPS',
    465: 'SMTPS',
    587: 'SMTP Submission',
    993: 'IMAPS',
    995: 'POP3S',
    3306: 'MySQL',
    3389: 'RDP',
    5432: 'PostgreSQL',
    5900: 'VNC',
    8080: 'HTTP-Alt',
    8443: 'HTTPS-Alt'
    };

    function checkPort(host, port, timeout = 400) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        let status = 'closed';

        socket.setTimeout(timeout);

        socket.once('connect', () => {
        status = 'open';
        socket.destroy();
        });

        socket.once('timeout', () => socket.destroy());
        socket.once('error', () => socket.destroy());

        socket.once('close', () => {
        resolve({
            port,
            service: SERVICE_MAP[port] || 'unknown',
            status
        });
        });

        socket.connect(port, host);
    });
    }

    export async function getPortsInfo(host) {
    const start = Date.now();

    const results = await Promise.all(
        COMMON_PORTS.map(p => checkPort(host, p))
    );

    return {
        target: host,
        scanned_ports: COMMON_PORTS.length,
        open_count: results.filter(p => p.status === 'open').length,
        duration_ms: Date.now() - start,

        // 🔥 THIS IS THE KEY FIX
        results
    };
    }
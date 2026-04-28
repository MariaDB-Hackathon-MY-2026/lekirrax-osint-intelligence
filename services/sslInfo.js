import tls from 'tls';
import net from 'net';

/**
 * Retrieves SSL/TLS information from a given socket.
 * @param {tls.TLSSocket} socket - The TLS socket to extract information from.
 * @returns {Object} An object containing SSL/TLS details.
 */
function fetchTlsCertificate(hostname, { timeoutMs = 6000 } = {}) {
    return new Promise((resolve, reject) => {
        const isIp = net.isIP(hostname) !== 0;
        const options = {
            host: hostname,
            port: 443,
            rejectUnauthorized: false,
            servername: isIp ? undefined : hostname
        };

        const socket = tls.connect(options);

        const timeout = setTimeout(() => {
            socket.destroy(new Error('TLS connection timeout'));
        }, timeoutMs);

        socket.once('secureConnect', () => {
            clearTimeout(timeout);
            const cert = socket.getPeerCertificate(true);

            if (!cert || Object.keys(cert).length === 0) {
                socket.end();
                reject(new Error('No certificate found'));
                return;
            }

            socket.end();
            resolve(cert);
        });

        socket.once('error', (err) => {
            clearTimeout(timeout);
            reject(new Error(`TLS connection error: ${err.message}`));
        });
    });
}

export async function getSSLInfo(hostname) {
    const candidates = [hostname];
    if (typeof hostname === 'string' && hostname && !hostname.toLowerCase().startsWith('www.')) {
        candidates.push(`www.${hostname}`);
    }

    let lastError = null;
    for (const candidate of candidates) {
        try {
            const cert = await fetchTlsCertificate(candidate);
            const validFrom = cert.valid_from || null;
            const validTo = cert.valid_to || null;

            return {
                subject: cert.subject,
                issuer: cert.issuer,
                validFrom,
                validForm: validFrom,
                validTo,
                serialNumber: cert.serialNumber,
                fingerprint: cert.fingerprint,
                fingerprint256: cert.fingerprint256,
                extKeyUsage: cert.ext_key_usage || [],
                subjectaltname: cert.subjectaltname
                    ? cert.subjectaltname.replace(/DNS:/g, '').split(', ')
                    : []
            };
        } catch (e) {
            lastError = e;
        }
    }

    throw lastError || new Error('No certificate found');
}

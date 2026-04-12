import { get } from 'http';
import tls from 'tls';

/**
 * Retrieves SSL/TLS information from a given socket.
 * @param {tls.TLSSocket} socket - The TLS socket to extract information from.
 * @returns {Object} An object containing SSL/TLS details.
 */
export function getSSLInfo(hostname) {
    return new Promise ((resolve, reject) => {
        const options = {
            host: hostname,
            port: 443,
            rejectUnauthorized: false,
        };
        const socket = tls.connect(options, () => {
            const cert = socket.getPeerCertificate(true);

            if (!cert || Object.keys(cert).length === 0) {
                reject(new Error('No certificate found'));
            socket.end();
                return;
            }

            resolve({
                subject: cert.subject,
                issuer: cert.issuer,
                validForm: cert.valid_from,
                validTo: cert.valid_to,
                serialNumber: cert.serialNumber,
                fingerprint: cert.fingerprint,
                fingerprint256: cert.fingerprint256,
                extKeyUsage: cert.ext_key_usage || [],
                subjectaltname: cert.subjectaltname
                    ? cert.subjectaltname.replace(/DNS:/g, '').split(', ')
                    : [],
            });
            socket.end();
        });
        socket.on('error', (err) => {
            reject(new Error(`TLS connection error: ${err.message}`));
        });
    });
}
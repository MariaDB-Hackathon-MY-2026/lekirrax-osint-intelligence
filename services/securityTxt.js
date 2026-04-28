
import fetch from 'node-fetch';

/**
 * Checks for security.txt file
 */
export async function getSecurityTxt(domain) {
    const paths = [
        `https://${domain}/.well-known/security.txt`,
        `https://${domain}/security.txt`
    ];

    const info = {
        present: false,
        contact: null,
        encryption: null,
        policy: null,
        expires: null
    };

    for (const url of paths) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(url, { 
                signal: controller.signal,
                redirect: 'follow'
            });
            clearTimeout(timeout);

            if (res.status === 200) {
                const text = await res.text();
                // Basic validation it's a security.txt file
                if (text.includes('Contact:') || text.includes('Encryption:') || text.includes('Policy:')) {
                    info.present = true;
                    
                    const lines = text.split('\n');
                    for (const line of lines) {
                        if (line.toLowerCase().startsWith('contact:')) info.contact = line.split(':', 2)[1]?.trim();
                        if (line.toLowerCase().startsWith('encryption:')) info.encryption = line.split(':', 2)[1]?.trim();
                        if (line.toLowerCase().startsWith('policy:')) info.policy = line.split(':', 2)[1]?.trim();
                        if (line.toLowerCase().startsWith('expires:')) info.expires = line.split(':', 2)[1]?.trim();
                    }
                    break; // Found it
                }
            }
        } catch (e) {
            // continue
        }
    }

    return info;
}


import { getSSLInfo } from '../sslInfo.js';

export const runPhishingDetect = async (target) => {
    // 1. Keyword Analysis
    const suspiciousKeywords = ['login', 'verify', 'secure', 'account', 'update', 'banking', 'signin'];
    const urlLower = target.toLowerCase();
    const foundKeywords = suspiciousKeywords.filter(k => urlLower.includes(k));
    
    // 2. SSL Check (Real check)
    let sslData = { valid: false, issuer: 'Unknown' };
    try {
        // Assume target is hostname for SSL check
        const hostname = target.replace(/^https?:\/\//, '').split('/')[0];
        const ssl = await getSSLInfo(hostname);
        if (ssl && !ssl.error) {
            sslData = {
                valid: ssl.valid,
                issuer: ssl.issuer?.O || ssl.issuer?.CN || 'Unknown',
                expires: ssl.valid_to
            };
        }
    } catch (e) {
        // SSL check might fail for non-hostnames
    }

    // 3. Domain Reputation (Mock)
    const isSuspicious = foundKeywords.length > 0 || !sslData.valid;
    const score = isSuspicious ? (foundKeywords.length * 20) + 30 : 10;
    
    return {
        module: 'PhishingDetect',
        risk: score > 70 ? 'Critical' : score > 40 ? 'High' : score > 20 ? 'Medium' : 'Low',
        data: {
            url: target,
            phishing_score: score,
            indicators: [
                foundKeywords.length > 0 ? `Suspicious keywords found: ${foundKeywords.join(', ')}` : 'No suspicious keywords in URL',
                sslData.valid ? `Valid SSL Certificate issued by ${sslData.issuer}` : 'SSL Certificate missing or invalid',
                'Domain age analysis (Simulated): < 1 year'
            ],
            safe_browsing_status: 'Clean (Simulated)',
            recommendation: isSuspicious ? 'Do not visit this URL.' : 'URL appears safe.'
        }
    };
};

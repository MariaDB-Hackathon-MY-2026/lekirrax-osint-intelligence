import dns from 'dns/promises';

export const runEmailValidator = async (target) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(target)) {
        throw new Error('Invalid email format');
    }

    const [user, domain] = target.split('@');
    
    // 1. Disposable Check (Mock list)
    const disposableDomains = ['tempmail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com'];
    const isDisposable = disposableDomains.includes(domain);

    // 2. MX Record Check
    let mxRecords = [];
    let mxValid = false;
    try {
        const mx = await dns.resolveMx(domain);
        mxRecords = mx.sort((a, b) => a.priority - b.priority);
        mxValid = mxRecords.length > 0;
    } catch (e) {
        // MX lookup failed
    }

    // 3. Risk Calculation
    let risk = 'Low';
    if (isDisposable) risk = 'High';
    if (!mxValid) risk = 'Medium'; // Could just be a non-existent domain

    return {
        module: 'EmailValidator',
        risk: risk,
        data: {
            email: target,
            valid_syntax: true,
            domain: domain,
            is_disposable: isDisposable,
            mx_records: mxRecords.map(m => `${m.priority} ${m.exchange}`),
            deliverable: mxValid ? 'Likely' : 'Unlikely',
            breach_count: 0 // Would come from leak-check module
        }
    };
};

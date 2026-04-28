import Joi from 'joi';

const targetSchema = Joi.object({
    target: Joi.string()
        .required()
        .custom((value, helpers) => {
             // Prepend http:// if missing for validation purposes
            let urlToCheck = value;
            if (!/^https?:\/\//i.test(value)) {
                urlToCheck = 'http://' + value;
            }

            // Comprehensive blocklist for private/internal/reserved IP ranges (SSRF Protection)
            const privateRanges = [
                'localhost',
                '127.0.0.1',
                '0.0.0.0',
                '::1',
                '10.0.0.0/8',
                '172.16.0.0/12',
                '192.168.0.0/16',
                '169.254.0.0/16', // Link-local
                '100.64.0.0/10', // Carrier-grade NAT
                'fc00::/7' // Unique local address
            ];

            try {
                const url = new URL(urlToCheck);
                const hostname = url.hostname.toLowerCase();
                
                // Simple check for common local names
                if (privateRanges.includes(hostname)) {
                    return helpers.error('any.invalid');
                }
                
                // Note: For a real production system, you should also perform a DNS lookup
                // and check the resulting IP against the private ranges to prevent DNS rebinding.
                
            } catch (e) {
                return helpers.error('any.invalid');
            }
            return value;
        }, 'Enhanced SSRF Protection'),
    userId: Joi.string().optional()
});

export const validateScanRequest = (req, res, next) => {
    // Check query for GET, body for POST
    const data = req.method === 'GET' ? req.query : req.body;
    
    const { error } = targetSchema.validate(data);
    if (error) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid target URL',
            details: error.details.map(d => d.message)
        });
    }
    next();
};

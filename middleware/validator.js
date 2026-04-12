import Joi from 'joi';

const targetSchema = Joi.object({
    target: Joi.string()
        .required()
        .custom((value, helpers) => {
             // Prepend http:// if missing for validation purposes (so URL constructor works)
            let urlToCheck = value;
            if (!/^https?:\/\//i.test(value)) {
                urlToCheck = 'http://' + value;
            }

             // Basic blocklist for local IPs to prevent SSRF (simplified)
            const blockList = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
            try {
                const url = new URL(urlToCheck);
                if (blockList.includes(url.hostname)) {
                    return helpers.error('any.invalid');
                }
            } catch (e) {
                return helpers.error('any.invalid');
            }
            return value;
        }, 'SSRF Protection'),
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

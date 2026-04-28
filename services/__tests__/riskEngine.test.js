import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../riskEngine.js';

describe('calculateRiskScore', () => {
    it('should assign correct scores for exposed ports', () => {
        const system = {
            ports: {
                results: [
                    { port: 22, status: 'open' },
                    { port: 3306, status: 'open' }
                ]
            }
        };
        const risk = calculateRiskScore(system, { firewall: true });
        // 20 (SSH) + 30 (DB) - 10 (Firewall) = 40
        expect(risk.score).toBe(40);
        expect(risk.level).toBe('Medium');
        expect(risk.reasons).toContain('SSH port (22) exposed');
        expect(risk.reasons).toContain('Database service exposed');
    });

    it('should penalize missing firewalls', () => {
        const system = { ports: { results: [] } };
        const risk = calculateRiskScore(system, { firewall: false });
        expect(risk.score).toBe(25);
        expect(risk.level).toBe('Medium');
        expect(risk.reasons).toContain('No firewall detected');
    });

    it('should clamp scores between 0 and 100', () => {
        const system = {
            ports: {
                results: [
                    { port: 22, status: 'open' },
                    { port: 3389, status: 'open' },
                    { port: 3306, status: 'open' },
                    { port: 5432, status: 'open' }
                ]
            }
        };
        const risk = calculateRiskScore(system, { firewall: false });
        // 20+25+30+30+25 = 130 -> Clamped to 100
        expect(risk.score).toBe(100);
        expect(risk.level).toBe('Critical');
    });
});

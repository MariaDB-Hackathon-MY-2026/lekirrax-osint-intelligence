import { describe, it, expect } from 'vitest';
import { normalizeTarget } from '../utils.js';

describe('normalizeTarget', () => {
    it('should normalize URLs with protocol and path', () => {
        expect(normalizeTarget('https://google.com/search?q=test')).toBe('google.com');
        expect(normalizeTarget('http://sub.example.com/path')).toBe('sub.example.com');
    });

    it('should handle raw hostnames', () => {
        expect(normalizeTarget('example.com')).toBe('example.com');
        expect(normalizeTarget('  EXAMPLE.COM  ')).toBe('example.com');
    });

    it('should throw error for invalid input', () => {
        expect(() => normalizeTarget('')).toThrow('Invalid target');
        expect(() => normalizeTarget(null)).toThrow('Invalid target');
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendationEngine } from '../recommendationEngine.js';
import { pool } from '../../database/index.js';

vi.mock('../../database/index.js', () => ({
    pool: {
        getConnection: vi.fn()
    }
}));

describe('RecommendationEngine', () => {
    let mockConn;

    beforeEach(() => {
        mockConn = {
            query: vi.fn(),
            release: vi.fn()
        };
        pool.getConnection.mockResolvedValue(mockConn);
    });

    it('should return cached recommendations if available', async () => {
        const mockRecs = [{ id: 1, score: 10 }];
        mockConn.query.mockResolvedValue([{ recommendations: mockRecs }]);

        const result = await recommendationEngine.getRecommendations(1);

        expect(result).toEqual(mockRecs);
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT recommendations'),
            [1]
        );
    });

    it('should generate new recommendations if cache is empty', async () => {
        mockConn.query.mockResolvedValueOnce([]); 
        
        mockConn.query.mockResolvedValueOnce([{ ports: '[80]', asn: 'AS123', weight: 10 }]);
        
        mockConn.query.mockResolvedValueOnce([{ id: 100, ports: '[80]', asn: 'AS123', risk_score: 50 }]);
        
        mockConn.query.mockResolvedValueOnce([{ item_id: 101, score: 15 }]);

        const result = await recommendationEngine.getRecommendations(1);

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('score');
    });

    it('should log interaction and invalidate cache', async () => {
        await recommendationEngine.logInteraction(1, 100, 'system', 'flag');

        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO user_interactions'),
            [1, 100, 'system', 'flag', 5]
        );
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM recommendation_cache'),
            [1]
        );
    });

    it('should merge scores correctly based on weights', () => {
        const contentScores = { '1': 10 };
        const collabScores = { '1': 20 };
        
        // content weight 0.4, collab weight 0.6
        // 10 * 0.4 + 20 * 0.6 = 4 + 12 = 16
        const result = recommendationEngine.mergeScores(contentScores, collabScores, 10);
        
        expect(result[0].score).toBe(16);
    });
});

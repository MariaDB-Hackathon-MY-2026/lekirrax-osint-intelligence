import { pool } from '../database/index.js';

export class RecommendationEngine {
    constructor() {
        this.weights = {
            content: 0.4,
            collaborative: 0.6
        };
        this.interactionWeights = {
            'view': 1,
            'click': 2,
            'flag': 5,
            'resolve': 10,
            'dismiss': -5
        };
    }

    /**
     * Gets personalized recommendations for a user.
     * Combines content-based filtering and collaborative filtering.
     */
    async getRecommendations(userId, limit = 10) {
        const start = performance.now();
        
        // 1. Check cache first for sub-100ms response
        const cached = await this.getCachedRecommendations(userId);
        if (cached) {
            console.log(`[RecEngine] Cache hit for user ${userId}`);
            return cached;
        }

        // 2. Generate new recommendations
        const [contentScores, collabScores] = await Promise.all([
            this.getContentBasedScores(userId),
            this.getCollaborativeScores(userId)
        ]);

        // 3. Merge scores
        const recommendations = this.mergeScores(contentScores, collabScores, limit);

        // 4. Update cache asynchronously
        this.cacheRecommendations(userId, recommendations).catch(console.error);

        const end = performance.now();
        console.log(`[RecEngine] Generated recommendations for user ${userId} in ${(end - start).toFixed(2)}ms`);

        return recommendations;
    }

    async getCachedRecommendations(userId) {
        let conn;
        try {
            conn = await pool.getConnection();
            const rows = await conn.query(
                'SELECT recommendations FROM recommendation_cache WHERE user_id = ? AND updated_at > NOW() - INTERVAL 15 MINUTE',
                [userId]
            );
            return rows.length > 0 ? rows[0].recommendations : null;
        } catch (e) {
            return null;
        } finally {
            if (conn) conn.release();
        }
    }

    async cacheRecommendations(userId, recommendations) {
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(
                'INSERT INTO recommendation_cache (user_id, recommendations) VALUES (?, ?) ON DUPLICATE KEY UPDATE recommendations = ?',
                [userId, JSON.stringify(recommendations), JSON.stringify(recommendations)]
            );
        } catch (e) {
            console.error('Failed to cache recommendations:', e);
        } finally {
            if (conn) conn.release();
        }
    }

    /**
     * Content-based: Finds items similar to what the user has interacted with positively.
     */
    async getContentBasedScores(userId) {
        let conn;
        try {
            conn = await pool.getConnection();
            // Find systems similar to those user 'flagged' or 'resolved'
            // Simplified: look for systems with same ports or ASN as user's highly weighted interactions
            const userHistory = await conn.query(`
                SELECT s.ports, s.asn, ui.weight 
                FROM user_interactions ui
                JOIN systems s ON ui.item_id = s.id AND ui.item_type = 'system'
                WHERE ui.user_id = ? AND ui.weight > 0
            `, [userId]);

            if (userHistory.length === 0) return {};

            // Find candidates
            const candidates = await conn.query(`
                SELECT id, ports, asn, risk_score 
                FROM systems 
                WHERE id NOT IN (SELECT item_id FROM user_interactions WHERE user_id = ? AND item_type = 'system')
                LIMIT 100
            `, [userId]);

            const scores = {};
            candidates.forEach(c => {
                let score = 0;
                userHistory.forEach(h => {
                    // Jaccard similarity for ports (simple version)
                    if (c.asn === h.asn) score += 5;
                    // More complex similarity logic could go here
                });
                scores[c.id] = score;
            });

            return scores;
        } catch (e) {
            console.error('Content-based scoring failed:', e);
            return {};
        } finally {
            if (conn) conn.release();
        }
    }

    /**
     * Collaborative Filtering: Finds items that similar users interacted with.
     * Item-based collaborative filtering approach.
     */
    async getCollaborativeScores(userId) {
        let conn;
        try {
            conn = await pool.getConnection();
            // Find users who interacted with same items
            const rows = await conn.query(`
                SELECT ui2.item_id, SUM(ui2.weight) as score
                FROM user_interactions ui1
                JOIN user_interactions ui2 ON ui1.item_id = ui2.item_id AND ui1.item_type = ui2.item_type
                WHERE ui1.user_id = ? AND ui2.user_id != ?
                AND ui2.item_id NOT IN (SELECT item_id FROM user_interactions WHERE user_id = ?)
                GROUP BY ui2.item_id
                ORDER BY score DESC
                LIMIT 50
            `, [userId, userId, userId]);

            const scores = {};
            rows.forEach(r => scores[r.item_id] = r.score);
            return scores;
        } catch (e) {
            return {};
        } finally {
            if (conn) conn.release();
        }
    }

    mergeScores(contentScores, collabScores, limit) {
        const allItemIds = new Set([...Object.keys(contentScores), ...Object.keys(collabScores)]);
        const merged = [];

        allItemIds.forEach(id => {
            const content = (contentScores[id] || 0) * this.weights.content;
            const collab = (collabScores[id] || 0) * this.weights.collaborative;
            merged.push({
                id: parseInt(id),
                score: content + collab
            });
        });

        return merged
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    async logInteraction(userId, itemId, itemType, interactionType) {
        const weight = this.interactionWeights[interactionType] || 1;
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(`
                INSERT INTO user_interactions (user_id, item_id, item_type, interaction_type, weight)
                VALUES (?, ?, ?, ?, ?)
            `, [userId, itemId, itemType, interactionType, weight]);
            
            // Invalidate cache
            await conn.query('DELETE FROM recommendation_cache WHERE user_id = ?', [userId]);
        } finally {
            if (conn) conn.release();
        }
    }
}

export const recommendationEngine = new RecommendationEngine();

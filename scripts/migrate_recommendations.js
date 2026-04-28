import { pool } from '../database/index.js';

async function migrate() {
    let conn;
    try {
        console.log('🔌 Connecting to database...');
        conn = await pool.getConnection();
        console.log('✅ Connected.');

        // 1. Create users table
        console.log('🛠 Creating users table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                role VARCHAR(50) DEFAULT 'analyst',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Create interactions table
        console.log('🛠 Creating user_interactions table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_interactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                item_id INT NOT NULL,
                item_type ENUM('system', 'vulnerability') NOT NULL,
                interaction_type ENUM('view', 'click', 'resolve', 'dismiss', 'flag') NOT NULL,
                weight FLOAT DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 3. Create recommendation_cache table for sub-100ms performance
        console.log('🛠 Creating recommendation_cache table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS recommendation_cache (
                user_id INT NOT NULL,
                recommendations JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Recommendation system tables ready.');

    } catch (err) {
        console.error('❌ Migration Failed:', err);
        process.exit(1);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

migrate();

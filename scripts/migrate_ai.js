import { pool } from '../database/index.js';

async function migrate() {
    let conn;
    try {
        console.log('🔌 Connecting to database...');
        conn = await pool.getConnection();
        console.log('✅ Connected.');

        // 1. Create scans table
        console.log('🛠 Checking/Creating scans table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS scans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                target VARCHAR(255) NOT NULL,
                scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                page_content LONGTEXT
            )
        `);
        console.log('✅ scans table ready.');

        // 2. Create ai_analysis table
        console.log('🛠 Checking/Creating ai_analysis table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS ai_analysis (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scan_id INT,
                threat_level INT,
                summary TEXT,
                vulnerabilities JSON,
                remediation JSON,
                FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ ai_analysis table ready.');

        // 3. Create firewalls table
        console.log('🛠 Checking/Creating firewalls table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS firewalls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scan_id INT,
                firewall_detected BOOLEAN,
                waf_name VARCHAR(255),
                confidence VARCHAR(50),
                headers_checked JSON,
                FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ firewalls table ready.');

        // 4. Create systems table
        console.log('🛠 Checking/Creating systems table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS systems (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scan_id INT,
                subdomain VARCHAR(255),
                ip VARCHAR(50),
                country VARCHAR(100),
                country_code VARCHAR(10),
                region VARCHAR(100),
                region_name VARCHAR(100),
                city VARCHAR(100),
                zip VARCHAR(20),
                isp VARCHAR(255),
                org VARCHAR(255),
                asn VARCHAR(50),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                timezone VARCHAR(50),
                risk_score INT,
                risk_level VARCHAR(20),
                risk_reasons JSON,
                FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ systems table ready.');

        // 5. Create ports table
        console.log('🛠 Checking/Creating ports table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS ports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                system_id INT,
                port INT,
                status VARCHAR(50),
                FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ ports table ready.');

        // 6. Create osint_results table
        console.log('🛠 Checking/Creating osint_results table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS osint_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scan_id INT NOT NULL,
                module VARCHAR(50) NOT NULL,
                risk_level VARCHAR(20),
                result_json JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (scan_id),
                FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ osint_results table ready.');

    } catch (err) {
        console.error('❌ Migration Failed:', err);
        process.exit(1);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

migrate();

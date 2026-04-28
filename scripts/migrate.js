import { pool } from '../database/index.js';

async function hasIndex(conn, schema, table, indexName) {
  const rows = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.statistics
     WHERE table_schema = ?
       AND table_name = ?
       AND index_name = ?`,
    [schema, table, indexName]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function createIndexIfMissing(conn, schema, table, indexName, ddl) {
  const exists = await hasIndex(conn, schema, table, indexName);
  if (exists) return;
  await conn.query(ddl);
}

async function hasColumn(conn, schema, table, columnName) {
  const rows = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = ?
       AND table_name = ?
       AND column_name = ?`,
    [schema, table, columnName]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function addColumnIfMissing(conn, schema, table, columnName, ddl) {
  const exists = await hasColumn(conn, schema, table, columnName);
  if (exists) return;
  await conn.query(ddl);
}

async function migrate() {
  const schema = process.env.DB_NAME;
  if (!schema) {
    console.error('DB_NAME is required');
    process.exit(1);
  }

  let conn;
  try {
    conn = await pool.getConnection();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target VARCHAR(255) NOT NULL,
        scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        page_content LONGTEXT
      )
    `);

    await addColumnIfMissing(
      conn,
      schema,
      'scans',
      'page_content',
      'ALTER TABLE scans ADD COLUMN page_content LONGTEXT NULL'
    );

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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        system_id INT,
        port INT,
        status VARCHAR(50),
        FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
      )
    `);

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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS osint_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(120) NOT NULL,
        user_id INT NULL,
        username VARCHAR(100) NULL,
        scan_id INT NULL,
        investigation_type VARCHAR(50) NOT NULL,
        module VARCHAR(50) NOT NULL,
        target VARCHAR(255) NOT NULL,
        risk_level VARCHAR(20) NULL,
        sources_json JSON NULL,
        result_version INT NOT NULL DEFAULT 1,
        checksum CHAR(64) NULL,
        encrypted TINYINT(1) NOT NULL DEFAULT 0,
        payload_available TINYINT(1) NOT NULL DEFAULT 1,
        payload_json JSON NULL,
        payload_enc LONGTEXT NULL,
        error_message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'analyst',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS recommendation_cache (
        user_id INT NOT NULL,
        recommendations JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await createIndexIfMissing(conn, schema, 'scans', 'idx_scans_scan_date', 'CREATE INDEX idx_scans_scan_date ON scans (scan_date)');
    await createIndexIfMissing(conn, schema, 'scans', 'idx_scans_target', 'CREATE INDEX idx_scans_target ON scans (target)');
    await createIndexIfMissing(conn, schema, 'scans', 'ft_scans_target', 'CREATE FULLTEXT INDEX ft_scans_target ON scans (target)');
    await createIndexIfMissing(conn, schema, 'ai_analysis', 'idx_ai_analysis_scan_id', 'CREATE INDEX idx_ai_analysis_scan_id ON ai_analysis (scan_id)');
    await createIndexIfMissing(conn, schema, 'firewalls', 'idx_firewalls_scan_id', 'CREATE INDEX idx_firewalls_scan_id ON firewalls (scan_id)');
    await createIndexIfMissing(conn, schema, 'systems', 'idx_systems_scan_id', 'CREATE INDEX idx_systems_scan_id ON systems (scan_id)');
    await createIndexIfMissing(conn, schema, 'osint_results', 'idx_osint_results_scan_id_created', 'CREATE INDEX idx_osint_results_scan_id_created ON osint_results (scan_id, created_at)');

    await createIndexIfMissing(conn, schema, 'osint_activity', 'idx_osint_activity_created', 'CREATE INDEX idx_osint_activity_created ON osint_activity (created_at)');
    await createIndexIfMissing(conn, schema, 'osint_activity', 'idx_osint_activity_target', 'CREATE INDEX idx_osint_activity_target ON osint_activity (target)');
    await createIndexIfMissing(conn, schema, 'osint_activity', 'idx_osint_activity_module', 'CREATE INDEX idx_osint_activity_module ON osint_activity (module)');
    await createIndexIfMissing(conn, schema, 'osint_activity', 'idx_osint_activity_type', 'CREATE INDEX idx_osint_activity_type ON osint_activity (investigation_type)');
    await createIndexIfMissing(conn, schema, 'osint_activity', 'idx_osint_activity_actor', 'CREATE INDEX idx_osint_activity_actor ON osint_activity (actor)');

    await createIndexIfMissing(conn, schema, 'user_interactions', 'idx_user_interactions_user_item', 'CREATE INDEX idx_user_interactions_user_item ON user_interactions (user_id, item_id)');

    console.log('Database schema is ready.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

migrate();

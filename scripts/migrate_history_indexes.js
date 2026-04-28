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
  if (exists) {
    console.log(`✅ Index exists: ${table}.${indexName}`);
    return;
  }
  console.log(`🛠 Creating index: ${table}.${indexName}`);
  await conn.query(ddl);
  console.log(`✅ Created index: ${table}.${indexName}`);
}

async function migrate() {
  const schema = process.env.DB_NAME;
  if (!schema) {
    console.error('❌ DB_NAME is required');
    process.exit(1);
  }

  let conn;
  try {
    conn = await pool.getConnection();

    await createIndexIfMissing(
      conn,
      schema,
      'scans',
      'idx_scans_scan_date',
      'CREATE INDEX idx_scans_scan_date ON scans (scan_date)'
    );

    await createIndexIfMissing(
      conn,
      schema,
      'scans',
      'idx_scans_target',
      'CREATE INDEX idx_scans_target ON scans (target)'
    );

    await createIndexIfMissing(
      conn,
      schema,
      'scans',
      'ft_scans_target',
      'CREATE FULLTEXT INDEX ft_scans_target ON scans (target)'
    );

    await createIndexIfMissing(
      conn,
      schema,
      'ai_analysis',
      'idx_ai_analysis_scan_id',
      'CREATE INDEX idx_ai_analysis_scan_id ON ai_analysis (scan_id)'
    );

    await createIndexIfMissing(
      conn,
      schema,
      'firewalls',
      'idx_firewalls_scan_id',
      'CREATE INDEX idx_firewalls_scan_id ON firewalls (scan_id)'
    );

    await createIndexIfMissing(
      conn,
      schema,
      'systems',
      'idx_systems_scan_id',
      'CREATE INDEX idx_systems_scan_id ON systems (scan_id)'
    );

    await createIndexIfMissing(
      conn,
      schema,
      'osint_results',
      'idx_osint_results_scan_id_created',
      'CREATE INDEX idx_osint_results_scan_id_created ON osint_results (scan_id, created_at)'
    );
  } catch (e) {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

migrate();


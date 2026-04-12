import { pool } from './index.js';

/**
 * Save scan entry
 */
export async function saveScan(target) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query(
        'INSERT INTO scans (target) VALUES (?)',
        [target]
        );

        // BigInt → Number
        return Number(res.insertId);
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Get recent scan history
 */
export async function getScanHistory() {
    let conn;
    try {
        conn = await pool.getConnection();
        // Order by ID descending (newest first)
        const rows = await conn.query('SELECT * FROM scans ORDER BY id DESC LIMIT 20');
        
        return rows.map(row => ({
            ...row,
            id: Number(row.id),
            // Ensure date is valid string if exists
            scan_date: row.scan_date ? new Date(row.scan_date).toISOString() : null
        }));
    } catch (e) {
        console.error('Failed to get history:', e);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Save AI/Page Content (New)
 */
export async function savePageContent(scanId, content) {
    if (!content) return;
    let conn;
    try {
        conn = await pool.getConnection();
        // Ensure the column 'page_content' exists in your 'scans' table
        // SQL: ALTER TABLE scans ADD COLUMN page_content LONGTEXT;
        await conn.query(
            'UPDATE scans SET page_content = ? WHERE id = ?',
            [content, scanId]
        );
    } catch (e) {
        console.error('Failed to save page content:', e.message);
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Save AI Analysis Report (New)
 */
export async function saveAiAnalysis(scanId, analysis) {
    if (!analysis) return;
    let conn;
    try {
        conn = await pool.getConnection();
        
        await conn.query(
            `INSERT INTO ai_analysis 
            (scan_id, threat_level, summary, vulnerabilities, remediation)
            VALUES (?, ?, ?, ?, ?)`,
            [
                scanId,
                analysis.threat_level,
                analysis.summary,
                JSON.stringify(analysis.vulnerabilities),
                JSON.stringify(analysis.remediation)
            ]
        );
    } catch (e) {
        console.error('Failed to save AI analysis:', e.message);
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Save firewall / WAF info (SCAN LEVEL)
 */
export async function saveFirewall(scanId, firewall) {
    if (!firewall) return;
    
    let conn;
    try {
        conn = await pool.getConnection();

        await conn.query(
        `INSERT INTO firewalls
        (scan_id, firewall_detected, waf_name, confidence, headers_checked)
        VALUES (?, ?, ?, ?, ?)`,
        [
            scanId,
            firewall.firewall ?? false,
            firewall.waf ?? null,
            firewall.confidence ?? null,
            JSON.stringify(firewall.headers_checked ?? [])
        ]
        );
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Save systems + ports
 */
export async function saveSystems(scanId, systems) {
    let conn;
    try {
        conn = await pool.getConnection();

        for (const sys of systems) {
        const res = await conn.query(
            `INSERT INTO systems
            (scan_id, subdomain, ip, country, country_code, region, region_name,
            city, zip, isp, org, asn, latitude, longitude, timezone, risk_score, risk_level, risk_reasons)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
            scanId,
            sys.subdomain ?? null,
            sys.ip ?? null,
            sys.location?.country ?? null,
            sys.location?.countryCode ?? null,
            sys.location?.region ?? null,
            sys.location?.regionName ?? null,
            sys.location?.city ?? null,
            sys.location?.zip ?? null,
            sys.location?.isp ?? null,
            sys.location?.org ?? null,
            sys.location?.asn ?? null,
            sys.location?.latitude ?? null,
            sys.location?.longitude ?? null,
            sys.location?.timezone ?? null,
            
            // 🔥 RISK FIELDS
            sys.risk?.score ?? 0,
            sys.risk?.level ?? 'Low',
            JSON.stringify(sys.risk?.reasons ?? [])
            ]
        );

        const systemId = Number(res.insertId);

        // 🔥 SAVE ALL PORTS
        if (sys.ports?.results?.length) {
            for (const p of sys.ports.results) {
            await conn.query(
                'INSERT INTO ports (system_id, port, status) VALUES (?, ?, ?)',
                [systemId, p.port, p.status]
            );
            }
        }
        }
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Save OSINT module result
 */
export async function saveOsintResult(scanId, module, risk, data) {
    if (!scanId) return;
    let conn;
    try {
        conn = await pool.getConnection();
        // Create table if not exists (lazy init)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS osint_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scan_id INT NOT NULL,
                module VARCHAR(50) NOT NULL,
                risk_level VARCHAR(20),
                result_json JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (scan_id)
            )
        `);
        
        await conn.query(
            'INSERT INTO osint_results (scan_id, module, risk_level, result_json) VALUES (?, ?, ?, ?)',
            [scanId, module, risk, JSON.stringify(data)]
        );
    } catch (e) {
        console.error(`Failed to save OSINT result for ${module}:`, e);
    } finally {
        if (conn) conn.release();
    }
}

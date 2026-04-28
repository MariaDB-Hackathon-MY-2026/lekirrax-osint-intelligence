import { pool } from './index.js';
import { computeChecksum, decryptJson, encryptJson, hasEncryptionKey } from '../services/securePayload.js';

function safeJsonStringify(value, maxChars = 250_000) {
    try {
        const json = JSON.stringify(value);
        if (typeof json !== 'string') return null;
        if (json.length <= maxChars) return json;
        return json.slice(0, maxChars);
    } catch {
        try {
            const fallback = JSON.stringify({ version: 1, note: 'snapshot truncated', target: value?.target ?? null });
            return typeof fallback === 'string' ? fallback : null;
        } catch {
            return null;
        }
    }
}

function buildScanSnapshot(target, reconData) {
    const ssl = reconData?.ssl ?? null;
    const dns = reconData?.dns ?? null;
    const whois = reconData?.whois ?? null;
    const securityTxt = reconData?.securityTxt ?? null;
    const crawlRules = reconData?.crawlRules ?? null;
    const socialTags = reconData?.socialTags ?? null;
    const firewall = reconData?.firewall ?? null;

    return {
        version: 2,
        target,
        scanDate: reconData?.scanDate ?? new Date().toISOString(),
        ssl,
        dns,
        whois,
        securityTxt,
        crawlRules,
        socialTags,
        firewall,
        systemsCount: Array.isArray(reconData?.systems) ? reconData.systems.length : 0
    };
}

//Save complete scan data in a single transaction
export async function saveCompleteScan(target, reconData) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Save main scan entry
        const snapshot = buildScanSnapshot(target, reconData);
        const pageContent = safeJsonStringify(snapshot);
        const scanRes = await conn.query(
            'INSERT INTO scans (target, page_content) VALUES (?, ?)',
            [target, pageContent]
        );
        const scanId = Number(scanRes.insertId);

        // 2. Save firewall info
        if (reconData.firewall) {
            await conn.query(
                `INSERT INTO firewalls
                (scan_id, firewall_detected, waf_name, confidence, headers_checked)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    scanId,
                    reconData.firewall.firewall ?? false,
                    reconData.firewall.waf ?? null,
                    reconData.firewall.confidence ?? null,
                    JSON.stringify(reconData.firewall.headers_checked ?? [])
                ]
            );
        }

        // 3. Save AI Analysis if present
        if (reconData.aiAnalysis) {
            const ai = reconData.aiAnalysis ?? {};
            const threatLevel = Number.isFinite(ai.threat_level) ? ai.threat_level : null;
            const summary = typeof ai.summary === 'string' ? ai.summary : null;
            const vulnerabilitiesJson = JSON.stringify(ai.vulnerabilities ?? []);
            const remediationJson = JSON.stringify(ai.remediation ?? []);

            await conn.query(
                `INSERT INTO ai_analysis 
                (scan_id, threat_level, summary, vulnerabilities, remediation)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    scanId,
                    threatLevel,
                    summary,
                    vulnerabilitiesJson,
                    remediationJson
                ]
            );
        }

        // 4. Save Systems and Ports
        if (Array.isArray(reconData.systems)) {
            for (const sys of reconData.systems) {
                const sysRes = await conn.query(
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
                        sys.risk?.score ?? 0,
                        sys.risk?.level ?? 'Low',
                        JSON.stringify(sys.risk?.reasons ?? [])
                    ]
                );
                const systemId = Number(sysRes.insertId);

                if (sys.ports?.results?.length) {
                    const portValues = sys.ports.results.map(p => [systemId, p.port, p.status]);
                    await conn.batch(
                        'INSERT INTO ports (system_id, port, status) VALUES (?, ?, ?)',
                        portValues
                    );
                }
            }
        }

        await conn.commit();
        return scanId;
    } catch (e) {
        if (conn) await conn.rollback();
        console.error('Failed to save complete scan:', e);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

//Get recent scan history
export async function getScanHistory() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM scans ORDER BY id DESC LIMIT 20');
        
        return rows.map(row => ({
            ...row,
            id: Number(row.id),
            scan_date: row.scan_date ? new Date(row.scan_date).toISOString() : null
        }));
    } catch (e) {
        console.error('Failed to get history:', e);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

function clampInt(value, { min, max, fallback }) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.trunc(n);
    if (i < min) return min;
    if (i > max) return max;
    return i;
}

function parseDateMs(value) {
    if (!value) return null;
    const d = new Date(String(value));
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
}

export async function getScansHistoryPage(params = {}) {
    const page = clampInt(params.page, { min: 1, max: 100000, fallback: 1 });
    const pageSize = clampInt(params.pageSize, { min: 5, max: 100, fallback: 25 });
    const offset = (page - 1) * pageSize;

    const q = typeof params.q === 'string' ? params.q.trim() : '';
    const fromMs = parseDateMs(params.from);
    const toMs = parseDateMs(params.to);

    const sortKey = String(params.sort || 'scan_date');
    const orderKey = String(params.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const sortColumns = {
        scan_date: 's.scan_date',
        target: 's.target',
        threat_level: 'a.threat_level'
    };
    const sortColumn = sortColumns[sortKey] || sortColumns.scan_date;

    const where = [];
    const args = [];

    if (fromMs != null) {
        where.push('s.scan_date >= FROM_UNIXTIME(?)');
        args.push(Math.floor(fromMs / 1000));
    }
    if (toMs != null) {
        where.push('s.scan_date <= FROM_UNIXTIME(?)');
        args.push(Math.floor(toMs / 1000));
    }

    if (q) {
        const qWords = q
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => (w.length >= 3 ? `+${w}*` : w))
            .join(' ');

        if (qWords) {
            where.push('(MATCH(s.target) AGAINST (? IN BOOLEAN MODE) OR s.target LIKE ?)');
            args.push(qWords);
            args.push(`${q}%`);
        }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    let conn;
    try {
        conn = await pool.getConnection();

        const countRows = await conn.query(
            `SELECT COUNT(*) AS total
             FROM scans s
             ${whereSql}`,
            args
        );
        const total = Number(countRows?.[0]?.total || 0);

        const rows = await conn.query(
            `SELECT
                s.id,
                s.target,
                s.scan_date,
                CASE WHEN s.page_content IS NULL OR s.page_content = '' THEN 0 ELSE 1 END AS has_snapshot,
                a.threat_level,
                a.summary,
                f.firewall_detected,
                f.waf_name,
                (SELECT COUNT(*) FROM systems sy WHERE sy.scan_id = s.id) AS systems_count,
                (SELECT COUNT(*) FROM osint_results o WHERE o.scan_id = s.id) AS osint_count
            FROM scans s
            LEFT JOIN (
                SELECT t.scan_id, t.threat_level, t.summary
                FROM ai_analysis t
                JOIN (SELECT scan_id, MAX(id) AS max_id FROM ai_analysis GROUP BY scan_id) mx
                    ON mx.scan_id = t.scan_id AND mx.max_id = t.id
            ) a ON a.scan_id = s.id
            LEFT JOIN (
                SELECT t.scan_id, t.firewall_detected, t.waf_name
                FROM firewalls t
                JOIN (SELECT scan_id, MAX(id) AS max_id FROM firewalls GROUP BY scan_id) mx
                    ON mx.scan_id = t.scan_id AND mx.max_id = t.id
            ) f ON f.scan_id = s.id
            ${whereSql}
            ORDER BY ${sortColumn} ${orderKey}
            LIMIT ? OFFSET ?`,
            [...args, pageSize, offset]
        );

        const items = (rows || []).map((row) => ({
            id: Number(row.id),
            target: row.target,
            scan_date: row.scan_date ? new Date(row.scan_date).toISOString() : null,
            has_snapshot: Boolean(row.has_snapshot),
            threat_level: row.threat_level != null ? Number(row.threat_level) : null,
            summary: row.summary ?? null,
            firewall_detected: row.firewall_detected != null ? Boolean(row.firewall_detected) : null,
            waf_name: row.waf_name ?? null,
            systems_count: Number(row.systems_count || 0),
            osint_count: Number(row.osint_count || 0)
        }));

        return { items, total, page, pageSize };
    } catch (e) {
        console.error('Failed to get scan history page:', e);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

export async function getScanDetails(scanId) {
    const id = Number(scanId);
    if (!Number.isFinite(id) || id <= 0) {
        const err = new Error('Invalid scan id');
        err.code = 'BAD_REQUEST';
        throw err;
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const scans = await conn.query(
            `SELECT id, target, scan_date, page_content
             FROM scans
             WHERE id = ?`,
            [id]
        );
        if (!scans?.length) return null;

        const scan = scans[0];
        const ai = await conn.query(
            `SELECT threat_level, summary, vulnerabilities, remediation
             FROM ai_analysis
             WHERE scan_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [id]
        );

        const fw = await conn.query(
            `SELECT firewall_detected, waf_name, confidence, headers_checked
             FROM firewalls
             WHERE scan_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [id]
        );

        const systems = await conn.query(
            `SELECT id, subdomain, ip, country, country_code, region, region_name,
                    city, zip, isp, org, asn, latitude, longitude, timezone,
                    risk_score, risk_level, risk_reasons
             FROM systems
             WHERE scan_id = ?
             ORDER BY risk_score DESC, id ASC
             LIMIT 100`,
            [id]
        );

        const systemIds = systems.map((s) => Number(s.id)).filter((x) => Number.isFinite(x));
        let portsBySystemId = new Map();
        if (systemIds.length) {
            const ports = await conn.query(
                `SELECT system_id, port, status
                 FROM ports
                 WHERE system_id IN (${systemIds.map(() => '?').join(',')})
                 ORDER BY port ASC`,
                systemIds
            );
            portsBySystemId = ports.reduce((m, p) => {
                const sid = Number(p.system_id);
                const list = m.get(sid) || [];
                list.push({ port: Number(p.port), status: p.status });
                m.set(sid, list);
                return m;
            }, new Map());
        }

        const osint = await conn.query(
            `SELECT module, risk_level, created_at
             FROM osint_results
             WHERE scan_id = ?
             ORDER BY created_at DESC
             LIMIT 200`,
            [id]
        );

        return {
            scan: {
                id: Number(scan.id),
                target: scan.target,
                scan_date: scan.scan_date ? new Date(scan.scan_date).toISOString() : null,
                page_content: (() => {
                    if (!scan.page_content) return null;
                    if (typeof scan.page_content === 'string') {
                        try {
                            return JSON.parse(scan.page_content);
                        } catch {
                            return scan.page_content;
                        }
                    }
                    return scan.page_content;
                })()
            },
            aiAnalysis: ai?.[0]
                ? {
                    threat_level: ai[0].threat_level != null ? Number(ai[0].threat_level) : null,
                    summary: ai[0].summary ?? null,
                    vulnerabilities: ai[0].vulnerabilities ?? null,
                    remediation: ai[0].remediation ?? null
                }
                : null,
            firewall: fw?.[0]
                ? {
                    firewall_detected: fw[0].firewall_detected != null ? Boolean(fw[0].firewall_detected) : null,
                    waf_name: fw[0].waf_name ?? null,
                    confidence: fw[0].confidence ?? null,
                    headers_checked: fw[0].headers_checked ?? null
                }
                : null,
            systems: systems.map((s) => ({
                id: Number(s.id),
                subdomain: s.subdomain ?? null,
                ip: s.ip ?? null,
                location: {
                    country: s.country ?? null,
                    countryCode: s.country_code ?? null,
                    region: s.region ?? null,
                    regionName: s.region_name ?? null,
                    city: s.city ?? null,
                    zip: s.zip ?? null,
                    isp: s.isp ?? null,
                    org: s.org ?? null,
                    asn: s.asn ?? null,
                    latitude: s.latitude ?? null,
                    longitude: s.longitude ?? null,
                    timezone: s.timezone ?? null
                },
                risk: {
                    score: Number(s.risk_score || 0),
                    level: s.risk_level ?? null,
                    reasons: (() => {
                        if (!s.risk_reasons) return [];
                        if (Array.isArray(s.risk_reasons)) return s.risk_reasons;
                        if (typeof s.risk_reasons === 'string') {
                            try {
                                const parsed = JSON.parse(s.risk_reasons);
                                return Array.isArray(parsed) ? parsed : [];
                            } catch {
                                return [];
                            }
                        }
                        return [];
                    })()
                },
                ports: portsBySystemId.get(Number(s.id)) || []
            })),
            osintResults: (osint || []).map((o) => ({
                module: o.module,
                risk_level: o.risk_level ?? null,
                created_at: o.created_at ? new Date(o.created_at).toISOString() : null
            }))
        };
    } finally {
        if (conn) conn.release();
    }
}

export async function deleteScanHistory(scanId) {
    const id = Number(scanId);
    if (!Number.isFinite(id) || id <= 0) {
        const err = new Error('Invalid scan id');
        err.code = 'BAD_REQUEST';
        throw err;
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query('DELETE FROM osint_activity WHERE scan_id = ?', [id]);
        const res = await conn.query('DELETE FROM scans WHERE id = ?', [id]);
        const affected = Number(res?.affectedRows || 0);
        if (affected === 0) {
            const err = new Error('Not found');
            err.code = 'NOT_FOUND';
            throw err;
        }

        await conn.commit();
        return { deleted: true, id };
    } catch (e) {
        try {
            if (conn) await conn.rollback();
        } catch {
            // ignore
        }
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

export async function deleteOsintActivity(id) {
    const osintId = Number(id);
    if (!Number.isFinite(osintId) || osintId <= 0) {
        const err = new Error('Invalid id');
        err.code = 'BAD_REQUEST';
        throw err;
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM osint_activity WHERE id = ?', [osintId]);
        const affected = Number(res?.affectedRows || 0);
        if (affected === 0) {
            const err = new Error('Not found');
            err.code = 'NOT_FOUND';
            throw err;
        }
        return { deleted: true, id: osintId };
    } finally {
        if (conn) conn.release();
    }
}

export async function savePageContent(scanId, content) {
    if (!content) return;
    let conn;
    try {
        conn = await pool.getConnection();
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

export async function saveAiAnalysis(scanId, analysis) {
    if (!analysis) return;
    let conn;
    try {
        conn = await pool.getConnection();

        const threatLevel = Number.isFinite(analysis.threat_level) ? analysis.threat_level : null;
        const summary = typeof analysis.summary === 'string' ? analysis.summary : null;
        const vulnerabilitiesJson = JSON.stringify(analysis.vulnerabilities ?? []);
        const remediationJson = JSON.stringify(analysis.remediation ?? []);
        
        await conn.query(
            `INSERT INTO ai_analysis 
            (scan_id, threat_level, summary, vulnerabilities, remediation)
            VALUES (?, ?, ?, ?, ?)`,
            [
                scanId,
                threatLevel,
                summary,
                vulnerabilitiesJson,
                remediationJson
            ]
        );
    } catch (e) {
        console.error('Failed to save AI analysis:', e.message);
    } finally {
        if (conn) conn.release();
    }
}

//Save OSINT module result
export async function saveOsintResult(scanId, module, risk, data) {
    if (!scanId) return;
    let conn;
    try {
        conn = await pool.getConnection();
        
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

export async function saveOsintActivity({
    scanId,
    user,
    module,
    target,
    investigationType,
    sources,
    riskLevel,
    payload,
    errorMessage
}) {
    if (!module || !target || !investigationType) return;
    let conn;
    try {
        conn = await pool.getConnection();

        const actor = user?.id != null ? `u:${user.id}` : 'anonymous';
        const userId = user?.id != null ? Number(user.id) : null;
        const username = typeof user?.username === 'string' ? user.username : null;
        const scanIdVal = scanId != null ? Number(scanId) : null;
        const sourcesJson = sources ? JSON.stringify(sources) : null;
        const risk = typeof riskLevel === 'string' ? riskLevel : null;
        const err = typeof errorMessage === 'string' ? errorMessage : null;

        const versionRows = await conn.query(
            `SELECT COALESCE(MAX(result_version), 0) AS v
             FROM osint_activity
             WHERE actor = ? AND module = ? AND target = ? AND investigation_type = ?`,
            [actor, module, target, investigationType]
        );
        const nextVersion = Number(versionRows?.[0]?.v || 0) + 1;

        let encrypted = 0;
        let payloadAvailable = 1;
        let checksum = null;
        let payloadEnc = null;
        let payloadJson = null;

        if (payload && err == null) {
            if (hasEncryptionKey()) {
                const envelope = encryptJson(payload);
                if (envelope) {
                    encrypted = 1;
                    checksum = computeChecksum(payload);
                    payloadEnc = JSON.stringify(envelope);
                } else {
                    payloadAvailable = 0;
                }
            } else {
                payloadAvailable = 0;
            }
        }

        await conn.query(
            `INSERT INTO osint_activity
             (actor, user_id, username, scan_id, investigation_type, module, target, risk_level, sources_json, result_version, checksum, encrypted, payload_available, payload_json, payload_enc, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                actor,
                userId,
                username,
                scanIdVal,
                investigationType,
                module,
                target,
                risk,
                sourcesJson,
                nextVersion,
                checksum,
                encrypted,
                payloadAvailable,
                payloadJson,
                payloadEnc,
                err
            ]
        );
    } catch (e) {
        console.error('Failed to save OSINT activity:', e?.message || e);
    } finally {
        if (conn) conn.release();
    }
}

export async function getOsintActivityPage(params = {}) {
    let conn;
    try {
        conn = await pool.getConnection();

        const q = typeof params.q === 'string' ? params.q.trim() : '';
        const fromMs = parseDateMs(params.from);
        const toMs = parseDateMs(params.to);
        const module = typeof params.module === 'string' ? params.module.trim() : '';
        const type = typeof params.type === 'string' ? params.type.trim() : '';
        const source = typeof params.source === 'string' ? params.source.trim() : '';
        const risk = typeof params.risk === 'string' ? params.risk.trim().toLowerCase() : '';
        const encrypted =
            params.encrypted === '1' || params.encrypted === 1 || params.encrypted === true
                ? 1
                : params.encrypted === '0' || params.encrypted === 0 || params.encrypted === false
                    ? 0
                    : null;
        const payloadAvailable =
            params.payloadAvailable === '1' || params.payloadAvailable === 1 || params.payloadAvailable === true
                ? 1
                : params.payloadAvailable === '0' || params.payloadAvailable === 0 || params.payloadAvailable === false
                    ? 0
                    : null;
        const page = clampInt(params.page, { min: 1, max: 100000, fallback: 1 });
        const pageSize = clampInt(params.pageSize, { min: 1, max: 100, fallback: 25 });
        const offset = (page - 1) * pageSize;

        const where = [];
        const args = [];

        if (q) {
            where.push('(target LIKE ? OR module LIKE ? OR username LIKE ?)');
            args.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (module) {
            where.push('module = ?');
            args.push(module);
        }
        if (type) {
            where.push('investigation_type = ?');
            args.push(type);
        }
        if (source) {
            where.push('sources_json LIKE ?');
            args.push(`%${source}%`);
        }
        if (risk) {
            where.push('LOWER(risk_level) = ?');
            args.push(risk);
        }
        if (encrypted != null) {
            where.push('encrypted = ?');
            args.push(encrypted);
        }
        if (payloadAvailable != null) {
            where.push('payload_available = ?');
            args.push(payloadAvailable);
        }
        if (fromMs != null) {
            where.push('created_at >= FROM_UNIXTIME(? / 1000)');
            args.push(fromMs);
        }
        if (toMs != null) {
            where.push('created_at < FROM_UNIXTIME(? / 1000)');
            args.push(toMs + 24 * 60 * 60 * 1000);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const totalRows = await conn.query(
            `SELECT COUNT(*) AS cnt FROM osint_activity ${whereSql}`,
            args
        );
        const total = Number(totalRows?.[0]?.cnt || 0);

        const items = await conn.query(
            `SELECT id, created_at, investigation_type, module, target, risk_level, username, scan_id, result_version, encrypted, payload_available
             FROM osint_activity
             ${whereSql}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...args, pageSize, offset]
        );

        return { items, total, page, pageSize };
    } catch (e) {
        console.error('Failed to query OSINT activity:', e?.message || e);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

export async function getOsintActivityDetails(id) {
    let conn;
    try {
        const osintId = Number(id);
        if (!Number.isFinite(osintId) || osintId <= 0) {
            const err = new Error('Invalid id');
            err.code = 'BAD_REQUEST';
            throw err;
        }

        conn = await pool.getConnection();

        const rows = await conn.query(
            `SELECT *
             FROM osint_activity
             WHERE id = ?`,
            [osintId]
        );
        const row = rows?.[0];
        if (!row) return null;

        let payload = null;
        let integrityOk = null;

        if (Number(row.payload_available) === 1) {
            if (Number(row.encrypted) === 1 && row.payload_enc) {
                const envelope = JSON.parse(row.payload_enc);
                payload = decryptJson(envelope);
            } else if (row.payload_json) {
                payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;
            }

            if (payload && row.checksum) {
                try {
                    integrityOk = computeChecksum(payload) === String(row.checksum);
                } catch {
                    integrityOk = false;
                }
            }
        }

        return {
            id: row.id,
            created_at: row.created_at,
            actor: row.actor,
            user_id: row.user_id,
            username: row.username,
            scan_id: row.scan_id,
            investigation_type: row.investigation_type,
            module: row.module,
            target: row.target,
            risk_level: row.risk_level,
            sources: row.sources_json ? (typeof row.sources_json === 'string' ? JSON.parse(row.sources_json) : row.sources_json) : null,
            result_version: row.result_version,
            encrypted: Boolean(row.encrypted),
            payload_available: Boolean(row.payload_available),
            checksum: row.checksum,
            integrityOk,
            error_message: row.error_message,
            payload
        };
    } finally {
        if (conn) conn.release();
    }
}

export async function exportOsintActivity(params = {}) {
    let conn;
    try {
        conn = await pool.getConnection();

        const q = typeof params.q === 'string' ? params.q.trim() : '';
        const fromMs = parseDateMs(params.from);
        const toMs = parseDateMs(params.to);
        const module = typeof params.module === 'string' ? params.module.trim() : '';
        const type = typeof params.type === 'string' ? params.type.trim() : '';
        const source = typeof params.source === 'string' ? params.source.trim() : '';
        const risk = typeof params.risk === 'string' ? params.risk.trim().toLowerCase() : '';
        const encrypted =
            params.encrypted === '1' || params.encrypted === 1 || params.encrypted === true
                ? 1
                : params.encrypted === '0' || params.encrypted === 0 || params.encrypted === false
                    ? 0
                    : null;
        const payloadAvailable =
            params.payloadAvailable === '1' || params.payloadAvailable === 1 || params.payloadAvailable === true
                ? 1
                : params.payloadAvailable === '0' || params.payloadAvailable === 0 || params.payloadAvailable === false
                    ? 0
                    : null;
        const includePayload = params.includePayload === true;
        const limit = clampInt(params.limit, { min: 1, max: 5000, fallback: 1000 });

        const where = [];
        const args = [];

        if (q) {
            where.push('(target LIKE ? OR module LIKE ? OR username LIKE ?)');
            args.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (module) {
            where.push('module = ?');
            args.push(module);
        }
        if (type) {
            where.push('investigation_type = ?');
            args.push(type);
        }
        if (source) {
            where.push('sources_json LIKE ?');
            args.push(`%${source}%`);
        }
        if (risk) {
            where.push('LOWER(risk_level) = ?');
            args.push(risk);
        }
        if (encrypted != null) {
            where.push('encrypted = ?');
            args.push(encrypted);
        }
        if (payloadAvailable != null) {
            where.push('payload_available = ?');
            args.push(payloadAvailable);
        }
        if (fromMs != null) {
            where.push('created_at >= FROM_UNIXTIME(? / 1000)');
            args.push(fromMs);
        }
        if (toMs != null) {
            where.push('created_at < FROM_UNIXTIME(? / 1000)');
            args.push(toMs + 24 * 60 * 60 * 1000);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const rows = await conn.query(
            `SELECT id, created_at, investigation_type, module, target, risk_level, username, scan_id, result_version, checksum, encrypted, payload_available, sources_json, payload_json, payload_enc, error_message
             FROM osint_activity
             ${whereSql}
             ORDER BY created_at DESC
             LIMIT ?`,
            [...args, limit]
        );

        if (!includePayload) {
            return rows.map((r) => ({
                id: r.id,
                created_at: r.created_at,
                investigation_type: r.investigation_type,
                module: r.module,
                target: r.target,
                risk_level: r.risk_level,
                username: r.username,
                scan_id: r.scan_id,
                result_version: r.result_version,
                encrypted: Boolean(r.encrypted),
                payload_available: Boolean(r.payload_available),
                checksum: r.checksum,
                sources: r.sources_json ? (typeof r.sources_json === 'string' ? JSON.parse(r.sources_json) : r.sources_json) : null,
                error_message: r.error_message
            }));
        }

        return rows.map((r) => {
            let payload = null;
            let integrityOk = null;
            if (Number(r.payload_available) === 1) {
                if (Number(r.encrypted) === 1 && r.payload_enc) {
                    try {
                        const envelope = JSON.parse(r.payload_enc);
                        payload = decryptJson(envelope);
                    } catch {}
                } else if (r.payload_json) {
                    try {
                        payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json;
                    } catch {}
                }
                if (payload && r.checksum) {
                    try {
                        integrityOk = computeChecksum(payload) === String(r.checksum);
                    } catch {
                        integrityOk = false;
                    }
                }
            }
            return {
                id: r.id,
                created_at: r.created_at,
                investigation_type: r.investigation_type,
                module: r.module,
                target: r.target,
                risk_level: r.risk_level,
                username: r.username,
                scan_id: r.scan_id,
                result_version: r.result_version,
                encrypted: Boolean(r.encrypted),
                payload_available: Boolean(r.payload_available),
                checksum: r.checksum,
                integrityOk,
                sources: r.sources_json ? (typeof r.sources_json === 'string' ? JSON.parse(r.sources_json) : r.sources_json) : null,
                error_message: r.error_message,
                payload
            };
        });
    } finally {
        if (conn) conn.release();
    }
}

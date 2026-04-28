import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { getIpInfo } from './services/ipsInfo.js'; 
import { getSSLInfo } from './services/sslInfo.js';  
import { getServerLocation } from './services/serverLocation.js';
import { getDNSInfo } from './services/dnsInfo.js';
import { getHeadersInfo } from './services/headersInfo.js';
import { getPortsInfo } from './services/portsInfo.js';
import { getSubdomainInfo } from './services/subdomainInfo.js';
import { runRecon } from './services/reconPipeline.js';
import {
  deleteOsintActivity,
  deleteScanHistory,
  exportOsintActivity,
  getOsintActivityDetails,
  getOsintActivityPage,
  getScanDetails,
  getScansHistoryPage,
  getScanHistory,
  saveCompleteScan,
  saveOsintActivity,
  saveOsintResult
} from './database/storage.js';
import { getFirewallInfo } from './services/firewallInfo.js';
import { normalizeTarget } from './services/utils.js';
import { prioritizeTargets } from './services/smartFilter.js';
import { runOsintModule } from './services/osint/index.js';
import { recommendationEngine } from './services/recommendationEngine.js';
import { TtlCache } from './services/cache.js';
import { getProviderStatus } from './services/providerStatus.js';
import { getSocialTags } from './services/socialTags.js';

// Security & Auth
import { scanLimiter, apiLimiter } from './middleware/rateLimiter.js';
import { validateScanRequest } from './middleware/validator.js';
import { authenticateToken, generateToken } from './middleware/auth.js';
import { logger, stream } from './services/logger.js';
import { pool } from './database/index.js';

dotenv.config();

BigInt.prototype.toJSON = function () {
  return Number(this);
};

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
const isProd = process.env.NODE_ENV === 'production';
app.use(helmet({
    contentSecurityPolicy: isProd ? {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "base-uri": ["'self'"],
            "frame-ancestors": ["'none'"],
            "object-src": ["'none'"],
            "img-src": ["'self'", "data:", "https:"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "script-src": ["'self'"],
            "font-src": ["'self'", "data:"],
            "connect-src": ["'self'", "https:", "wss:", "ws:"]
        }
    } : false,
}));
app.use(compression());
app.use(morgan('combined', { stream }));
app.use(cookieParser());

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
const isLocalDevOrigin = (origin) => {
    if (typeof origin !== 'string') return false;
    return /^http:\/\/localhost:\d+$/i.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/i.test(origin);
};
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || (!isProd && isLocalDevOrigin(origin))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json()); 

// Session Tracking for Concurrency Limit
const activeSessions = new Set();
const MAX_CONCURRENT_USERS = 3;

const reconJobs = new Map();
const RECON_JOB_TTL_MS = 10 * 60 * 1000;
const historyCache = new TtlCache({ ttlMs: 10_000, max: 500 });

function requireAdmin(req, res) {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ status: 'error', message: 'Forbidden' });
        return false;
    }
    return true;
}

function unwrapTargetInput(raw) {
    const result = { domainInput: raw, sourceUrl: raw };
    if (typeof raw !== 'string' || !raw.trim()) return result;

    let u;
    try {
        u = new URL(raw);
    } catch {
        return result;
    }

    const host = (u.hostname || '').toLowerCase();
    const forbidden = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

    if (host === 'web-check.xyz') {
        const path = u.pathname || '';
        const m = path.match(/^\/check\/(.+)$/i);
        const candidate = m?.[1] || u.searchParams.get('url') || u.searchParams.get('target');
        if (candidate) {
            let decoded = candidate;
            for (let i = 0; i < 2; i++) {
                try {
                    const next = decodeURIComponent(decoded);
                    if (next === decoded) break;
                    decoded = next;
                } catch {
                    break;
                }
            }

            try {
                const inner = new URL(decoded);
                const innerHost = (inner.hostname || '').toLowerCase();
                if (forbidden.has(innerHost)) return result;
                result.domainInput = decoded;
                result.sourceUrl = decoded;
                return result;
            } catch {
                return result;
            }
        }
    }

    if (forbidden.has(host)) return result;
    return result;
}

// Auth Endpoints
/**
 * POST /api/auth/login
 * Public endpoint for user authentication.
 * Enforces a 3-user concurrency limit.
 */
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // Check concurrency limit
    if (activeSessions.size >= MAX_CONCURRENT_USERS) {
        return res.status(429).json({ 
            status: 'error', 
            message: 'System capacity reached. Maximum 3 operators allowed simultaneously.' 
        });
    }

    // MOCK LOGIN - Replace with database check
    if (username === 'admin' && password === 'admin') {
        const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
        
        // Track session (in a real app, use session IDs or unique identifiers)
        activeSessions.add(token);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 8 * 60 * 60 * 1000
        });
        
        return res.json({ 
            status: 'success', 
            token,
            user: { id: 1, username: 'admin', role: 'admin' }
        });
    }
    
    res.status(401).json({ status: 'error', message: 'Invalid credentials' });
});

app.get('/api/auth/session', authenticateToken, (req, res) => {
    res.json({ status: 'success', user: req.user });
});

/**
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const tokenFromCookie = req.cookies?.token;
    const token = (authHeader && authHeader.split(' ')[1]) || tokenFromCookie;

    if (token) {
        activeSessions.delete(token);
    }

    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
    res.json({ status: 'success', message: 'Logged out successfully' });
});

// Apply global rate limiter to all API routes
app.use('/api', apiLimiter);

app.get('/api/ip-info', async (req, res) => {
  try {
    let { target } = req.query;

    if (!target) {
      return res.status(400).json({ error: 'No target provided' });
    }

    target = normalizeTarget(target);

    const data = await getIpInfo(target);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ssl-info', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No hostname provided' });
        }
        
        target = normalizeTarget(target);

        const data = await getSSLInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/server-location', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No hostname provided' });
        }
        
        target = normalizeTarget(target);

        const data = await getServerLocation(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/social-tags', authenticateToken, scanLimiter, validateScanRequest, async (req, res) => {
    try {
        const rawTarget = req.query?.target;
        if (typeof rawTarget !== 'string' || !rawTarget.trim()) {
            return res.status(400).json({ status: 'error', message: 'No target provided' });
        }

        const unwrapped = unwrapTargetInput(rawTarget);
        const tags = await getSocialTags(unwrapped.sourceUrl);
        res.json({ status: 'success', socialTags: tags });
    } catch (err) {
        res.status(502).json({ status: 'error', message: err?.message || 'Failed to fetch social tags' });
    }
});

app.get('/api/dns-info', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No domain provided' });
        }
        
        target = normalizeTarget(target);

        const data = await getDNSInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

app.get('/api/header-info', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No target provided' });
        }

        target = normalizeTarget(target);

        const data = await getHeadersInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/port-info', async (req, res) => {
    try {
        let { target } = req.query;
        if (!target) {
          return res.status(400).json({ error: 'No target provided' });
        }
        
        target = normalizeTarget(target);
        
        const data = await getPortsInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/subdomains', async (req, res) => {
    try {
        let { target } = req.query;
        if (!target) {
          return res.status(400).json({ error: 'No target provided' });
        }

        target = normalizeTarget(target);

        const data = await getSubdomainInfo(target);
        res.json({
          domain: target,
          count: data.length,
          subdomains: data
    }) ;
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
}); 

app.post('/api/recon/start', authenticateToken, scanLimiter, validateScanRequest, async (req, res) => {
  const rawTarget = req.body?.target;
  if (!rawTarget) {
    return res.status(400).json({ error: 'No target provided' });
  }
  const unwrapped = unwrapTargetInput(rawTarget);
  const target = normalizeTarget(unwrapped.domainInput);

  const jobId = randomUUID();
  const controller = new AbortController();
  const job = {
    jobId,
    target,
    sourceUrl: unwrapped.sourceUrl,
    status: 'running',
    createdAt: Date.now(),
    startedAt: Date.now(),
    completedAt: null,
    controller,
    scanId: null,
    persistenceError: null,
    result: null,
    error: null
  };
  reconJobs.set(jobId, job);

  logger.info(`Recon job started: ${jobId} (${target})`);

  (async () => {
    try {
      const recon = await runRecon(target, { signal: controller.signal, sourceUrl: unwrapped.sourceUrl });
      if (controller.signal.aborted) {
        const err = new Error('Scan cancelled');
        err.name = 'AbortError';
        throw err;
      }

      let scanId = null;
      let persistenceError = null;
      try {
        scanId = await saveCompleteScan(target, recon);
      } catch (e) {
        persistenceError = e?.message || 'Failed to persist scan';
        logger.error(`Failed to persist scan for target ${target}: ${persistenceError}`, { error: e });
      }

      job.scanId = scanId;
      job.persistenceError = persistenceError;
      job.result = { scan_id: scanId, target, persistenceError, ...recon };
      job.status = 'complete';
      job.completedAt = Date.now();
      logger.info(`Recon job completed: ${jobId} (${target})`);
    } catch (e) {
      if (e?.name === 'AbortError') {
        job.status = 'cancelled';
        job.completedAt = Date.now();
        logger.info(`Recon job cancelled: ${jobId} (${target})`);
      } else {
        job.status = 'failed';
        job.error = e?.message || 'Scan failed';
        job.completedAt = Date.now();
        logger.error(`Recon job failed: ${jobId} (${target}): ${job.error}`, { error: e });
      }
    } finally {
      setTimeout(() => reconJobs.delete(jobId), RECON_JOB_TTL_MS);
    }
  })();

  res.json({ jobId, status: job.status, target });
});

app.get('/api/recon/status/:jobId', authenticateToken, async (req, res) => {
  const { jobId } = req.params;
  const job = reconJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Scan job not found' });
  }

  if (job.status === 'complete') {
    return res.json({ jobId, status: job.status, ...job.result });
  }

  res.json({
    jobId,
    status: job.status,
    target: job.target,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error
  });
});

app.post('/api/recon/cancel/:jobId', authenticateToken, async (req, res) => {
  const { jobId } = req.params;
  const job = reconJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Scan job not found' });
  }

  if (job.status === 'running') {
    job.status = 'cancelling';
    logger.info(`Recon job cancellation requested: ${jobId} (${job.target})`);
    try {
      job.controller.abort();
    } catch (e) {
    }
  }

  res.json({ jobId, status: job.status });
});

/**
 * GET /api/recon
 * Protected endpoint to run a full reconnaissance scan on a target.
 * Requires: Authentication token, valid target URL/hostname.
 * Performs: Subdomain discovery, DNS lookup, SSL check, Port scan, WAF detection, and AI Analysis.
 */
app.get('/api/recon', authenticateToken, scanLimiter, validateScanRequest, async (req, res) => {
  try {
    const rawTarget = typeof req.query?.target === 'string' ? req.query.target : '';
    if (!rawTarget.trim()) {
      return res.status(400).json({ error: 'No target provided' });
    }

    const unwrapped = unwrapTargetInput(rawTarget);
    const target = normalizeTarget(unwrapped.domainInput);

    // 1. Run Recon
    const recon = await runRecon(target, { sourceUrl: unwrapped.sourceUrl });
    
    // 2. Save Complete Scan (Atomic Transaction)
    let scanId = null;
    let persistenceError = null;
    try {
      scanId = await saveCompleteScan(target, recon);
    } catch (e) {
      persistenceError = e?.message || 'Failed to persist scan';
      logger.error(`Failed to persist scan for target ${target}: ${persistenceError}`, { error: e });
    }
    
    res.json({
      scan_id: scanId,
      target: target,
      persistenceError,
      ...recon
    });
  } catch (err) {
    logger.error(`Recon failed for target ${req.query.target}: ${err.message}`, { error: err });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scan-history', authenticateToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const history = await getScanHistory();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/scans', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const params = {
            q: typeof req.query.q === 'string' ? req.query.q : '',
            from: typeof req.query.from === 'string' ? req.query.from : '',
            to: typeof req.query.to === 'string' ? req.query.to : '',
            sort: typeof req.query.sort === 'string' ? req.query.sort : 'scan_date',
            order: typeof req.query.order === 'string' ? req.query.order : 'desc',
            page: typeof req.query.page === 'string' ? req.query.page : 1,
            pageSize: typeof req.query.pageSize === 'string' ? req.query.pageSize : 25
        };

        const cacheKey = JSON.stringify({ userId: req.user?.id, role: req.user?.role, params });
        const payload = await historyCache.getOrSet(cacheKey, async () => {
            return await getScansHistoryPage(params);
        });

        res.json({ status: 'success', ...payload });
    } catch (err) {
        logger.error('History query failed', { error: err });
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.get('/api/history/scans/:id', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const id = req.params.id;
        const cacheKey = JSON.stringify({ userId: req.user?.id, role: req.user?.role, id });
        const payload = await historyCache.getOrSet(cacheKey, async () => {
            return await getScanDetails(id);
        });

        if (!payload) return res.status(404).json({ status: 'error', message: 'Not found' });
        res.json({ status: 'success', data: payload });
    } catch (err) {
        if (err?.code === 'BAD_REQUEST') {
            return res.status(400).json({ status: 'error', message: err.message });
        }
        logger.error('History detail query failed', { error: err });
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.delete('/api/history/scans/:id', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const id = req.params.id;
        const payload = await deleteScanHistory(id);
        historyCache.clear();
        res.json({ status: 'success', data: payload });
    } catch (err) {
        if (err?.code === 'BAD_REQUEST') {
            return res.status(400).json({ status: 'error', message: err.message });
        }
        if (err?.code === 'NOT_FOUND') {
            return res.status(404).json({ status: 'error', message: 'Not found' });
        }
        logger.error('History delete failed', { error: err });
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.get('/api/admin/provider-status', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const mode = typeof req.query.mode === 'string' ? req.query.mode : 'presence';
    const normalizedMode = mode === 'active' ? 'active' : 'presence';

    try {
        const payload = await getProviderStatus({ mode: normalizedMode });
        res.json({ status: 'success', ...payload });
    } catch (err) {
        logger.error('Provider status check failed', { error: err });
        res.status(500).json({ status: 'error', message: 'Provider status check failed' });
    }
});

app.get('/api/firewall-info', async (req, res) => {
  try {
    const { target } = req.query;
    if (!target) {
      return res.status(400).json({ error: 'No target provided' });
    }

    const data = await getFirewallInfo(target);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getOsintInvestigationType(moduleName) {
    switch (moduleName) {
        case 'alias-finder':
            return 'username';
        case 'email-validator':
            return 'email';
        case 'phone-investigator':
            return 'phone';
        case 'phishing-detect':
            return 'phishing';
        case 'leak-check':
            return 'credential';
        case 'google-dorking':
            return 'dorking';
        case 'asset-radar':
            return 'asset';
        case 'geo-spy':
            return 'geo';
        case 'code-hunter':
            return 'code';
        default:
            return 'osint';
    }
}

app.get('/api/osint/:module', authenticateToken, async (req, res) => {
    try {
        const { module } = req.params;
        let { target, scanId } = req.query;

        if (!target) {
            return res.status(400).json({ error: 'No target provided' });
        }

        const investigationType = getOsintInvestigationType(module);
        const scanIdNum = Number(scanId);
        const scanIdVal = Number.isFinite(scanIdNum) && scanIdNum > 0 ? scanIdNum : null;
        const rawTarget = typeof target === 'string' ? target : String(target);
        target = normalizeTarget(rawTarget);
        
        let data;
        try {
            const timeoutMs = 20000;
            data = await Promise.race([
                runOsintModule(module, target),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('OSINT_TIMEOUT')), timeoutMs)
                )
            ]);
        } catch (e) {
            const msg = e?.message || 'OSINT module failed';
            void saveOsintActivity({
                scanId: scanIdVal,
                user: req.user,
                module,
                target,
                investigationType,
                sources: null,
                riskLevel: 'Unknown',
                payload: null,
                errorMessage: msg
            });
            const status = msg === 'OSINT_TIMEOUT' ? 504 : 500;
            return res.status(status).json({ error: msg === 'OSINT_TIMEOUT' ? 'OSINT module timed out' : msg });
        }

        const sources = (() => {
            const results = data?.data?.results;
            if (Array.isArray(results)) {
                const platforms = results
                    .map((r) => (r?.platform ? String(r.platform) : null))
                    .filter(Boolean);
                if (platforms.length) return Array.from(new Set(platforms));
            }
            const sourcesArr = data?.data?.sources;
            if (Array.isArray(sourcesArr)) {
                const s = sourcesArr.map((v) => (typeof v === 'string' ? v : null)).filter(Boolean);
                if (s.length) return Array.from(new Set(s));
            }
            const source = data?.data?.source;
            if (typeof source === 'string' && source.trim()) return [source.trim()];
            return null;
        })();

        res.json(data);

        if (scanIdVal) {
            void saveOsintResult(scanIdVal, module, data?.risk, { target, module, risk: data?.risk, data: data?.data });
        }

        void saveOsintActivity({
            scanId: scanIdVal,
            user: req.user,
            module,
            target,
            investigationType,
            sources,
            riskLevel: data?.risk,
            payload: data,
            errorMessage: null
        });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/history/osint', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const params = {
            q: typeof req.query.q === 'string' ? req.query.q : '',
            from: typeof req.query.from === 'string' ? req.query.from : '',
            to: typeof req.query.to === 'string' ? req.query.to : '',
            module: typeof req.query.module === 'string' ? req.query.module : '',
            type: typeof req.query.type === 'string' ? req.query.type : '',
            source: typeof req.query.source === 'string' ? req.query.source : '',
            risk: typeof req.query.risk === 'string' ? req.query.risk : '',
            encrypted: typeof req.query.encrypted === 'string' ? req.query.encrypted : '',
            payloadAvailable: typeof req.query.payloadAvailable === 'string' ? req.query.payloadAvailable : '',
            page: typeof req.query.page === 'string' ? req.query.page : 1,
            pageSize: typeof req.query.pageSize === 'string' ? req.query.pageSize : 25
        };

        const cacheKey = JSON.stringify({ userId: req.user?.id, role: req.user?.role, params });
        const payload = await historyCache.getOrSet(cacheKey, async () => {
            return await getOsintActivityPage(params);
        });

        res.json({ status: 'success', ...payload });
    } catch (err) {
        logger.error('OSINT history query failed', { error: err });
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.get('/api/history/osint/:id', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const id = req.params.id;
        const cacheKey = JSON.stringify({ userId: req.user?.id, role: req.user?.role, id });
        const payload = await historyCache.getOrSet(cacheKey, async () => {
            return await getOsintActivityDetails(id);
        });

        if (!payload) return res.status(404).json({ status: 'error', message: 'Not found' });
        res.json({ status: 'success', data: payload });
    } catch (err) {
        if (err?.code === 'BAD_REQUEST') {
            return res.status(400).json({ status: 'error', message: err.message });
        }
        logger.error('OSINT history detail query failed', { error: err });
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.delete('/api/history/osint/:id', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const id = req.params.id;
        const payload = await deleteOsintActivity(id);
        historyCache.clear();
        res.json({ status: 'success', data: payload });
    } catch (err) {
        if (err?.code === 'BAD_REQUEST') {
            return res.status(400).json({ status: 'error', message: err.message });
        }
        if (err?.code === 'NOT_FOUND') {
            return res.status(404).json({ status: 'error', message: 'Not found' });
        }
        logger.error('OSINT history delete failed', { error: err });
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.get('/api/history/osint/export', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const format = typeof req.query.format === 'string' ? req.query.format : 'json';
    const normalizedFormat = format === 'csv' ? 'csv' : 'json';
    const includePayload = req.query.includePayload === '1';

    try {
        const rows = await exportOsintActivity({
            q: typeof req.query.q === 'string' ? req.query.q : '',
            from: typeof req.query.from === 'string' ? req.query.from : '',
            to: typeof req.query.to === 'string' ? req.query.to : '',
            module: typeof req.query.module === 'string' ? req.query.module : '',
            type: typeof req.query.type === 'string' ? req.query.type : '',
            source: typeof req.query.source === 'string' ? req.query.source : '',
            risk: typeof req.query.risk === 'string' ? req.query.risk : '',
            encrypted: typeof req.query.encrypted === 'string' ? req.query.encrypted : '',
            payloadAvailable: typeof req.query.payloadAvailable === 'string' ? req.query.payloadAvailable : '',
            includePayload,
            limit: typeof req.query.limit === 'string' ? req.query.limit : 1000
        });

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');

        if (normalizedFormat === 'csv') {
            const headers = [
                'id',
                'created_at',
                'investigation_type',
                'module',
                'target',
                'risk_level',
                'username',
                'scan_id',
                'result_version',
                'encrypted',
                'payload_available',
                'integrityOk',
                'sources',
                'error_message',
                'payload'
            ];

            const csvEscape = (v) => {
                const s = v == null ? '' : String(v);
                return `"${s.replace(/"/g, '""')}"`;
            };

            const lines = [headers.join(',')];
            for (const r of rows) {
                const values = [
                    r.id,
                    r.created_at,
                    r.investigation_type,
                    r.module,
                    r.target,
                    r.risk_level,
                    r.username,
                    r.scan_id,
                    r.result_version,
                    r.encrypted,
                    r.payload_available,
                    r.integrityOk ?? '',
                    r.sources ? JSON.stringify(r.sources) : '',
                    r.error_message || '',
                    includePayload && r.payload ? JSON.stringify(r.payload) : ''
                ];
                lines.push(values.map(csvEscape).join(','));
            }

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="osint-history_${stamp}.csv"`);
            return res.send(lines.join('\n'));
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="osint-history_${stamp}.json"`);
        return res.send(JSON.stringify({ exportedAt: new Date().toISOString(), items: rows }, null, 2));
    } catch (err) {
        logger.error('OSINT history export failed', { error: err });
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

// --- Recommendation System Endpoints ---

/**
 * Log user interaction with a security item
 */
app.post('/api/interactions', authenticateToken, async (req, res) => {
    try {
        const { userId, itemId, itemType, interactionType } = req.body;
        if (!userId || !itemId || !itemType || !interactionType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await recommendationEngine.logInteraction(userId, itemId, itemType, interactionType);
        res.status(201).json({ message: 'Interaction logged' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get personalized recommendations for the analyst
 */
app.get('/api/recommendations', authenticateToken, async (req, res) => {
    try {
        const { userId, limit } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const recommendations = await recommendationEngine.getRecommendations(
            parseInt(userId), 
            limit ? parseInt(limit) : 10
        );
        res.json(recommendations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Create a new user/analyst (Helper)
 */
app.post('/api/users', authenticateToken, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const { username, email, role } = req.body;
        if (!username || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const normalizedRole = role === 'admin' ? 'admin' : 'analyst';
        const conn = await pool.getConnection();
        try {
            const result = await conn.query(
            'INSERT INTO users (username, email, role) VALUES (?, ?, ?)',
            [username, email, normalizedRole]
            );
            res.status(201).json({ id: Number(result.insertId) });
        } finally {
            conn.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard Threat Map Endpoint
// Generate a static set of threats and update them incrementally for a consistent "live" feel

// Pre-defined regional clusters for realistic threat geography
const threatClusters = [
    { region: 'North America', lat: 40, lng: -100, spread: 15 },
    { region: 'Europe', lat: 50, lng: 10, spread: 12 },
    { region: 'Asia Pacific', lat: 35, lng: 105, spread: 20 },
    { region: 'Eastern Europe', lat: 55, lng: 30, spread: 10 },
    { region: 'South America', lat: -15, lng: -60, spread: 12 },
    { region: 'Africa', lat: 10, lng: 20, spread: 15 },
    { region: 'Middle East', lat: 28, lng: 45, spread: 8 },
    { region: 'Southeast Asia', lat: 5, lng: 110, spread: 10 },
    { region: 'East Asia', lat: 35, lng: 120, spread: 12 },
    { region: 'Oceania', lat: -25, lng: 135, spread: 10 },
];

// Generate base threats only once
const baseThreats = Array.from({ length: 20 }).map((_, i) => {
    const sourceCluster = threatClusters[Math.floor(Math.random() * threatClusters.length)];
    let destCluster = threatClusters[Math.floor(Math.random() * threatClusters.length)];
    while (destCluster === sourceCluster) {
        destCluster = threatClusters[Math.floor(Math.random() * threatClusters.length)];
    }

    return {
        id: `threat-${i}`,
        type: ['DDoS', 'Phishing', 'Malware', 'SQL Injection', 'Brute Force'][Math.floor(Math.random() * 5)],
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
        timestamp: new Date().toISOString(),
        source: {
            lat: sourceCluster.lat + (Math.random() * sourceCluster.spread - sourceCluster.spread / 2),
            lng: sourceCluster.lng + (Math.random() * sourceCluster.spread - sourceCluster.spread / 2),
            country: sourceCluster.region
        },
        destination: {
            lat: destCluster.lat + (Math.random() * destCluster.spread - destCluster.spread / 2),
            lng: destCluster.lng + (Math.random() * destCluster.spread - destCluster.spread / 2),
            country: destCluster.region
        }
    };
});

app.get('/api/dashboard/threat-map', (req, res) => {
    try {
        // Update timestamps and occasionally change severity for "live" feel
        const threats = baseThreats.map(threat => ({
            ...threat,
            timestamp: new Date().toISOString(),
            // Small chance to change severity each request (20% chance)
            severity: Math.random() < 0.2
                ? ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)]
                : threat.severity
        }));

        res.json(threats);
    } catch (err) {
        res.status(500).json({ error: "Failed to generate threat map data" });
    }
});

const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws/threat-map' });

function getThreatSnapshot() {
    return baseThreats.map(threat => {
        const roll = Math.random();
        let severity = threat.severity;
        if (roll < 0.12) {
            severity = ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)];
            threat.severity = severity;
        }

        return {
            ...threat,
            severity,
            timestamp: new Date().toISOString()
        };
    });
}

function broadcastThreats() {
    const payload = JSON.stringify({ type: 'threat-map', data: getThreatSnapshot() });
    for (const client of wss.clients) {
        if (client.readyState === 1) {
            client.send(payload);
        }
    }
}

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'threat-map', data: getThreatSnapshot() }));
});

setInterval(broadcastThreats, 2000);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

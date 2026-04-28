import OpenAI from 'openai';
import Exa from 'exa-js';
import fetch from 'node-fetch';
import { firecrawlService } from './ai/firecrawl.js';

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function timeoutPromise(ms) {
  return new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      const err = new Error('Timeout');
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
  });
}

async function withTimeout(promise, ms) {
  return await Promise.race([promise, timeoutPromise(ms)]);
}

function classifyHttp({ status, message }) {
  if (status === 401 || status === 403) return { status: 'invalid', detail: message || 'Unauthorized' };
  if (status === 429) return { status: 'rate_limited', detail: message || 'Rate limited' };
  if (status && status >= 500) return { status: 'error', detail: message || `HTTP ${status}` };
  return { status: 'error', detail: message || (status ? `HTTP ${status}` : 'Error') };
}

function maskDetail(detail) {
  if (!detail) return null;
  const raw = String(detail);
  const redacted = redactSecrets(raw);
  return redacted.slice(0, 240);
}

function isConfigured(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function redactSecrets(input) {
  let out = String(input);

  out = out.replace(/apiKey=[^&\s]+/gi, 'apiKey=[REDACTED]');

  const candidates = [
    process.env.OPENAI_API_KEY,
    process.env.EXA_API_KEY,
    process.env.FIRECRAWL_API_KEY,
    process.env.WHOIS_API_KEY,
    process.env.CENSYS_API_TOKEN,
    process.env.CENSYS_API_ID,
    process.env.CENSYS_API_SECRET
  ].filter((v) => isConfigured(v));

  for (const secret of candidates) {
    const s = String(secret);
    if (s.length < 8) continue;
    out = out.split(s).join('[REDACTED]');
  }

  return out;
}

function buildCensysAuth() {
  const token = process.env.CENSYS_API_TOKEN || '';
  const id = process.env.CENSYS_API_ID || '';
  const secret = process.env.CENSYS_API_SECRET || '';
  if (isConfigured(token)) return { configured: true, header: `Bearer ${token}`, mode: 'token' };
  if (isConfigured(id) && isConfigured(secret)) {
    const basic = Buffer.from(`${id}:${secret}`).toString('base64');
    return { configured: true, header: `Basic ${basic}`, mode: 'basic' };
  }
  return { configured: false, header: null, mode: 'missing' };
}

async function validateOpenAi({ timeoutMs }) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!isConfigured(apiKey)) return { configured: false, status: 'missing', detail: 'OPENAI_API_KEY is not set' };

  try {
    const client = new OpenAI({ apiKey });
    await withTimeout(client.models.list(), timeoutMs);
    return { configured: true, status: 'ok', detail: 'OpenAI reachable' };
  } catch (e) {
    const status = toNumberOrNull(e?.status ?? e?.response?.status);
    const message = e?.message || 'OpenAI validation failed';
    if (status === 429 && String(message).toLowerCase().includes('quota')) {
      return { configured: true, status: 'quota', detail: maskDetail(message) };
    }
    if (e?.code === 'TIMEOUT') return { configured: true, status: 'timeout', detail: 'Timed out' };
    return { configured: true, ...classifyHttp({ status, message: maskDetail(message) }) };
  }
}

async function validateExa({ timeoutMs }) {
  const apiKey = process.env.EXA_API_KEY || '';
  if (!isConfigured(apiKey)) return { configured: false, status: 'missing', detail: 'EXA_API_KEY is not set' };

  try {
    const exa = new Exa(apiKey);
    await withTimeout(
      exa.searchAndContents('site:example.com', {
        type: 'neural',
        useAutoprompt: false,
        numResults: 1,
        text: false
      }),
      timeoutMs
    );
    return { configured: true, status: 'ok', detail: 'Exa reachable' };
  } catch (e) {
    const status = toNumberOrNull(e?.status ?? e?.response?.status);
    const message = e?.message || 'Exa validation failed';
    if (e?.code === 'TIMEOUT') return { configured: true, status: 'timeout', detail: 'Timed out' };
    return { configured: true, ...classifyHttp({ status, message: maskDetail(message) }) };
  }
}

async function validateFirecrawl({ timeoutMs }) {
  const apiKey = process.env.FIRECRAWL_API_KEY || '';
  if (!isConfigured(apiKey)) return { configured: false, status: 'missing', detail: 'FIRECRAWL_API_KEY is not set' };

  try {
    const res = await withTimeout(firecrawlService.scrapeTarget('example.com'), timeoutMs);
    if (res?.success) return { configured: true, status: 'ok', detail: 'Firecrawl reachable' };
    return { configured: true, status: 'error', detail: maskDetail(res?.error || 'Firecrawl validation failed') };
  } catch (e) {
    const message = e?.message || 'Firecrawl validation failed';
    if (e?.code === 'TIMEOUT') return { configured: true, status: 'timeout', detail: 'Timed out' };
    return { configured: true, status: 'error', detail: maskDetail(message) };
  }
}

async function validateCensys({ timeoutMs }) {
  const auth = buildCensysAuth();
  if (!auth.configured) return { configured: false, status: 'missing', detail: 'Censys credentials not set' };

  try {
    const url = `https://search.censys.io/api/v2/hosts/search?q=${encodeURIComponent('example.com')}&per_page=1`;
    const res = await withTimeout(
      fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: auth.header
        }
      }),
      timeoutMs
    );
    if (res.ok) return { configured: true, status: 'ok', detail: 'Censys reachable' };
    const body = await res.text().catch(() => '');
    return { configured: true, ...classifyHttp({ status: res.status, message: maskDetail(body || res.statusText) }) };
  } catch (e) {
    const status = toNumberOrNull(e?.status ?? e?.response?.status);
    const message = e?.message || 'Censys validation failed';
    if (e?.code === 'TIMEOUT') return { configured: true, status: 'timeout', detail: 'Timed out' };
    return { configured: true, ...classifyHttp({ status, message: maskDetail(message) }) };
  }
}

async function validateWhois({ timeoutMs }) {
  const apiKey = process.env.WHOIS_API_KEY || '';
  if (!isConfigured(apiKey)) return { configured: false, status: 'missing', detail: 'WHOIS_API_KEY is not set (RDAP fallback available)' };

  try {
    const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${encodeURIComponent(apiKey)}&domainName=example.com&outputFormat=JSON`;
    const res = await withTimeout(fetch(url, { method: 'GET' }), timeoutMs);
    if (res.ok) return { configured: true, status: 'ok', detail: 'WhoisXMLAPI reachable' };
    const body = await res.text().catch(() => '');
    return { configured: true, ...classifyHttp({ status: res.status, message: maskDetail(body || res.statusText) }) };
  } catch (e) {
    const status = toNumberOrNull(e?.status ?? e?.response?.status);
    const message = e?.message || 'Whois validation failed';
    if (e?.code === 'TIMEOUT') return { configured: true, status: 'timeout', detail: 'Timed out' };
    return { configured: true, ...classifyHttp({ status, message: maskDetail(message) }) };
  }
}

export async function getProviderStatus({ mode = 'presence', timeoutMs = 3500 } = {}) {
  const presence = {
    openai: {
      configured: isConfigured(process.env.OPENAI_API_KEY),
      status: isConfigured(process.env.OPENAI_API_KEY) ? 'configured' : 'missing',
      detail: isConfigured(process.env.OPENAI_API_KEY) ? null : 'OPENAI_API_KEY is not set'
    },
    exa: {
      configured: isConfigured(process.env.EXA_API_KEY),
      status: isConfigured(process.env.EXA_API_KEY) ? 'configured' : 'missing',
      detail: isConfigured(process.env.EXA_API_KEY) ? null : 'EXA_API_KEY is not set'
    },
    firecrawl: {
      configured: isConfigured(process.env.FIRECRAWL_API_KEY),
      status: isConfigured(process.env.FIRECRAWL_API_KEY) ? 'configured' : 'missing',
      detail: isConfigured(process.env.FIRECRAWL_API_KEY) ? null : 'FIRECRAWL_API_KEY is not set'
    },
    censys: {
      configured: buildCensysAuth().configured,
      status: buildCensysAuth().configured ? 'configured' : 'missing',
      detail: buildCensysAuth().configured ? null : 'Censys credentials not set'
    },
    whois: {
      configured: isConfigured(process.env.WHOIS_API_KEY),
      status: isConfigured(process.env.WHOIS_API_KEY) ? 'configured' : 'missing',
      detail: isConfigured(process.env.WHOIS_API_KEY) ? null : 'WHOIS_API_KEY is not set (RDAP fallback available)'
    }
  };

  if (mode !== 'active') {
    return { mode: 'presence', providers: presence, checkedAt: new Date().toISOString() };
  }

  const [openai, exa, firecrawl, censys, whois] = await Promise.all([
    validateOpenAi({ timeoutMs }),
    validateExa({ timeoutMs }),
    validateFirecrawl({ timeoutMs }),
    validateCensys({ timeoutMs }),
    validateWhois({ timeoutMs })
  ]);

  return {
    mode: 'active',
    providers: { openai, exa, firecrawl, censys, whois },
    checkedAt: new Date().toISOString()
  };
}

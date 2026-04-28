import fetch from 'node-fetch';
import { load } from 'cheerio';
import { URL } from 'url';

function pickFirst(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function resolveUrl(baseUrl, maybeUrl) {
  try {
    if (!maybeUrl) return null;
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url, { signal, timeoutMs = 8000, maxBytes = 250_000 } = {}) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'LekirraX/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (!contentType.toLowerCase().includes('text/html')) {
      throw new Error('Not HTML');
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const slice = buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf;
    const html = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    return { html, finalUrl: res.url || url };
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export async function getSocialTags(hostname, { signal } = {}) {
  if (!hostname || typeof hostname !== 'string') {
    throw new Error('Invalid hostname');
  }

  const baseUrl = hostname.startsWith('http') ? hostname : `https://${hostname}`;
  const { html, finalUrl } = await fetchHtml(baseUrl, { signal });

  const $ = load(html);

  const title = pickFirst($('title').first().text());
  const description = pickFirst($('meta[name="description"]').attr('content'));
  const canonicalUrl = pickFirst($('link[rel="canonical"]').attr('href'));
  const generator = pickFirst($('meta[name="generator"]').attr('content'));

  const ogTitle = pickFirst(
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="og:title"]').attr('content'),
    title
  );
  const ogDescription = pickFirst(
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="og:description"]').attr('content'),
    description
  );

  const twitterCard = pickFirst(
    $('meta[name="twitter:card"]').attr('content'),
    $('meta[property="twitter:card"]').attr('content')
  );
  const twitterSite = pickFirst(
    $('meta[name="twitter:site"]').attr('content'),
    $('meta[property="twitter:site"]').attr('content')
  );

  const image = pickFirst(
    $('meta[property="og:image:secure_url"]').attr('content'),
    $('meta[property="og:image"]').attr('content'),
    $('meta[name="twitter:image"]').attr('content'),
    $('meta[property="twitter:image"]').attr('content')
  );

  return {
    ogTitle,
    ogDescription,
    twitterCard,
    image: resolveUrl(finalUrl, image),
    canonicalUrl: resolveUrl(finalUrl, canonicalUrl),
    twitterSite,
    generator,
    pageTitle: title,
    pageDescription: description
  };
}

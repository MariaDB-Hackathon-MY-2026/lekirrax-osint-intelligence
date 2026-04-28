import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('node-fetch', () => {
  return { default: fetchMock };
});

import { getSocialTags } from '../socialTags.js';

function makeHtmlResponse(html, { url = 'https://example.com/page' } = {}) {
  const buf = Buffer.from(html, 'utf-8');
  return {
    ok: true,
    status: 200,
    url,
    headers: {
      get: (k) => (String(k).toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null)
    },
    arrayBuffer: async () => buf
  };
}

describe('getSocialTags', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('extracts OG and Twitter tags from HTML', async () => {
    fetchMock.mockResolvedValueOnce(
      makeHtmlResponse(`
        <html>
          <head>
            <title>Page Title</title>
            <meta property="og:title" content="OG Title" />
            <meta property="og:description" content="OG Desc" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta property="og:image" content="/img.png" />
            <link rel="canonical" href="/canonical" />
          </head>
        </html>
      `)
    );

    const res = await getSocialTags('https://example.com/test');
    expect(res.ogTitle).toBe('OG Title');
    expect(res.ogDescription).toBe('OG Desc');
    expect(res.twitterCard).toBe('summary_large_image');
    expect(res.image).toBe('https://example.com/img.png');
    expect(res.canonicalUrl).toBe('https://example.com/canonical');
  });
});

